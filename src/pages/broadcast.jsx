import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import api from '../services/api'
import {
  Radio, Plus, X, Trash2, Edit3, Play, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown, CheckCircle, XCircle, Loader,
  Clock, Server, Users, ListMusic
} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────────

const SortIndicator = ({ sort, col }) => {
  if (sort.column !== col) return <ArrowUpDown size={13} className="opacity-30 inline ml-1" />
  return sort.direction === 'asc'
    ? <ArrowUp size={13} className="text-indigo-400 inline ml-1" />
    : <ArrowDown size={13} className="text-indigo-400 inline ml-1" />
}

const StatusDot = ({ ok }) =>
  ok
    ? <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
    : <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />

// ── Main component ────────────────────────────────────────────────────────────

export default function Broadcasts() {
  // ── data state ──────────────────────────────────────────────────────────────
  const [broadcasts, setBroadcasts]   = useState([])
  const [playlists,  setPlaylists]    = useState([])
  const [controllers,setControllers]  = useState([])
  const [groups,     setGroups]       = useState([])

  // ── modal state ─────────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing,     setEditing]     = useState(null)
  const [deletingId,  setDeletingId]  = useState(null)

  const defaultForm = {
    name: '',
    playlist_id: '',
    target_type: 'controller',   // 'controller' | 'group'
    controller_id: '',
    group_id: '',
    controller_delay_ms: 0,
    is_active: true,
  }
  const [form, setForm] = useState(defaultForm)

  // ── pagination / sort ────────────────────────────────────────────────────────
  const [sort,        setSort]        = useState({ column: 'id', direction: 'asc' })
  const [page,        setPage]        = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // ── dispatch live-feed ───────────────────────────────────────────────────────
  const [dispatchLog, setDispatchLog] = useState([])   // array of log entries
  const [dispatching, setDispatching] = useState(null)  // broadcast id currently dispatching
  const [showLog,     setShowLog]     = useState(false)
  const logEndRef = useRef(null)

  // ── WebSocket for live progress ──────────────────────────────────────────────
  const wsRef = useRef(null)

  useEffect(() => {
    const connect = () => {
      const host = window.location.hostname
      const ws   = new WebSocket(`ws://${host}:8000/ws`)
      wsRef.current = ws

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'dispatch_start') {
            setDispatchLog([{
              kind: 'start',
              text: `▶ Dispatch started → ${msg.total_controllers} controller(s), ${msg.total_items} item(s)`,
              ts: new Date().toLocaleTimeString(),
            }])
            setShowLog(true)
            setDispatching(msg.broadcast_id)
          } else if (msg.type === 'dispatch_progress') {
            const icon = msg.status === 'sending' ? '⏳'
                       : msg.status === 'ok'      ? '✅'
                       : '❌'
            setDispatchLog(prev => [...prev, {
              kind: msg.status,
              text: `${icon} [${msg.controller_name}] → ${msg.preset_name} — ${msg.status}`,
              ts: new Date().toLocaleTimeString(),
              controller_id: msg.controller_id,
            }])
          } else if (msg.type === 'dispatch_complete') {
            setDispatchLog(prev => [...prev, {
              kind: 'done',
              text: `✔ Dispatch complete`,
              ts: new Date().toLocaleTimeString(),
            }])
            setDispatching(null)
          }
        } catch {}
      }

      ws.onclose = () => {
        setTimeout(connect, 3000)
      }
    }
    connect()
    return () => wsRef.current?.close()
  }, [])

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [dispatchLog])

  // ── fetch ────────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [bRes, plRes, ctRes, grRes] = await Promise.all([
        api.get('/api/broadcasts'),
        api.get('/api/playlists'),
        api.get('/api/controllers'),
        api.get('/api/groups'),
      ])
      setBroadcasts(bRes.data)
      setPlaylists(plRes.data)
      setControllers(ctRes.data)
      setGroups(grRes.data)
    } catch (err) {
      console.error('Failed to load broadcast data', err)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── sort / paginate ──────────────────────────────────────────────────────────
  const handleSort = (col) => {
    setSort(prev => ({ column: col, direction: prev.column === col && prev.direction === 'asc' ? 'desc' : 'asc' }))
    setPage(1)
  }

  const sorted = useMemo(() => {
    const items = [...broadcasts]
    items.sort((a, b) => {
      let av = a[sort.column], bv = b[sort.column]
      if (typeof av === 'boolean') return sort.direction === 'asc' ? (av === bv ? 0 : av ? 1 : -1) : (av === bv ? 0 : av ? -1 : 1)
      if (typeof av === 'number') return sort.direction === 'asc' ? av - bv : bv - av
      av = (av || '').toString().toLowerCase(); bv = (bv || '').toString().toLowerCase()
      return sort.direction === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return items
  }, [broadcasts, sort])

  const totalPages      = Math.ceil(sorted.length / rowsPerPage) || 1
  const paginated       = useMemo(() => sorted.slice((page - 1) * rowsPerPage, page * rowsPerPage), [sorted, page, rowsPerPage])

  // ── modal open / close ───────────────────────────────────────────────────────
  const openModal = (b = null) => {
    if (b) {
      setEditing(b)
      setForm({
        name:                b.name,
        playlist_id:         b.playlist_id,
        target_type:         b.controller_id ? 'controller' : 'group',
        controller_id:       b.controller_id || '',
        group_id:            b.group_id || '',
        controller_delay_ms: b.controller_delay_ms,
        is_active:           b.is_active,
      })
    } else {
      setEditing(null)
      setForm({ ...defaultForm, playlist_id: playlists[0]?.id || '' })
    }
    setIsModalOpen(true)
  }

  // ── save ─────────────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault()
    const payload = {
      name:                form.name,
      playlist_id:         parseInt(form.playlist_id),
      controller_id:       form.target_type === 'controller' ? parseInt(form.controller_id) || null : null,
      group_id:            form.target_type === 'group'      ? parseInt(form.group_id)      || null : null,
      controller_delay_ms: parseInt(form.controller_delay_ms) || 0,
      is_active:           form.is_active,
    }
    try {
      if (editing) {
        await api.put(`/api/broadcasts/${editing.id}`, payload)
      } else {
        await api.post('/api/broadcasts', payload)
      }
      fetchAll()
      setIsModalOpen(false)
    } catch (err) {
      alert('Error saving broadcast: ' + (err.response?.data?.detail || err.message))
    }
  }

  // ── delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/broadcasts/${id}`)
      fetchAll()
      setDeletingId(null)
    } catch {
      alert('Error deleting broadcast.')
    }
  }

  // ── dispatch ─────────────────────────────────────────────────────────────────
  const handleDispatch = async (id) => {
    try {
      setDispatchLog([])
      setDispatching(id)
      setShowLog(true)
      await api.post(`/api/broadcasts/${id}/dispatch`)
    } catch (err) {
      setDispatchLog(prev => [...prev, {
        kind: 'error',
        text: `❌ Dispatch failed: ${err.response?.data?.detail || err.message}`,
        ts: new Date().toLocaleTimeString(),
      }])
      setDispatching(null)
    }
  }

  // ── toggle ───────────────────────────────────────────────────────────────────
  const handleToggle = async (id) => {
    await api.post(`/api/broadcasts/${id}/toggle`)
    fetchAll()
  }

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto p-4 flex-1 overflow-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
          <Radio size={24} />
        </div>
        <h1 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Broadcasts</h1>
      </div>

      {/* Live Dispatch Log */}
      {showLog && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              {dispatching
                ? <><Loader size={14} className="animate-spin text-indigo-400" /> Live Dispatch Feed</>
                : <><CheckCircle size={14} className="text-emerald-400" /> Dispatch Complete</>
              }
            </div>
            <button onClick={() => setShowLog(false)} className="text-slate-500 hover:text-white cursor-pointer">
              <X size={16} />
            </button>
          </div>
          <div className="h-44 overflow-y-auto p-4 font-mono text-xs space-y-1">
            {dispatchLog.map((entry, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 ${
                  entry.kind === 'error'   ? 'text-rose-400'
                  : entry.kind === 'ok'   ? 'text-emerald-400'
                  : entry.kind === 'done' ? 'text-indigo-300'
                  : 'text-slate-400'
                }`}
              >
                <span className="text-slate-600 shrink-0">{entry.ts}</span>
                <span>{entry.text}</span>
              </div>
            ))}
            {dispatchLog.length === 0 && (
              <span className="text-slate-600 italic">Waiting for dispatch events…</span>
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800/60 p-6 shadow-xl">
        <div className="flex justify-between pb-4 items-baseline">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Saved Broadcasts</h3>
          <button
            onClick={() => openModal()}
            className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={16} /> CREATE BROADCAST
          </button>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-center text-sm table-auto min-w-max">
              <thead className="bg-slate-800/80 text-slate-400 font-bold uppercase text-[13px] tracking-widest select-none">
                <tr>
                  <th onClick={() => handleSort('id')}             className="p-4 cursor-pointer hover:text-white">ID <SortIndicator sort={sort} col="id" /></th>
                  <th onClick={() => handleSort('name')}           className="p-4 cursor-pointer hover:text-white text-left">Name <SortIndicator sort={sort} col="name" /></th>
                  <th onClick={() => handleSort('playlist_name')}  className="p-4 cursor-pointer hover:text-white">Playlist <SortIndicator sort={sort} col="playlist_name" /></th>
                  <th className="p-4">Target</th>
                  <th onClick={() => handleSort('controller_delay_ms')} className="p-4 cursor-pointer hover:text-white">Delay <SortIndicator sort={sort} col="controller_delay_ms" /></th>
                  <th onClick={() => handleSort('is_active')}      className="p-4 cursor-pointer hover:text-white">Active <SortIndicator sort={sort} col="is_active" /></th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-[14px]">
                {paginated.length > 0 ? paginated.map(b => (
                  <tr key={b.id} className="hover:bg-slate-800/50 transition-colors group">
                    <td className="p-4 font-mono text-slate-400">{b.id}</td>
                    <td className="p-4 text-left">
                      <span className="font-bold text-slate-200">{b.name}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1 text-slate-300">
                        <ListMusic size={12} className="text-indigo-400 shrink-0" />
                        {b.playlist_name || '—'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1 text-slate-300">
                        {b.target_type === 'controller'
                          ? <Server size={12} className="text-cyan-400 shrink-0" />
                          : <Users  size={12} className="text-amber-400 shrink-0" />}
                        {b.target_name || 'All'}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-slate-400 text-xs">
                      {b.controller_delay_ms > 0 ? `${b.controller_delay_ms} ms` : '—'}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleToggle(b.id)}
                        className={`text-xs font-bold px-2 py-1 rounded border cursor-pointer transition-all ${
                          b.is_active
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/40'
                            : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {b.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        {/* Dispatch */}
                        <button
                          onClick={() => handleDispatch(b.id)}
                          disabled={dispatching === b.id}
                          className="cursor-pointer px-3 py-1.5 text-xs font-bold bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white rounded-lg transition-all flex items-center gap-1 disabled:opacity-40"
                        >
                          {dispatching === b.id
                            ? <Loader size={13} className="animate-spin" />
                            : <Play   size={13} />}
                          DISPATCH
                        </button>
                        <button onClick={() => openModal(b)} className="cursor-pointer p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                          <Edit3 size={16} />
                        </button>
                        <button onClick={() => setDeletingId(b.id)} className="cursor-pointer p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-600 italic text-xs">
                      No broadcasts created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-slate-900/50 border-t border-slate-800 px-4 py-3 flex items-center justify-between flex-wrap gap-3 text-xs font-bold text-slate-400">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1) }}
                className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 outline-none cursor-pointer"
              >
                {[5, 10, 25, 50].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button disabled={page === 1}          onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 cursor-pointer"><ChevronLeft  size={16} /></button>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 cursor-pointer"><ChevronRight size={16} /></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <form
            onSubmit={handleSave}
            className="relative bg-slate-900/90 backdrop-blur-md border border-slate-800/60 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
              <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                {editing ? 'Edit Broadcast' : 'New Broadcast'}
              </h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">

              {/* Name */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Broadcast Name</label>
                <input
                  required
                  placeholder="Holiday Show"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Playlist */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-1"><ListMusic size={11} /> Playlist</label>
                <select
                  required
                  value={form.playlist_id}
                  onChange={e => setForm({ ...form, playlist_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                >
                  <option value="" disabled>Select a playlist…</option>
                  {playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Target type toggle */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Send To</label>
                <div className="flex gap-2 mt-1">
                  {['controller', 'group'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, target_type: t, controller_id: '', group_id: '' })}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer transition-all border ${
                        form.target_type === t
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {t === 'controller' ? <><Server size={12} className="inline mr-1" />Controller</> : <><Users size={12} className="inline mr-1" />Group</>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Controller or Group selector */}
              {form.target_type === 'controller' ? (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Controller</label>
                  <select
                    required
                    value={form.controller_id}
                    onChange={e => setForm({ ...form, controller_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                  >
                    <option value="" disabled>Select a controller…</option>
                    {controllers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.ip_address})</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Group</label>
                  <select
                    required
                    value={form.group_id}
                    onChange={e => setForm({ ...form, group_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                  >
                    <option value="" disabled>Select a group…</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
                  </select>
                </div>
              )}

              {/* Delay */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
                  <Clock size={11} /> Inter-Controller Delay (ms)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60000"
                  placeholder="0"
                  value={form.controller_delay_ms}
                  onChange={e => setForm({ ...form, controller_delay_ms: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                />
                <p className="text-[10px] text-slate-600 ml-1 mt-1">
                  Wait this many milliseconds between sending to each controller (0 = simultaneous)
                </p>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-sm font-bold text-slate-200">Active</span>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Include in scheduled playback</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm({ ...form, is_active: e.target.checked })}
                  className="w-6 h-6 rounded border-slate-700 bg-slate-900 text-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="p-6 bg-slate-800/30 border-t border-slate-800">
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/20">
                {editing ? 'UPDATE BROADCAST' : 'SAVE BROADCAST'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Delete Confirmation ──────────────────────────────────────────────── */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setDeletingId(null)} />
          <div className="relative bg-slate-900 border border-rose-500/20 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center">
            <div className="bg-rose-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="text-rose-500" size={32} />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Confirm Deletion</h2>
            <p className="text-slate-400 text-sm mt-3">This will permanently remove this broadcast.</p>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setDeletingId(null)} className="flex-1 bg-slate-800 text-slate-300 font-bold py-3 rounded-xl cursor-pointer">CANCEL</button>
              <button onClick={() => handleDelete(deletingId)} className="flex-1 bg-rose-600 text-white font-bold py-3 rounded-xl cursor-pointer">DELETE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}