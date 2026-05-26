import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../services/api'
import { Edit3, Trash2, Plus, X, Bookmark, Activity, Palette } from 'lucide-react'

export default function Presets() {
  const [presets, setPresets] = useState([])
  const [effects, setEffects] = useState([])
  const [palettes, setPalettes] = useState([])
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  
  const [formData, setFormData] = useState({
    name: '',
    is_on: true,
    transition: 7,
    effect_id: 140,
    effect_speed: 128,
    effect_intensity: 128,
    palette_id: 2,
    color1: '#FF0000',
    color2: '#00FF00',
    color3: '#0000FF'
  })

  // Pagination & Sorting
  const [sort, setSort] = useState({ column: 'id', direction: 'asc' });
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchData = useCallback(async () => {
    try {
      const [presetsRes, effectsRes, palettesRes] = await Promise.all([
        api.get('/api/presets'),
        api.get('/api/effects'),
        api.get('/api/palettes')
      ]);
      setPresets(presetsRes.data);
      setEffects(effectsRes.data);
      setPalettes(palettesRes.data);
    } catch (err) {
      console.error("Failed to load presets data", err)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSortRequest = (column) => {
      let direction = 'asc';
      if (sort.column === column && sort.direction === 'asc') {
          direction = 'desc';
      }
      setSort({ column, direction });
      setPage(1);
  };

  const sortedPresets = useMemo(() => {
      const sortableItems = [...presets];
      if (sort.column !== null) {
          sortableItems.sort((a, b) => {
              let aVal = a[sort.column];
              let bVal = b[sort.column];

              if (['id', 'transition', 'effect_speed', 'effect_intensity'].includes(sort.column)) {
                  return sort.direction === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
              }
              if (['is_on'].includes(sort.column)) {
                  return sort.direction === 'asc' ? (aVal === bVal ? 0 : aVal ? 1 : -1) : (aVal === bVal ? 0 : aVal ? -1 : 1);
              }

              aVal = aVal?.toString().toLowerCase() || '';
              bVal = bVal?.toString().toLowerCase() || '';
              if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
              if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
              return 0;
          });
      }
      return sortableItems;
  }, [presets, sort]);

  const totalPages = Math.ceil(sortedPresets.length / rowsPerPage) || 1;
  const paginatedPresets = useMemo(() => {
      const startIndex = (page - 1) * rowsPerPage;
      return sortedPresets.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedPresets, page, rowsPerPage]);

  const SortIndicator = ({ currentSort, column }) => {
      if (currentSort.column !== column) return <span className="opacity-40 ml-1">↕</span>;
      return currentSort.direction === 'asc' 
          ? <span className="text-indigo-400 ml-1">↑</span> 
          : <span className="text-indigo-400 ml-1">↓</span>;
  };

  const getEffectName = (id) => effects.find(e => e.effect_id === id)?.name || id
  const getPaletteName = (id) => palettes.find(p => p.palettes_id === id)?.name || id

  const openModal = (preset = null) => {
    if (preset) {
      setEditingPreset(preset)
      setFormData({
        name: preset.name,
        is_on: preset.is_on,
        transition: preset.transition,
        effect_id: preset.effect_id,
        effect_speed: preset.effect_speed,
        effect_intensity: preset.effect_intensity,
        palette_id: preset.palette_id,
        color1: preset.color1,
        color2: preset.color2,
        color3: preset.color3
      })
    } else {
      setEditingPreset(null)
      setFormData({
        name: '',
        is_on: true,
        transition: 7,
        effect_id: 140,
        effect_speed: 128,
        effect_intensity: 128,
        palette_id: 2,
        color1: '#FF0000',
        color2: '#00FF00',
        color3: '#0000FF'
      })
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()

    const payload = {
      ...formData,
      transition: parseInt(formData.transition) || 7,
      effect_id: parseInt(formData.effect_id) || 0,
      effect_speed: parseInt(formData.effect_speed) || 128,
      effect_intensity: parseInt(formData.effect_intensity) || 128,
      palette_id: parseInt(formData.palette_id) || 0
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
      alert("Error saving preset: " + (err.response?.data?.detail?.[0]?.msg || err.message))
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/presets/${id}`);
      fetchData();
      setDeletingId(null);
      if (paginatedPresets.length === 1 && page > 1) {
          setPage(prev => prev - 1);
      }
    } catch (err) {
      alert("Error deleting preset.")
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto p-4 flex-1 overflow-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
            <Bookmark size={24} />
        </div>
        <h1 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Presets</h1>
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
          <div className="overflow-x-auto">
            <table className="w-full text-center text-sm table-auto min-w-max">
              <thead className="bg-slate-800/80 text-slate-400 font-bold uppercase text-[13px] tracking-widest select-none">
                <tr>
                  <th onClick={() => handleSortRequest('id')} className="p-4 cursor-pointer hover:text-white transition-colors">
                    ID <SortIndicator currentSort={sort} column="id" />
                  </th>
                  <th onClick={() => handleSortRequest('name')} className="p-4 cursor-pointer hover:text-white transition-colors">
                    Name <SortIndicator currentSort={sort} column="name" />
                  </th>
                  <th onClick={() => handleSortRequest('is_on')} className="p-4 cursor-pointer hover:text-white transition-colors">
                    On/Off <SortIndicator currentSort={sort} column="is_on" />
                  </th>
                  <th className="p-4">Effect</th>
                  <th className="p-4">Palette</th>
                  <th className="p-4">Speed/Intens</th>
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
                      {preset.is_on ? (
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/30">ON</span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-[10px] font-bold border border-slate-700">OFF</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-300">
                      <div className="flex items-center justify-center gap-1">
                        <Activity size={12} className="text-indigo-400"/>
                        {getEffectName(preset.effect_id)}
                      </div>
                    </td>
                    <td className="p-4 text-slate-300">
                      <div className="flex items-center justify-center gap-1">
                        <Palette size={12} className="text-pink-400"/>
                        {getPaletteName(preset.palette_id)}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-mono text-slate-400">S:{preset.effect_speed} / I:{preset.effect_intensity}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-1">
                        <div className="w-4 h-4 rounded-full border border-slate-600" style={{backgroundColor: preset.color1}}></div>
                        <div className="w-4 h-4 rounded-full border border-slate-600" style={{backgroundColor: preset.color2}}></div>
                        <div className="w-4 h-4 rounded-full border border-slate-600" style={{backgroundColor: preset.color3}}></div>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
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
                      <td colSpan="8" className="p-8 text-center text-slate-600 italic text-xs">
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
                      onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
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
                          <span className="font-bold px-2">{"<"}</span>
                      </button>
                      <button 
                          disabled={page === totalPages}
                          onClick={() => setPage(prev => prev + 1)}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                      >
                          <span className="font-bold px-2">{">"}</span>
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
                {editingPreset ? 'Edit Preset' : 'New Preset'}
              </h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto grid grid-cols-2 gap-5 flex-1">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Preset Name</label>
                <input
                  required
                  placeholder='My Awesome Preset'
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  checked={formData.is_on}
                  onChange={e => setFormData({ ...formData, is_on: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <label className="text-xs font-bold text-slate-300 cursor-pointer">Turn On State</label>
              </div>
              
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Transition (Tenths of a second)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.transition}
                  onChange={e => setFormData({ ...formData, transition: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                />
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

              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Speed</label>
                  <span className="text-xs font-mono text-indigo-400 font-bold">{formData.effect_speed}</span>
                </div>
                <input
                  type="range" min="0" max="255"
                  value={formData.effect_speed}
                  onChange={e => setFormData({ ...formData, effect_speed: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Intensity</label>
                  <span className="text-xs font-mono text-indigo-400 font-bold">{formData.effect_intensity}</span>
                </div>
                <input
                  type="range" min="0" max="255"
                  value={formData.effect_intensity}
                  onChange={e => setFormData({ ...formData, effect_intensity: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div className="col-span-2 bg-slate-950/50 p-4 rounded-2xl border border-slate-800 flex justify-around">
                <div className="flex flex-col items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Color 1</label>
                  <input type="color" value={formData.color1} onChange={e => setFormData({...formData, color1: e.target.value})} className="w-12 h-12 rounded cursor-pointer bg-transparent border-0 p-0" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Color 2</label>
                  <input type="color" value={formData.color2} onChange={e => setFormData({...formData, color2: e.target.value})} className="w-12 h-12 rounded cursor-pointer bg-transparent border-0 p-0" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Color 3</label>
                  <input type="color" value={formData.color3} onChange={e => setFormData({...formData, color3: e.target.value})} className="w-12 h-12 rounded cursor-pointer bg-transparent border-0 p-0" />
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