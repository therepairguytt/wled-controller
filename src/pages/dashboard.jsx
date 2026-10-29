import { useEffect, useState, useCallback, useRef } from 'react'
import api from '../services/api'
import { getWebSocketUrl } from '../services/websocket'
import {
  Power, Activity, GlobeOff, Wifi, ScrollText, MapPin,
  Sun, RefreshCw, Zap, Play, PlayCircle, ExternalLink, CheckCircle
} from 'lucide-react'

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isApiOnline, setIsApiOnline] = useState(true)
  const [quickActions, setQuickActions] = useState({ presets: [], playlists: [] })
  const [effectsMap, setEffectsMap] = useState({})
  const [groups, setGroups] = useState([])
  const [quickActionSort, setQuickActionSort] = useState('name')
  const [quickTarget, setQuickTarget] = useState('all') // 'all' | 'group:<id>' | 'ctrl:<id>'
  const [actionStatus, setActionStatus] = useState(null)
  const ws = useRef(null)

  const loadMetadata = useCallback(async () => {
    try {
      const [presRes, playRes, effRes, grpRes] = await Promise.all([
        api.get('/api/presets'),
        api.get('/api/playlists'),
        api.get('/api/effects'),
        api.get('/api/groups'),
      ])
      setQuickActions({ presets: presRes.data || [], playlists: playRes.data || [] })
      const map = {}
      for (const e of effRes.data || []) {
        map[e.effect_id] = e.name
      }
      setEffectsMap(map)
      setGroups(grpRes.data || [])
    } catch (e) {
      console.error(e)
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/dashboard')
      setDashboard(res.data)
      setIsApiOnline(true)
    } catch (err) {
      console.error('Dashboard Load Error:', err)
      setIsApiOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const formatUptime = (seconds) => {
    if (!seconds && seconds !== 0) return 'NA'
    const totalSec = Number(seconds)
    if (isNaN(totalSec) || totalSec <= 0) return 'NA'
    const days = Math.floor(totalSec / 86400)
    const hours = Math.floor((totalSec % 86400) / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h ${mins}m`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m ${totalSec % 60}s`
  }

  useEffect(() => {
    let socket
    let retryTimer
    let cancelled = false

    const connect = () => {
      if (cancelled) return
      socket = new WebSocket(getWebSocketUrl())

      socket.onopen = () => console.log('Connected to WLED Broadcast Service')

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'power_toggle') {
            setDashboard(prev => {
              if (!prev) return prev
              return {
                ...prev,
                controllers: prev.controllers.map(c =>
                  c.id === message.controller_id ? { ...c, led_on: message.on } : c
                )
              }
            })
          } else if (message.type === 'controller_status') {
            setDashboard(prev => {
              if (!prev) return prev
              const updated = prev.controllers.map(c =>
                c.id === message.controller_id ? { ...c, is_online: message.is_online } : c
              )
              return {
                ...prev,
                controllers: updated,
                online: updated.filter(c => c.is_online).length,
                offline: updated.filter(c => !c.is_online).length,
              }
            })
          } else if (message.type === 'master_power_toggle') {
            setDashboard(prev => {
              if (!prev) return prev
              return {
                ...prev,
                controllers: prev.controllers.map(c => ({ ...c, led_on: message.on }))
              }
            })
          } else if (['controller_updated', 'controller_created', 'controller_deleted'].includes(message.type)) {
            load()
          } else if (['preset_created', 'preset_updated', 'preset_deleted', 'playlist_created', 'playlist_updated', 'playlist_deleted'].includes(message.type)) {
            loadMetadata()
          }
        } catch (err) {
          console.error('WS parse error', err)
        }
      }

      socket.onclose = () => {
        if (!cancelled) {
          retryTimer = setTimeout(connect, 5000)
        }
      }

      socket.onerror = () => socket.close()
      ws.current = socket
    }

    connect()

    return () => {
      cancelled = true
      clearTimeout(retryTimer)
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close()
      }
    }
  }, [load, loadMetadata])

  useEffect(() => {
    load()
    loadMetadata()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load, loadMetadata])

  const getTargetPayload = () => {
    if (quickTarget.startsWith('group:')) {
      return { group_id: parseInt(quickTarget.split(':')[1], 10) }
    }
    if (quickTarget.startsWith('ctrl:')) {
      return { controller_id: parseInt(quickTarget.split(':')[1], 10) }
    }
    return {}
  }

  const showToast = (msg) => {
    setActionStatus(msg)
    setTimeout(() => setActionStatus(null), 4000)
  }

  const triggerPreset = async (preset) => {
    try {
      const res = await api.post(`/api/presets/${preset.id}/apply`, getTargetPayload())
      showToast(`Applied preset "${preset.name}" (${res.data.controllers_succeeded}/${res.data.controllers_targeted} online)`)
      load()
    } catch (err) {
      showToast(`Failed to apply "${preset.name}": ${err.response?.data?.detail || err.message}`)
    }
  }

  const triggerPlaylist = async (playlist) => {
    try {
      await api.post(`/api/playlists/${playlist.id}/activate`, getTargetPayload())
      showToast(`Activated playlist "${playlist.name}"`)
    } catch (err) {
      showToast(`Failed to start "${playlist.name}": ${err.response?.data?.detail || err.message}`)
    }
  }

  const toggleMasterPower = async (on) => {
    try {
      await api.post('/api/controllers/master-power', { on })
      load()
    } catch (err) {
      console.error(err)
    }
  }

  const togglePower = async (ctrl) => {
    try {
      await api.post(`/api/controllers/${ctrl.id}/toggle`, { on: !ctrl.led_on })
    } catch (err) {
      console.error('Device unreachable via API')
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-slate-500 animate-pulse font-mono text-[10px] tracking-[0.4em] uppercase">
          Mapping Grid...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto p-4 flex-1 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
            <Activity size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Live Dashboard</h1>
            <p className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest">WLED v0.16.1 Ready</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => toggleMasterPower(true)} className="px-4 py-2 bg-emerald-500/20 hover:cursor-pointer hover:bg-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold transition-colors shadow-[0_0_15px_rgba(16,185,129,0.1)]">ALL ON</button>
          <button onClick={() => toggleMasterPower(false)} className="px-4 py-2 bg-rose-500/20 hover:cursor-pointer hover:bg-rose-500/30 text-rose-400 rounded-xl text-xs font-bold transition-colors shadow-[0_0_15px_rgba(244,63,94,0.1)]">ALL OFF</button>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:cursor-pointer hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            REFRESH
          </button>
        </div>
      </div>

      {actionStatus && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono">
          <CheckCircle size={15} className="text-indigo-400 shrink-0" />
          <span>{actionStatus}</span>
        </div>
      )}

      {!dashboard ? (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-rose-500/20 shadow-xl p-12 rounded-3xl text-center">
          <GlobeOff className="mx-auto text-rose-500 mb-4 animate-bounce" size={40} />
          <h3 className="text-rose-500 font-black uppercase tracking-widest text-sm">System Offline</h3>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-center">
            <Tile label="Online" value={dashboard.online} color="text-emerald-400" icon={<Wifi size={14} />} />
            <Tile label="Offline" value={dashboard.offline} color="text-rose-400" icon={<GlobeOff size={14} />} />
            <Tile label="Total" value={dashboard.total} icon={<ScrollText size={14} />} />
            <Tile label="Total LED Power" value={`${(dashboard.total_power / 1000).toFixed(1)}A`} color="text-amber-400" icon={<Zap size={14} />} />
            <Tile label="API" value={isApiOnline ? 'ONLINE' : 'OFFLINE'} color="text-sky-400" icon={<Activity size={14} />} />
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 shadow-xl rounded-3xl p-6">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h3 className="text-slate-100 font-black uppercase text-sm tracking-tight flex items-center gap-2">
                <PlayCircle size={16} className="text-indigo-400" /> Quick Actions
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={quickTarget}
                  onChange={e => setQuickTarget(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 outline-none"
                  title="Target controllers for Quick Actions"
                >
                  <option value="all">Target: All Active Controllers</option>
                  {groups.length > 0 && (
                    <optgroup label="Groups">
                      {groups.map(g => (
                        <option key={`g-${g.id}`} value={`group:${g.id}`}>Group: {g.group_name}</option>
                      ))}
                    </optgroup>
                  )}
                  {dashboard.controllers?.length > 0 && (
                    <optgroup label="Controllers">
                      {dashboard.controllers.map(c => (
                        <option key={`c-${c.id}`} value={`ctrl:${c.id}`}>{c.name} ({c.ip_address})</option>
                      ))}
                    </optgroup>
                  )}
                </select>

                <select
                  value={quickActionSort}
                  onChange={e => setQuickActionSort(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 outline-none"
                >
                  <option value="name">Sort by Name</option>
                  <option value="id">Sort by Newest</option>
                </select>
              </div>
            </div>

            {quickActions.presets.length === 0 && quickActions.playlists.length === 0 ? (
              <div className="text-xs text-slate-500 italic py-4 text-center">
                Create presets or playlists to trigger them with one click from here.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {[...quickActions.presets]
                  .sort((a, b) => quickActionSort === 'name' ? a.name.localeCompare(b.name) : b.id - a.id)
                  .slice(0, 6)
                  .map(p => (
                    <button
                      key={`preset-${p.id}`}
                      onClick={() => triggerPreset(p)}
                      className="cursor-pointer bg-slate-800/50 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-300 border border-slate-700 hover:border-indigo-500/40 p-3 rounded-xl transition-all text-xs font-bold text-left truncate flex flex-col gap-1 group"
                    >
                      <span className="text-[9px] uppercase tracking-wider text-indigo-400 flex items-center justify-between">
                        <span>Preset</span>
                        <Play size={10} className="opacity-60 group-hover:opacity-100" />
                      </span>
                      <span className="truncate w-full">{p.name}</span>
                    </button>
                  ))}
                {[...quickActions.playlists]
                  .sort((a, b) => quickActionSort === 'name' ? a.name.localeCompare(b.name) : b.id - a.id)
                  .slice(0, 6)
                  .map(p => (
                    <button
                      key={`playlist-${p.id}`}
                      onClick={() => triggerPlaylist(p)}
                      className="cursor-pointer bg-slate-800/50 hover:bg-rose-600/20 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 p-3 rounded-xl transition-all text-xs font-bold text-left truncate flex flex-col gap-1 group"
                    >
                      <span className="text-[9px] uppercase tracking-wider text-rose-400 flex items-center justify-between">
                        <span>Playlist</span>
                        <Play size={10} className="opacity-60 group-hover:opacity-100" />
                      </span>
                      <span className="truncate w-full">{p.name}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-xl">
            <div className="table-wrapper">
              <table className="w-full text-center text-sm table-auto min-w-max">
                <thead className="bg-slate-800/95 text-slate-400 font-bold uppercase text-[13px] tracking-widest select-none">
                  <tr>
                    <th className="p-4 text-left">Controller</th>
                    <th className="p-4 text-center">IP Address</th>
                    <th className="p-4 text-center">Group</th>
                    <th className="p-4 text-center">Now Playing</th>
                    <th className="p-4 text-center">Health</th>
                    <th className="p-4 text-center">Uptime</th>
                    <th className="p-4 text-center">Brightness</th>
                    <th className="p-4 text-right">Power</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-center text-[14px]">
                  {dashboard.controllers.length > 0 ? (
                    dashboard.controllers.map(ctrl => (
                      <tr key={ctrl.id} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="p-4 text-left">
                          <div className="font-bold text-slate-200">{ctrl.name}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase mt-1">
                            <MapPin size={10} /> {ctrl.location || 'Unknown'}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <a className="inline-flex items-center gap-1 cursor-pointer hover:text-white hover:bg-indigo-800 hover:font-bold hover:underline hover:rounded transition-all ml-1 font-mono text-xs text-slate-300" href={`http://${ctrl.ip_address}`} target="_blank" rel="noopener noreferrer">
                            {ctrl.ip_address} <ExternalLink size={12} />
                          </a>
                        </td>
                        <td className="p-4 text-center">
                          <span className="px-2 py-1 bg-slate-800 rounded text-[10px] font-bold text-indigo-400 border border-slate-700 uppercase">
                            {ctrl.group?.group_name || 'No Group'}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {(() => {
                            const state = ctrl.live_data?.state
                            const info = ctrl.live_data?.info
                            if (!state || !info) return <span className="text-slate-600 text-xs">Waiting...</span>
                            const fxId = state.seg?.[0]?.fx ?? 0
                            const fxName = effectsMap[fxId] || info.fx?.[fxId] || `Effect #${fxId}`
                            const col = state.seg?.[0]?.col?.[0] || [0, 0, 0]
                            return (
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: `rgb(${col[0]},${col[1]},${col[2]})` }}></div>
                                  <span className="text-xs font-bold text-slate-300">{fxName}</span>
                                </div>
                              </div>
                            )
                          })()}
                        </td>
                        <td className="p-4 text-center">
                          {(() => {
                            const info = ctrl.live_data?.info
                            if (!info) return <span className="text-slate-600 text-xs">-</span>
                            const rssi = info.wifi?.signal || 0
                            const pwr = info.leds?.pwr || 0
                            const ver = info.ver
                            return (
                              <div className="flex flex-col items-center gap-1 text-[10px] font-mono text-slate-400">
                                <div className="flex items-center gap-1" title="Signal Strength"><Wifi size={10} className={rssi > 70 ? 'text-emerald-400' : 'text-amber-400'} /> {rssi}%</div>
                                <div className="flex items-center gap-1" title="Estimated Power"><Zap size={10} className="text-amber-500" /> {pwr}mA</div>
                                {ver && <div className="text-[9px] text-indigo-400/80">v{ver}</div>}
                              </div>
                            )
                          })()}
                        </td>
                        <td className="p-4 text-center">
                          <div className="font-bold text-slate-200 font-mono text-xs">
                            {formatUptime(ctrl.live_data?.info?.uptime)}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2 text-slate-400 font-mono text-xs">
                            <Sun size={14} className={ctrl.led_on ? 'text-amber-500' : 'text-slate-700'} />
                            {Math.round((ctrl.main_brightness / 255) * 100)}%
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => togglePower(ctrl)}
                            title={"• Green -> Device Online & LEDs On\n• Yellow -> Device Online & LEDs Off\n• Red -> Device Offline"}
                            disabled={!ctrl.is_online}
                            className={`p-3 rounded-2xl hover:cursor-pointer transition-all ${!ctrl.is_online ? 'opacity-20 cursor-not-allowed bg-red-800' :
                              ctrl.led_on
                                ? 'bg-emerald-600 hover:bg-emerald-600/60 text-white'
                                : 'bg-amber-600 hover:bg-amber-600/60 text-slate-900'
                              }`}
                          >
                            <Power size={18} strokeWidth={3} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="8"
                        className="p-8 text-center text-slate-400 italic text-sm bg-slate-900"
                      >
                        No controllers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Tile({ label, value, color = 'text-white', icon }) {
  return (
    <div className="bg-slate-900/60 backdrop-blur-xl rounded-3xl p-6 border border-slate-800/60 shadow-lg">
      <div className="flex justify-between items-start mb-4">
        <span className="text-slate-500 text-[9px] font-black uppercase">{label}</span>
        <span className="text-slate-700">{icon}</span>
      </div>
      <div className={`text-3xl font-black ${color}`}>{value}</div>
    </div>
  )
}
