import { useState } from 'react'
import api from '../services/api'

export default function Query() {

  const [ip, setIp] = useState('')
  const [result, setResult] = useState(null)

  const search = async () => {

    const res = await api.get(`/api/query/${ip}`)

    setResult(res.data)
  }

  return (
    <div className="space-y-6">

      <h1 className="text-2xl font-black text-slate-100 uppercase tracking-tight">
        Query Controller
      </h1>

      <div className="flex gap-4">

        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="192.168.1.100"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:border-indigo-500 outline-none transition-all"
        />

        <button
          onClick={search}
          className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 uppercase tracking-wider"
        >
          Search
        </button>

      </div>

      {result && (

        <pre className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 p-6 rounded-2xl shadow-xl overflow-auto text-slate-300 text-xs font-mono">
          {JSON.stringify(result, null, 2)}
        </pre>

      )}

    </div>
  )
}