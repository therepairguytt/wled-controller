import { useState } from 'react'
import api from '../services/api'
import { Search, Server, Info, Settings, Network, Cpu, Wifi, Activity, Sun, ClockArrowUp, Mic, Zap } from 'lucide-react'

export default function Query() {
  const [ip, setIp] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const search = async () => {
    if (!ip) return;
    setLoading(true)
    try {
      const res = await api.get(`/api/query/${ip}`)
      setResult(res.data)
    } catch (e) {
      console.error(e)
      setResult({ error: "Failed to connect to IP." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto p-4 flex-1 overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
            <Search size={24} />
          </div>
          <h1 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Query Controller</h1>
        </div>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-6 shadow-xl">
        <div className="flex gap-4">
          <input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="Enter IP Address (e.g. 192.168.1.100)"
            className="flex-1 bg-slate-950 border border-slate-700/50 rounded-xl p-4 text-sm font-bold text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600"
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
          <button
            onClick={search}
            disabled={loading || !ip}
            className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-8 py-3 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] uppercase tracking-wider"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Search size={16} />}
            Query
          </button>
        </div>
      </div>

      {result && !result.error && (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-xl">
          <div className="p-4 bg-slate-800/50 border-b border-slate-800 flex items-center gap-2 text-sm font-bold text-slate-300 uppercase tracking-wider">
            <Server size={16} className="text-indigo-400" /> System Info
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm table-auto min-w-max">
              <thead className="bg-slate-800/30 text-slate-500 font-bold uppercase text-[11px] tracking-widest select-none">
                <tr>
                  <th className="p-4 w-1/3">Property</th>
                  <th className="p-4">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-[13px] text-slate-300">
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-bold text-slate-400 flex items-center gap-3"><Settings size={14} className="text-slate-500" /> Name</td>
                  <td className="p-4 font-bold text-slate-200">{result.info?.name || result.name || "Unknown"}</td>
                </tr>
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-bold text-slate-400 flex items-center gap-3"><Network size={14} className="text-slate-500" /> MAC Address</td>
                  <td className="p-4 font-bold text-slate-200">{result.info?.mac || result.mac || "Unknown"}</td>
                </tr>
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-bold text-slate-400 flex items-center gap-3"><Info size={14} className="text-slate-500" /> Version</td>
                  <td className="p-4 font-bold text-slate-200">{result.info?.ver || result.ver || "Unknown"}</td>
                </tr>
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-bold text-slate-400 flex items-center gap-3"><Activity size={14} className="text-slate-500" /> LED Count</td>
                  <td className="p-4 font-bold text-slate-200">{result.info?.leds?.count || 0}</td>
                </tr>
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-bold text-slate-400 flex items-center gap-3"><Zap size={14} className="text-slate-500" /> Max Power</td>
                  <td className="p-4 font-bold text-slate-200">{result.info?.leds?.maxpwr || 0} mA</td>
                </tr>
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-bold text-slate-400 flex items-center gap-3"><Zap size={14} className="text-slate-500" /> Current Power</td>
                  <td className="p-4 font-bold text-slate-200">{result.info?.leds?.pwr || 0} mA</td>
                </tr>
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-bold text-slate-400 flex items-center gap-3"><Wifi size={14} className="text-slate-500" /> WiFi Signal</td>
                  <td className="p-4 font-bold text-slate-200">{result.info?.wifi?.signal || 0}%</td>
                </tr>
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-bold text-slate-400 flex items-center gap-3"><Sun size={14} className="text-slate-500" /> LED Count</td>
                  <td className="p-4 font-bold text-slate-200">{result.info?.leds?.count || 0}</td>
                </tr>
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-bold text-slate-400 flex items-center gap-3"><ClockArrowUp size={14} className="text-slate-500" /> Uptime</td>
                  <td className="p-4 font-bold text-slate-200">{result.info?.uptime || 0}</td>
                </tr>
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-bold text-slate-400 flex items-center gap-3"><Mic size={14} className="text-slate-500" /> Audio Reactive</td>
                  <td className="p-4 font-bold text-slate-200">Sound Processing - {result.info?.u?.["Sound Processing"] || 0}
                    <div>Audio Source - {result.info?.u?.["Audio Source"]}</div>
                    <div>UDP Sound Sync - {result.info?.u?.["UDP Sound Sync"]} </div>
                  </td>
                </tr>
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-bold text-slate-400 flex items-center gap-3"><Info size={14} className="text-slate-500" /> Brand</td>
                  <td className="p-4 font-bold text-slate-200">{result.info?.brand || WLED}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-800/50 border-y border-slate-800 flex items-center gap-2 text-sm font-bold text-slate-300 uppercase tracking-wider mt-4">
            Raw JSON Output
          </div>
          <pre className="p-6 bg-slate-950 overflow-auto text-slate-400 text-[11px] font-mono max-h-[500px]">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {result?.error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-6 rounded-2xl text-center font-bold shadow-xl uppercase tracking-widest text-sm">
          {result.error}
        </div>
      )}
    </div>
  )
}