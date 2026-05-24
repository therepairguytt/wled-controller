export default function Presets() {

  return (
    <div className="space-y-6">

      <h1 className="text-3xl font-bold">
        Presets
      </h1>

      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">

        <div className="grid grid-cols-3 gap-4">

          <input placeholder="Preset Name" className="input" />
          <input placeholder="Effect ID" className="input" />
          <input placeholder="Palette ID" className="input" />

        </div>

      </div>

    </div>
  )
}