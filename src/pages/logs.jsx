import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { ScrollText, RefreshCw, Trash2, Wifi, WifiOff, Plus, Pencil, Trash, Zap, Power, RotateCcw, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react'

const LEVEL_CONFIG = {
  SUCCESS: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: <CheckCircle size={13} /> },
  INFO: { color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', icon: <Info size={13} /> },
  WARN: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: <AlertTriangle size={13} /> },
  ERROR: { color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', icon: <XCircle size={13} /> },
}

const CATEGORY_CONFIG = {
  controller: { label: 'Controller', icon: <Wifi size={12} />, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  group: { label: 'Group', icon: <ScrollText size={12} />, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  segment: { label: 'Segment', icon: <Zap size={12} />, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  power: { label: 'Power', icon: <Power size={12} />, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  system: { label: 'System', icon: <RotateCcw size={12} />, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
}

const ACTION_ICON = {
  created: <Plus size={12} />,
  updated: <Pencil size={12} />,
  deleted: <Trash size={12} />,
  online: <Wifi size={12} />,
  offline: <WifiOff size={12} />,
  toggled: <Power size={12} />,
  rebooted: <RotateCcw size={12} />,
}

function formatTime(isoString) {
  const d = new Date(isoString)
  return d.toLocaleString('en-US', {
    month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  })
}

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterLevel, setFilterLevel] = useState('ALL')
  const [filterCategory, setFilterCategory] = useState('ALL')
  const [clearing, setClearing] = useState(false)

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.get('/api/logs?limit=500')
      setLogs(res.data)
    } catch (err) {
      console.error('Failed to fetch logs', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 15000)
    return () => clearInterval(interval)
  }, [fetchLogs])

  const handleClear = async () => {
    if (!window.confirm('Clear all system logs? This cannot be undone.')) return
    setClearing(true)
    try {
      await api.delete('/api/logs')
      setLogs([])
    } catch (err) {
      alert('Failed to clear logs.')
    } finally {
      setClearing(false)
    }
  }

  const filtered = logs.filter(l => {
    const lvlOk = filterLevel === 'ALL' || l.level === filterLevel
    const catOk = filterCategory === 'ALL' || l.category === filterCategory
    return lvlOk && catOk
  })

  const counts = {
    SUCCESS: logs.filter(l => l.level === 'SUCCESS').length,
    INFO: logs.filter(l => l.level === 'INFO').length,
    WARN: logs.filter(l => l.level === 'WARN').length,
    ERROR: logs.filter(l => l.level === 'ERROR').length,
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
            <ScrollText size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-100 uppercase tracking-tight">System Logs</h1>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-0.5">{logs.length} total events</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-300 text-xs font-bold rounded-xl transition-all"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            onClick={handleClear}
            disabled={clearing || logs.length === 0}
            className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-400 text-xs font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={13} /> Clear All
          </button>
        </div>
      </div>

      {/* Summary Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(counts).map(([level, count]) => {
          const cfg = LEVEL_CONFIG[level]
          return (
            <button
              key={level}
              onClick={() => setFilterLevel(prev => prev === level ? 'ALL' : level)}
              className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${filterLevel === level
                  ? `${cfg.bg} ring-1 ring-current ${cfg.color}`
                  : 'bg-slate-900/60 border-slate-800/60 hover:border-slate-700'
                }`}
            >
              <div>
                <div className={`text-2xl font-black ${cfg.color}`}>{count}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{level}</div>
              </div>
              <span className={cfg.color}>{cfg.icon}</span>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mr-1">Category:</span>
        {['ALL', ...Object.keys(CATEGORY_CONFIG)].map(cat => {
          const cfg = CATEGORY_CONFIG[cat]
          const active = filterCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${active
                  ? cat === 'ALL'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : `${cfg.color} border-current bg-current/5`
                  : 'bg-slate-900/60 border-slate-800/60 text-slate-500 hover:border-slate-600'
                }`}
            >
              {cfg && <span>{cfg.icon}</span>}
              {cat === 'ALL' ? 'All' : cfg.label}
            </button>
          )
        })}
      </div>

      {/* Log Table */}
      <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800/60 shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-mono text-[10px] uppercase tracking-widest animate-pulse">
            Loading logs...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ScrollText className="mx-auto text-slate-700 mb-3" size={32} />
            <p className="text-slate-500 text-xs font-mono uppercase tracking-widest">No log entries found.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filtered.map(log => {
              const lvl = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.INFO
              const cat = CATEGORY_CONFIG[log.category] || CATEGORY_CONFIG.system
              const actionIcon = ACTION_ICON[log.action]
              return (
                <div key={log.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-800/20 transition-colors group">

                  {/* Level indicator */}
                  <div className={`mt-0.5 shrink-0 flex items-center gap-1 text-[10px] font-black uppercase w-20 ${lvl.color}`}>
                    {lvl.icon}
                    <span>{log.level}</span>
                  </div>

                  {/* Message */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 leading-snug">{log.message}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {/* Category badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${cat.color}`}>
                        {cat.icon} {cat.label}
                      </span>
                      {/* Action badge */}
                      {actionIcon && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-700 bg-slate-800/50 text-[9px] font-black uppercase tracking-wider text-slate-400">
                          {actionIcon} {log.action}
                        </span>
                      )}
                      {/* Target name */}
                      {log.target_name && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          → {log.target_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="shrink-0 text-[10px] text-slate-600 font-mono text-right mt-0.5 group-hover:text-slate-400 transition-colors whitespace-nowrap">
                    {formatTime(log.created_on)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
