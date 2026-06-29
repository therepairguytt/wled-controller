import { useEffect, useState, useCallback, useRef } from 'react'
import api from '../services/api'
import { Power, Activity, GlobeOff, Wifi, ScrollText, MapPin, Sun, RefreshCw } from 'lucide-react'

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isApiOnline, setIsApiOnline] = useState(true)
  const ws = useRef(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/dashboard')
      setDashboard(res.data)
      setIsApiOnline(true)
    } catch (err) {
      console.error("Dashboard Load Error:", err)
      setIsApiOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let socket;
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = import.meta.env.VITE_API_HOST;
      const wsPort = parseInt(import.meta.env.VITE_API_PORT);
      socket = new WebSocket(`${protocol}//${wsHost}:${wsPort}/ws`);

      socket.onopen = () => console.log("Connected to WLED Broadcast Service");

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'power_toggle') {
          setDashboard(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              controllers: prev.controllers.map(c =>
                c.id === message.controller_id ? { ...c, led_on: message.on } : c
              )
            };
          });
        } else if (message.type === 'controller_status') {
          setDashboard(prev => {
            if (!prev) return prev;
            const updated = prev.controllers.map(c =>
              c.id === message.controller_id ? { ...c, is_online: message.is_online } : c
            );
            return {
              ...prev,
              controllers: updated,
              online: updated.filter(c => c.is_online).length,
              offline: updated.filter(c => !c.is_online).length,
            };
          });
        } else if (['controller_updated', 'controller_created', 'controller_deleted'].includes(message.type)) {
          load();
        }
      };

      socket.onclose = (e) => {
        console.log("Socket closed. Retry in 3s...", e.reason);
        setTimeout(connect, 3000);
      };

      socket.onerror = (err) => console.error("Socket error", err);
      ws.current = socket;
    };

    connect();

    return () => {
      if (socket) {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      }
    };
  }, [load]);

  useEffect(() => {
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load])

  const togglePower = async (ctrl) => {
    try {
      await api.post(`/api/controllers/${ctrl.id}/toggle`, { on: !ctrl.led_on })
    } catch (err) {
      console.error("Device unreachable via API");
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
            <Activity size={24} />
          </div>
          <h1 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Live Dashboard</h1>
        </div>
        <button 
          onClick={load} 
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          REFRESH
        </button>
      </div>
      {!dashboard ? (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-rose-500/20 shadow-xl p-12 rounded-3xl text-center">
          <GlobeOff className="mx-auto text-rose-500 mb-4 animate-bounce" size={40} />
          <h3 className="text-rose-500 font-black uppercase tracking-widest text-sm">System Offline</h3>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            <Tile label="Online" value={dashboard.online} color="text-emerald-400" icon={<Wifi size={14} />} />
            <Tile label="Offline" value={dashboard.offline} color="text-rose-400" icon={<GlobeOff size={14} />} />
            <Tile label="Total" value={dashboard.total} icon={<ScrollText size={14} />} />
            <Tile label="API" value={isApiOnline ? "ONLINE" : "OFFLINE"} color="text-sky-400" icon={<Activity size={14} />} />
          </div>



          <div className="bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-800/60 overflow-hidden shadow-xl">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800/30 text-slate-500 uppercase text-[9px] font-black tracking-[0.2em]">
                <tr className="text-center">
                  <th className="p-5">Controller</th>
                  <th className="p-5 text-center">Group</th>
                  <th className="p-5 text-center">Brightness</th>
                  <th className="p-5 text-right">Power</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {dashboard.controllers.length > 0 ? (
                  dashboard.controllers.map(ctrl => (
                    <tr key={ctrl.id} className="hover:bg-white/1 transition-colors group text-center">
                      <td className="p-5">
                        <div className="font-bold text-slate-100">{ctrl.name}</div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase mt-1">
                          <MapPin size={10} /> {ctrl.location || 'Unknown'}
                        </div>
                      </td>
                      <td className="p-5 text-center">
                        <span className="px-2 py-1 bg-slate-800/50 rounded text-[10px] font-bold text-indigo-400 border border-slate-700/50 uppercase">
                          {ctrl.group?.group_name || "No Group"}
                        </span>
                      </td>
                      <td className="p-5 text-center">
                        <div className="flex items-center justify-center gap-2 text-slate-400 font-mono text-xs">
                          <Sun size={14} className={ctrl.led_on ? "text-amber-500" : "text-slate-700"} />
                          {Math.round((ctrl.main_brightness / 255) * 100)}%
                        </div>
                      </td>
                      <td className="p-5 text-right">
                        <button
                          onClick={() => togglePower(ctrl)}
                          disabled={!ctrl.is_online}
                          className={`p-3 rounded-2xl transition-all ${!ctrl.is_online ? 'opacity-20 cursor-not-allowed bg-slate-800' :
                              ctrl.led_on
                                ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                                : 'bg-slate-800 text-slate-500'
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
                      colSpan="4"
                      className="p-8 text-center text-slate-400 italic text-m bg-slate-600/10 justify-items-center"
                    >
                      No controllers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function Tile({ label, value, color = "text-white", icon }) {
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