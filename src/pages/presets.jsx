import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../services/api'
import { Edit3, Trash2, Plus, X, Bookmark, Activity, Palette, Play, Snowflake, Layers } from 'lucide-react'

const DEFAULT_BLEND_MODES = [
  { id: 0, name: 'Linear (Default)' },
  { id: 1, name: 'Add' },
  { id: 2, name: 'Subtract' },
  { id: 3, name: 'Multiply' },
  { id: 4, name: 'Screen' },
  { id: 5, name: 'Overlay' },
  { id: 6, name: 'Darken' },
  { id: 7, name: 'Lighten' },
  { id: 8, name: 'Color Dodge' },
  { id: 9, name: 'Color Burn' },
  { id: 10, name: 'Hard Light' },
  { id: 11, name: 'Soft Light' },
  { id: 12, name: 'Difference' },
  { id: 13, name: 'Exclusion' },
  { id: 14, name: 'Stencil' },
]

export default function Presets() {
  const [presets, setPresets] = useState([])
  const [effects, setEffects] = useState([])
  const [palettes, setPalettes] = useState([])
  const [blendModes, setBlendModes] = useState(DEFAULT_BLEND_MODES)
  const [applyingId, setApplyingId] = useState(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const defaultFormData = {
    name: '',
    is_on: true,
    transition: 7,
    reverse_direction: false,
    effect_id: 140,
    effect_speed: 128,
    effect_intensity: 128,
    palette_id: 2,
    color1: '#FF0000',
    color2: '#00FF00',
    color3: '#0000FF',
    custom1: 128,
    custom2: 128,
    custom3: 16,
    cct: 127,
    freeze: false,
    blend_mode: 0,
  }

  const [formData, setFormData] = useState(defaultFormData)

  // Pagination & Sorting
  const [sort, setSort] = useState({ column: 'id', direction: 'asc' })
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const fetchData = useCallback(async () => {
    try {
      const [presetsRes, effectsRes, palettesRes, bmRes] = await Promise.all([
        api.get('/api/presets'),
        api.get('/api/effects'),
        api.get('/api/palettes'),
        api.get('/api/blend-modes').catch(() => ({ data: DEFAULT_BLEND_MODES })),
      ])
      setPresets(presetsRes.data || [])
      setEffects(effectsRes.data || [])
      setPalettes(palettesRes.data || [])
      if (bmRes.data?.length) setBlendModes(bmRes.data)
    } catch (err) {
      console.error('Failed to load presets data', err)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSortRequest = (column) => {
    let direction = 'asc'
    if (sort.column === column && sort.direction === 'asc') {
      direction = 'desc'
    }
    setSort({ column, direction })
    setPage(1)
  }

  const sortedPresets = useMemo(() => {
    const sortableItems = [...presets]
    if (sort.column !== null) {
      sortableItems.sort((a, b) => {
        let aVal = a[sort.column]
        let bVal = b[sort.column]

        if (['id', 'transition', 'effect_speed', 'effect_intensity'].includes(sort.column)) {
          return sort.direction === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0)
        }
        if (['is_on'].includes(sort.column)) {
          return sort.direction === 'asc' ? (aVal === bVal ? 0 : aVal ? 1 : -1) : (aVal === bVal ? 0 : aVal ? -1 : 1)
        }

        aVal = aVal?.toString().toLowerCase() || ''
        bVal = bVal?.toString().toLowerCase() || ''
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return sortableItems
  }, [presets, sort])

  const totalPages = Math.ceil(sortedPresets.length / rowsPerPage) || 1
  const paginatedPresets = useMemo(() => {
    const startIndex = (page - 1) * rowsPerPage
    return sortedPresets.slice(startIndex, startIndex + rowsPerPage)
  }, [sortedPresets, page, rowsPerPage])

  const SortIndicator = ({ currentSort, column }) => {
    if (currentSort.column !== column) return <span className="opacity-40 ml-1">↕</span>
    return currentSort.direction === 'asc'
      ? <span className="text-indigo-400 ml-1">↑</span>
      : <span className="text-indigo-400 ml-1">↓</span>
  }

  const getEffectName = (id) => effects.find(e => e.effect_id === id)?.name || `Effect #${id}`
  const getPaletteName = (id) => palettes.find(p => p.palettes_id === id)?.name || `Palette #${id}`
  const getBlendName = (id) => blendModes.find(b => b.id === id)?.name || 'Linear'

  const openModal = (preset = null) => {
    if (preset) {
      setEditingPreset(preset)
      setFormData({
        name: preset.name,
        is_on: preset.is_on,
        transition: preset.transition,
        reverse_direction: preset.reverse_direction,
        effect_id: preset.effect_id,
        effect_speed: preset.effect_speed,
        effect_intensity: preset.effect_intensity,
        palette_id: preset.palette_id,
        color1: preset.color1,
        color2: preset.color2,
        color3: preset.color3,
        custom1: preset.custom1 ?? 128,
        custom2: preset.custom2 ?? 128,
        custom3: preset.custom3 ?? 16,
        cct: preset.cct ?? 127,
        freeze: preset.freeze ?? false,
        blend_mode: preset.blend_mode ?? 0,
      })
    } else {
      setEditingPreset(null)
      setFormData(defaultFormData)
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()

    const payload = {
      ...formData,
      transition: parseInt(formData.transition, 10) || 0,
      effect_id: parseInt(formData.effect_id, 10) || 0,
      effect_speed: parseInt(formData.effect_speed, 10) || 0,
      effect_intensity: parseInt(formData.effect_intensity, 10) || 0,
      palette_id: parseInt(formData.palette_id, 10) || 0,
      custom1: parseInt(formData.custom1, 10) || 0,
      custom2: parseInt(formData.custom2, 10) || 0,
      custom3: parseInt(formData.custom3, 10) || 0,
      cct: parseInt(formData.cct, 10) || 0,
      blend_mode: parseInt(formData.blend_mode, 10) || 0,
    }

    try {
      if (editingPreset) {
        await api.put(`/api/presets/${editingPreset.id}`, payload)
      } else {
        await api.post('/api/presets', payload)
      }
      fetchData()
      setIsModalOpen(false)
    } catch (err) {
      alert('Error saving preset: ' + (err.response?.data?.detail?.[0]?.msg || err.message))
    }
  }

  const handleApplyNow = async (preset) => {
    setApplyingId(preset.id)
    try {
      await api.post(`/api/presets/${preset.id}/apply`)
    } catch (err) {
      alert('Failed to apply preset: ' + (err.response?.data?.detail || err.message))
    } finally {
      setApplyingId(null)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/presets/${id}`)
      fetchData()
      setDeletingId(null)
      if (paginatedPresets.length === 1 && page > 1) {
        setPage(prev => prev - 1)
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail
        ? (typeof err.response.data.detail === 'string' ? err.response.data.detail : JSON.stringify(err.response.data.detail))
        : 'An unexpected error occurred.'
      alert(`Failed to delete: ${errorMessage}`)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto p-4 flex-1 overflow-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
          <Bookmark size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Presets</h1>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            WLED 0.16.1 Effects, Custom Sliders (c1–c3), Layer Blend Modes & CCT
          </p>
        </div>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800/60 p-6 shadow-xl">
        <div className="flex justify-between pb-4 items-baseline">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Saved Presets</h3>
          <button
            onClick={() => openModal()}
            className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={16} /> CREATE PRESET
          </button>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-xl">
          <div className="table-wrapper">
            <table className="w-full text-center text-sm table-auto min-w-max">
              <thead className="bg-slate-800/95 text-slate-400 font-bold uppercase text-[13px] tracking-widest select-none">
                <tr>
                  <th onClick={() => handleSortRequest('id')} className="p-4 cursor-pointer hover:text-white transition-colors">
                    ID <SortIndicator currentSort={sort} column="id" />
                  </th>
                  <th onClick={() => handleSortRequest('name')} className="p-4 cursor-pointer hover:text-white transition-colors">
                    Name <SortIndicator currentSort={sort} column="name" />
                  </th>
                  <th onClick={() => handleSortRequest('is_on')} className="p-4 cursor-pointer hover:text-white transition-colors">
                    State <SortIndicator currentSort={sort} column="is_on" />
                  </th>
                  <th className="p-4">Effect</th>
                  <th className="p-4">Palette</th>
                  <th className="p-4">Speed / Int / c1–c3</th>
                  <th className="p-4">Blend / Flags</th>
                  <th className="p-4">Colors</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-center text-[14px]">
                {paginatedPresets.length > 0 ? (
                  paginatedPresets.map(preset => (
                    <tr key={preset.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-mono text-slate-400">{preset.id}</td>
                      <td className="p-4 font-bold text-slate-200">{preset.name}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1">
                          {preset.is_on ? (
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/30">ON</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px] font-bold border border-slate-700">OFF</span>
                          )}
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px] font-bold border border-slate-700">
                            {preset.reverse_direction ? 'REV' : 'FWD'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-300">
                        <div className="flex items-center justify-center gap-1">
                          <Activity size={12} className="text-indigo-400" />
                          {getEffectName(preset.effect_id)}
                        </div>
                      </td>
                      <td className="p-4 text-slate-300">
                        <div className="flex items-center justify-center gap-1">
                          <Palette size={12} className="text-pink-400" />
                          {getPaletteName(preset.palette_id)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-xs font-mono text-slate-300">S:{preset.effect_speed} / I:{preset.effect_intensity}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          c1:{preset.custom1 ?? 128} c2:{preset.custom2 ?? 128} c3:{preset.custom3 ?? 16}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded text-[10px] font-bold flex items-center gap-1">
                            <Layers size={10} /> {getBlendName(preset.blend_mode ?? 0)}
                          </span>
                          {preset.freeze && (
                            <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded text-[10px] font-bold flex items-center gap-0.5">
                              <Snowflake size={10} /> FRZ
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center gap-1">
                          <div className="w-4 h-4 rounded-full border border-slate-600" style={{ backgroundColor: preset.color1 }}></div>
                          <div className="w-4 h-4 rounded-full border border-slate-600" style={{ backgroundColor: preset.color2 }}></div>
                          <div className="w-4 h-4 rounded-full border border-slate-600" style={{ backgroundColor: preset.color3 }}></div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleApplyNow(preset)}
                            disabled={applyingId === preset.id}
                            title="Apply preset to all active controllers now"
                            className="cursor-pointer px-2.5 py-1.5 text-[10px] font-bold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white rounded-lg transition-all flex items-center gap-1 disabled:opacity-40"
                          >
                            <Play size={12} /> APPLY
                          </button>
                          <button onClick={() => openModal(preset)} className="cursor-pointer p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                            <Edit3 size={16} />
                          </button>
                          <button onClick={() => setDeletingId(preset.id)} className="cursor-pointer p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="p-8 text-center text-slate-600 italic text-xs">
                      No Presets created.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-900/50 border-t border-slate-800 px-4 py-3 flex items-center justify-between flex-wrap gap-3 text-xs font-bold text-slate-400">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1) }}
                className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 outline-none cursor-pointer hover:bg-slate-800/40"
              >
                {[5, 10, 25, 50].map(size =>
                  <option key={size} value={size} className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 outline-none cursor-pointer">
                    {size}
                  </option>)}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(prev => prev - 1)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  <span className="font-bold px-2">{'<'}</span>
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(prev => prev + 1)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  <span className="font-bold px-2">{'>'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <form onSubmit={handleSave} className="relative bg-slate-900/90 backdrop-blur-md border border-slate-800/60 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
              <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                {editingPreset ? 'Edit Preset (WLED 0.16.1)' : 'New Preset (WLED 0.16.1)'}
              </h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-2 gap-4 flex-1">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Preset Name</label>
                <input
                  required
                  placeholder="My Awesome Preset"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="col-span-2 grid grid-cols-3 gap-3">
                <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                  <input
                    type="checkbox"
                    id="preset_is_on"
                    checked={formData.is_on}
                    onChange={e => setFormData({ ...formData, is_on: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="preset_is_on" className="text-xs font-bold text-slate-300 cursor-pointer">Power On</label>
                </div>

                <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                  <input
                    type="checkbox"
                    id="preset_rev"
                    checked={formData.reverse_direction}
                    onChange={e => setFormData({ ...formData, reverse_direction: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="preset_rev" className="text-xs font-bold text-slate-300 cursor-pointer">Reverse Dir</label>
                </div>

                <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                  <input
                    type="checkbox"
                    id="preset_frz"
                    checked={formData.freeze}
                    onChange={e => setFormData({ ...formData, freeze: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="preset_frz" className="text-xs font-bold text-slate-300 cursor-pointer">Freeze Effect</label>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Effect</label>
                <select
                  value={formData.effect_id}
                  onChange={e => setFormData({ ...formData, effect_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                >
                  {effects.map(e => (
                    <option key={e.id} value={e.effect_id}>{e.name} (ID: {e.effect_id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Palette</label>
                <select
                  value={formData.palette_id}
                  onChange={e => setFormData({ ...formData, palette_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                >
                  {palettes.map(p => (
                    <option key={p.id} value={p.palettes_id}>{p.name} (ID: {p.palettes_id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Transition (×100ms)</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="65535"
                  value={formData.transition}
                  onChange={e => setFormData({ ...formData, transition: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Layer Blend Mode (0.16.1)</label>
                <select
                  value={formData.blend_mode}
                  onChange={e => setFormData({ ...formData, blend_mode: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                >
                  {blendModes.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Speed (sx)</label>
                  <span className="text-xs font-mono text-indigo-400 font-bold">{formData.effect_speed}</span>
                </div>
                <input
                  type="range" min="0" max="255"
                  value={formData.effect_speed}
                  onChange={e => setFormData({ ...formData, effect_speed: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Intensity (ix)</label>
                  <span className="text-xs font-mono text-indigo-400 font-bold">{formData.effect_intensity}</span>
                </div>
                <input
                  type="range" min="0" max="255"
                  value={formData.effect_intensity}
                  onChange={e => setFormData({ ...formData, effect_intensity: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {/* WLED 0.16.1 Custom Effect Sliders c1, c2, c3, and CCT */}
              <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Custom 1 (c1)</label>
                  <span className="text-xs font-mono text-indigo-400 font-bold">{formData.custom1}</span>
                </div>
                <input
                  type="range" min="0" max="255"
                  value={formData.custom1}
                  onChange={e => setFormData({ ...formData, custom1: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Custom 2 (c2)</label>
                  <span className="text-xs font-mono text-indigo-400 font-bold">{formData.custom2}</span>
                </div>
                <input
                  type="range" min="0" max="255"
                  value={formData.custom2}
                  onChange={e => setFormData({ ...formData, custom2: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Custom 3 (c3)</label>
                  <span className="text-xs font-mono text-indigo-400 font-bold">{formData.custom3}</span>
                </div>
                <input
                  type="range" min="0" max="31"
                  value={formData.custom3}
                  onChange={e => setFormData({ ...formData, custom3: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">White Temp (CCT)</label>
                  <span className="text-xs font-mono text-amber-400 font-bold">{formData.cct}</span>
                </div>
                <input
                  type="range" min="0" max="255"
                  value={formData.cct}
                  onChange={e => setFormData({ ...formData, cct: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div className="col-span-2 bg-slate-950/50 p-4 rounded-2xl border border-slate-800 flex justify-around">
                <div className="flex flex-col items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Primary (Color 1)</label>
                  <input type="color" value={formData.color1} onChange={e => setFormData({ ...formData, color1: e.target.value })} className="w-12 h-12 rounded cursor-pointer bg-transparent border-0 p-0" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Secondary (Color 2)</label>
                  <input type="color" value={formData.color2} onChange={e => setFormData({ ...formData, color2: e.target.value })} className="w-12 h-12 rounded cursor-pointer bg-transparent border-0 p-0" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Tertiary (Color 3)</label>
                  <input type="color" value={formData.color3} onChange={e => setFormData({ ...formData, color3: e.target.value })} className="w-12 h-12 rounded cursor-pointer bg-transparent border-0 p-0" />
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-800/30 border-t border-slate-800">
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/20">
                {editingPreset ? 'UPDATE PRESET' : 'SAVE PRESET'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deletingId && (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setDeletingId(null)} />
          <div className="relative bg-slate-900 border border-rose-500/20 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center">
            <div className="bg-rose-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="text-rose-500" size={32} />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Confirm Deletion</h2>
            <p className="text-slate-400 text-sm mt-3">This will permanently remove this preset.</p>
            <div className="flex gap-3 mt-8">
              <button type="button" onClick={() => setDeletingId(null)} className="flex-1 bg-slate-800 text-slate-300 font-bold py-3 rounded-xl cursor-pointer">CANCEL</button>
              <button type="button" onClick={() => handleDelete(deletingId)} className="flex-1 bg-rose-600 text-white font-bold py-3 rounded-xl cursor-pointer">DELETE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
