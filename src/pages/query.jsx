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

      <h1 className="text-3xl font-bold">
        Query Controller
      </h1>

      <div className="flex gap-4">

        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="192.168.1.100"
          className="bg-slate-900 border border-slate-700 rounded-xl p-3 w-full"
        />

        <button
          onClick={search}
          className="bg-indigo-600 px-6 rounded-xl"
        >
          Search
        </button>

      </div>

      {result && (

        <pre className="bg-slate-900 p-6 rounded-2xl overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>

      )}

    </div>
  )
}