import { useState, useCallback } from 'react'
import api from '../services/api'
import { Radar, Plus, RefreshCw, Server } from 'lucide-react'

export default function Discovery() {
  const [isScanning, setIsScanning] = useState(false)
  const [devices, setDevices] = useState([])
  const [error, setError] = useState(null)
  
  const scanNetwork = useCallback(async () => {
    setIsScanning(true)
    setError(null)
    setDevices([])
    try {
      const res = await api.get('/api/discovery')
      setDevices(res.data)
    } catch (err) {
      console.error(err)
      setError("Failed to scan network. Make sure the backend is running and mDNS is not blocked by your firewall.")
    } finally {
      setIsScanning(false)
    }
  }, [])
  
  const handleAdd = async (device) => {
    try {
      await api.post('/api/controllers', {
        name: device.name || "New WLED",
        ip_address: device.ip_address,
        location: "Discovered",
        group_id: null,
        main_brightness: 255,
        is_active: true,
        led_on: true
      });
      alert(`Successfully added ${device.name} (${device.ip_address})!`)
    } catch (err) {
      alert("Failed to add controller. It might already exist in the database.")
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto p-4 flex-1 overflow-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
            <Radar size={24} className={isScanning ? "animate-spin" : ""} />
        </div>
        <h1 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Network Discovery</h1>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800/60 p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-slate-400 max-w-2xl">
                Scan your local network for WLED controllers broadcasting via mDNS (Zeroconf). Once found, you can add them directly to your controllers list.
            </p>
            <button
                onClick={scanNetwork}
                disabled={isScanning}
                className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isScanning ? <RefreshCw size={16} className="animate-spin" /> : <Radar size={16} />} 
                {isScanning ? "SCANNING..." : "SCAN NETWORK"}
            </button>
        </div>
        
        {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-rose-400 text-sm mb-6">
                {error}
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device, i) => (
                <div key={i} className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-indigo-500/30 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2 text-slate-200 font-bold truncate pr-2">
                            <Server size={16} className="text-indigo-400 shrink-0" />
                            <span className="truncate">{device.name}</span>
                        </div>
                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] rounded border border-emerald-500/20 font-bold tracking-wider shrink-0">
                            WLED
                        </span>
                    </div>
                    
                    <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                            <span className="w-16 opacity-50">IP</span>
                            <span className="text-slate-300">{device.ip_address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                            <span className="w-16 opacity-50">MAC</span>
                            <span className="text-slate-300">{device.mac || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                            <span className="w-16 opacity-50">VER</span>
                            <span className="text-slate-300">v{device.version || 'Unknown'}</span>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => handleAdd(device)}
                        disabled={device.is_added}
                        className={`w-full py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex justify-center items-center gap-2 ${
                            device.is_added 
                                ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-800'
                                : 'bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white border border-transparent'
                        }`}
                    >
                        {device.is_added ? null : <Plus size={14} />} 
                        {device.is_added ? "Already Added" : "Add to Controllers"}
                    </button>
                </div>
            ))}
            
            {!isScanning && devices.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-500 text-sm border-2 border-dashed border-slate-800 rounded-xl">
                    <Radar size={48} className="mx-auto mb-4 opacity-20" />
                    No devices found. Click "Scan Network" to begin discovery.
                </div>
            )}
        </div>
      </div>
    </div>
  )
}
