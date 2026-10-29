import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../services/api'
import {
  CalendarCheck, Plus, X, Trash2, Edit3, Clock, Radio,
  CheckCircle, Moon, Sun, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react'

const DAYS = [
  { id: '0', short: 'Mon', full: 'Monday' },
  { id: '1', short: 'Tue', full: 'Tuesday' },
  { id: '2', short: 'Wed', full: 'Wednesday' },
  { id: '3', short: 'Thu', full: 'Thursday' },
  { id: '4', short: 'Fri', full: 'Friday' },
  { id: '5', short: 'Sat', full: 'Saturday' },
  { id: '6', short: 'Sun', full: 'Sunday' },
]

export default function Schedule() {
  const [schedules, setSchedules] = useState([])
  const [broadcasts, setBroadcasts] = useState([])
  const [loading, setLoading] = useState(true)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const defaultForm = {
    broadcast_id: '',
    start_time: '18:00',
    end_time: '23:00',
    days_of_week: '0,1,2,3,4,5,6',
    is_enabled: true,
  }
  const [form, setForm] = useState(defaultForm)

  const [sort, setSort] = useState({ column: 'id', direction: 'asc' })
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const fetchAll = useCallback(async () => {
    try {
      const [sRes, bRes] = await Promise.all([
        api.get('/api/schedules'),
        api.get('/api/broadcasts'),
      ])
      setSchedules(sRes.data || [])
      setBroadcasts(bRes.data || [])
    } catch (err) {
      console.error('Failed to load schedule data', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleSort = (col) => {
    setSort(prev => ({
      column: col,
      direction: prev.column === col && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
    setPage(1)
  }

  const sorted = useMemo(() => {
    const items = [...schedules]
    items.sort((a, b) => {
      let av = a[sort.column], bv = b[sort.column]
      if (typeof av === 'boolean') return sort.direction === 'asc' ? (av === bv ? 0 : av ? 1 : -1) : (av === bv ? 0 : av ? -1 : 1)
      if (typeof av === 'number') return sort.direction === 'asc' ? av - bv : bv - av
      av = (av || '').toString().toLowerCase()
      bv = (bv || '').toString().toLowerCase()
      return sort.direction === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return items
  }, [schedules, sort])

  const totalPages = Math.ceil(sorted.length / rowsPerPage) || 1
  const paginated = useMemo(
    () => sorted.slice((page - 1) * rowsPerPage, page * rowsPerPage),
    [sorted, page, rowsPerPage]
  )

  const openModal = (s = null) => {
    if (s) {
      setEditing(s)
      setForm({
        broadcast_id: s.broadcast_id,
        start_time: s.start_time,
        end_time: s.end_time,
        days_of_week: s.days_of_week,
        is_enabled: s.is_enabled,
      })
    } else {
      setEditing(null)
      setForm({
        ...defaultForm,
        broadcast_id: broadcasts[0]?.id || '',
      })
    }
    setIsModalOpen(true)
  }

  const toggleDay = (dayId) => {
    const current = form.days_of_week ? form.days_of_week.split(',').filter(Boolean) : []
    const next = current.includes(dayId)
      ? current.filter(d => d !== dayId)
      : [...current, dayId].sort()
    setForm({ ...form, days_of_week: next.join(',') })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.broadcast_id) {
      alert('Please select a broadcast.')
      return
    }
    if (!form.days_of_week) {
      alert('Please select at least one day of the week.')
      return
    }
    const payload = {
      broadcast_id: parseInt(form.broadcast_id, 10),
      start_time: form.start_time,
      end_time: form.end_time,
      days_of_week: form.days_of_week,
      is_enabled: form.is_enabled,
    }
    try {
      if (editing) {
        await api.put(`/api/schedules/${editing.id}`, payload)
      } else {
        await api.post('/api/schedules', payload)
      }
      fetchAll()
      setIsModalOpen(false)
    } catch (err) {
      alert('Error saving schedule: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/schedules/${id}`)
      fetchAll()
      setDeletingId(null)
    } catch {
      alert('Error deleting schedule.')
    }
  }

  const handleToggle = async (id) => {
    try {
      await api.post(`/api/schedules/${id}/toggle`)
      fetchAll()
    } catch (err) {
      console.error('Failed to toggle schedule', err)
    }
  }

  const SortIndicator = ({ col }) => {
    if (sort.column !== col) return <ArrowUpDown size={13} className="opacity-30 inline ml-1" />
    return sort.direction === 'asc'
      ? <ArrowUp size={13} className="text-indigo-400 inline ml-1" />
      : <ArrowDown size={13} className="text-indigo-400 inline ml-1" />
  }

  const isOvernight = (start, end) => start > end

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto p-4 flex-1 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
            <CalendarCheck size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Broadcast Schedules</h1>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
              Automated UTC Time-of-Day & Day-of-Week Rules
            </p>
          </div>
        </div>
      </div>

      {/* Summary Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4">
          <div className="text-[10px] font-black uppercase text-slate-500">Total Schedules</div>
          <div className="text-2xl font-black text-white mt-1">{schedules.length}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4">
          <div className="text-[10px] font-black uppercase text-slate-500">Enabled Rules</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            {schedules.filter(s => s.is_enabled).length}
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4">
          <div className="text-[10px] font-black uppercase text-slate-500">Overnight Spans</div>
          <div className="text-2xl font-black text-amber-400 mt-1">
            {schedules.filter(s => isOvernight(s.start_time, s.end_time)).length}
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4">
          <div className="text-[10px] font-black uppercase text-slate-500">Available Broadcasts</div>
          <div className="text-2xl font-black text-indigo-400 mt-1">{broadcasts.length}</div>
        </div>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800/60 p-6 shadow-xl">
        <div className="flex justify-between pb-4 items-baseline flex-wrap gap-2">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Scheduled Automation Rules</h3>
          <button
            onClick={() => openModal()}
            disabled={broadcasts.length === 0}
            title={broadcasts.length === 0 ? 'Create a Broadcast first' : 'Create a new schedule'}
            className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={16} /> CREATE SCHEDULE
          </button>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-xl">
          <div className="table-wrapper">
            <table className="w-full text-center text-sm table-auto min-w-max">
              <thead className="bg-slate-800/95 text-slate-400 font-bold uppercase text-[13px] tracking-widest select-none">
                <tr>
                  <th onClick={() => handleSort('id')} className="p-4 cursor-pointer hover:text-white">ID <SortIndicator col="id" /></th>
                  <th onClick={() => handleSort('broadcast_name')} className="p-4 cursor-pointer hover:text-white text-left">Broadcast <SortIndicator col="broadcast_name" /></th>
                  <th onClick={() => handleSort('start_time')} className="p-4 cursor-pointer hover:text-white">Time Window <SortIndicator col="start_time" /></th>
                  <th className="p-4">Active Days</th>
                  <th onClick={() => handleSort('is_enabled')} className="p-4 cursor-pointer hover:text-white">Status <SortIndicator col="is_enabled" /></th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-[14px]">
                {paginated.length > 0 ? paginated.map(s => {
                  const activeDays = (s.days_of_week || '').split(',').map(d => d.trim())
                  const overnight = isOvernight(s.start_time, s.end_time)
                  return (
                    <tr key={s.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-mono text-slate-400">{s.id}</td>
                      <td className="p-4 text-left">
                        <div className="font-bold text-slate-200 flex items-center gap-1.5">
                          <Radio size={13} className="text-indigo-400 shrink-0" />
                          {s.broadcast_name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono uppercase mt-0.5">
                          Playlist: {s.playlist_name || '—'} • Target: {s.target_name || 'All'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="inline-flex items-center gap-2 font-mono text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-200">
                          <Clock size={12} className="text-indigo-400" />
                          <span>{s.start_time}</span>
                          <span className="text-slate-600">→</span>
                          <span>{s.end_time}</span>
                          {overnight ? (
                            <span title="Wraps past midnight" className="text-amber-400 flex items-center gap-0.5 text-[10px]">
                              <Moon size={11} /> +1d
                            </span>
                          ) : (
                            <Sun size={11} className="text-sky-400" />
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1">
                          {DAYS.map(d => {
                            const on = activeDays.includes(d.id)
                            return (
                              <span
                                key={d.id}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                  on
                                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                                    : 'bg-slate-900 text-slate-600 border-slate-800'
                                }`}
                              >
                                {d.short}
                              </span>
                            )
                          })}
                        </div>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleToggle(s.id)}
                          className={`text-xs font-bold px-2.5 py-1 rounded border cursor-pointer transition-all ${
                            s.is_enabled
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/40'
                              : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {s.is_enabled ? 'ENABLED' : 'DISABLED'}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button onClick={() => openModal(s)} className="cursor-pointer p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                            <Edit3 size={16} />
                          </button>
                          <button onClick={() => setDeletingId(s.id)} className="cursor-pointer p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-600 italic text-xs">
                      {loading ? 'Loading schedules...' : broadcasts.length === 0 ? 'Create a Broadcast first before scheduling.' : 'No schedules configured yet.'}
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
                className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 outline-none cursor-pointer"
              >
                {[5, 10, 25, 50].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 cursor-pointer"><ChevronLeft size={16} /></button>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 cursor-pointer"><ChevronRight size={16} /></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <form
            onSubmit={handleSave}
            className="relative bg-slate-900/90 backdrop-blur-md border border-slate-800/60 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
              <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                {editing ? 'Edit Schedule' : 'New Schedule'}
              </h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Target Broadcast</label>
                <select
                  required
                  value={form.broadcast_id}
                  onChange={e => setForm({ ...form, broadcast_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                >
                  <option value="" disabled>Select a broadcast…</option>
                  {broadcasts.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.playlist_name || 'Playlist'} → {b.target_name || 'All'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Start Time (24h)</label>
                  <input
                    type="time"
                    required
                    value={form.start_time}
                    onChange={e => setForm({ ...form, start_time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">End Time (24h)</label>
                  <input
                    type="time"
                    required
                    value={form.end_time}
                    onChange={e => setForm({ ...form, end_time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none font-mono"
                  />
                </div>
              </div>

              {isOvernight(form.start_time, form.end_time) && (
                <div className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
                  <Moon size={14} /> Overnight schedule detected: runs from {form.start_time} until {form.end_time} the next day.
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Days of Week</label>
                  <div className="flex gap-2 text-[10px] font-bold">
                    <button type="button" onClick={() => setForm({ ...form, days_of_week: '0,1,2,3,4,5,6' })} className="text-indigo-400 hover:underline cursor-pointer">All</button>
                    <button type="button" onClick={() => setForm({ ...form, days_of_week: '0,1,2,3,4' })} className="text-slate-400 hover:text-white cursor-pointer">Weekdays</button>
                    <button type="button" onClick={() => setForm({ ...form, days_of_week: '5,6' })} className="text-slate-400 hover:text-white cursor-pointer">Weekends</button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS.map(d => {
                    const selected = (form.days_of_week || '').split(',').includes(d.id)
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDay(d.id)}
                        className={`py-2.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer border ${
                          selected
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                            : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {d.short}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-sm font-bold text-slate-200">Enable Schedule</span>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Automatically toggle broadcast during window</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.is_enabled}
                  onChange={e => setForm({ ...form, is_enabled: e.target.checked })}
                  className="w-6 h-6 rounded border-slate-700 bg-slate-900 text-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="p-6 bg-slate-800/30 border-t border-slate-800">
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/20">
                {editing ? 'UPDATE SCHEDULE' : 'SAVE SCHEDULE'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setDeletingId(null)} />
          <div className="relative bg-slate-900 border border-rose-500/20 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center">
            <div className="bg-rose-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="text-rose-500" size={32} />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Confirm Deletion</h2>
            <p className="text-slate-400 text-sm mt-3">This will permanently remove this schedule rule.</p>
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
