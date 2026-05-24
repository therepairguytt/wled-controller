import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Trash2, RotateCcw, Plus, Zap, Edit3, X } from 'lucide-react';

export default function Settings() {
  const [groups, setGroups] = useState([])
  const [controllers, setControllers] = useState([])
  const [selectedControllerId, setSelectedControllerId] = useState("")
  const [formData, setFormData] = useState({ group_name: "" })
  const [effects, setEffects] = useState([])
  const [editingEffects, setEditingEffects] = useState([])
  const [effectsData, setEffectsData] = useState({
    effect_id: "",
    name: ""
  })
  const [palettes, setPalettes] = useState([])
  const [isPalettesModalOpen, setIsPalettesModalOpen] = useState(false)
  const [editingPalettes, setEditingPalettes] = useState([])
  const [palettesDeletingId, setPalettesDeletingId] = useState(null)
  const [palettesData, setPalettesData] = useState({
    palettes_id: "",
    name: ""
  })

  const fetchData = useCallback(async () => {
    try {
      const [groupRes, ctrlRes] = await Promise.all([
        api.get('/api/groups'),
        api.get('/api/controllers')
      ]);
      setGroups(groupRes.data);
      setControllers(ctrlRes.data);
    } catch (err) {
      console.error("Failed to sync settings data", err);
    }
  }, []);

  useEffect(() => { fetchData() }, [fetchData]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/groups', formData);
      setFormData({ group_name: "" });
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to create group";
      alert(`Error: ${msg}`);
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!window.confirm("Are you sure you want to delete this group?")) return;
    try {
      await api.delete(`/api/groups/${id}`);
      fetchData();
    } catch (err) {
      const errorMessage = err.response?.data?.detail
        ? err.response.data.detail
        : "An unexpected error occurred.";

      alert(`Failed to delete: ${errorMessage}`);

      console.error("Backend Error:", err.response?.data);
    }
  };

  const handleReboot = async (target) => {
    const isAll = target === 'all';
    const endpoint = isAll
      ? '/api/controllers/reboot-all'
      : `/api/controllers/reboot/${selectedControllerId}`;

    if (!isAll && !selectedControllerId) {
      alert("Please select a controller first.");
      return;
    }

    try {
      await api.post(endpoint);
      alert(`Reboot command sent to ${isAll ? 'all nodes' : 'selected node'}.`);
    } catch (err) {
      alert("Reboot command failed. Check network connection.");
    }
  };

  const fetchPalettes = useCallback(async () => {
    try {
      const res = await api.get('/api/palettes')
      setPalettes(res.data)
    } catch (err) {
      console.error("Failed to load Palettes Data", err)
    }
  }, [])

  useEffect(() => { fetchPalettes() }, [fetchPalettes])

  const palettesModal = (palettes = null) => {
    if (palettes) {
      setEditingPalettes(palettes)
      setPalettesData({
        palettes_id: palettes.palettes_id,
        name: palettes.name
      })
    } else {
      setEditingPalettes(null)
      setPalettesData({
        palettes_id: "",
        name: ""
      })
    }
    setIsPalettesModalOpen(true)
  }

  const palettesSave = async (e) => {
    e.preventDefault()

    const payload = {
      ...palettesData,
      palettes_id: parseInt(palettesData.palettes_id, 10) || 0,
    }

    try {
      if (editingPalettes) {
        await api.put(`/api/palettes/${editingPalettes.id}`, payload)
      } else {
        await api.post('/api/palettes', payload)
      }
      fetchPalettes()
      setIsPalettesModalOpen(false)
    } catch (err) {
      alert("Error saving palettes info: " + (err.response?.data?.detail?.[0]?.msg || err.message))
    }
  }

  const handleDeletePalettes = async (id) => {
    try {
      await api.delete(`/api/palettes/${id}`);
      fetchPalettes();
      setPalettesDeletingId(null);
    } catch (err) {
      const errorMessage = err.response?.data?.detail
        ? err.response.data.detail
        : "An unexpected error occurred.";

      alert(`Failed to delete: ${errorMessage}`);

      console.error("Backend Error:", err.response?.data);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
          <Zap size={24} />
        </div>
        <h1 className="text-2xl font-black text-slate-100 uppercase tracking-tight">System Settings</h1>
      </div>

      {/* Power Options Section */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Power & Maintenance</h3>
        <div className="flex flex-col md:flex-row items-end gap-4">
          <div className="flex-1 w-full">
            <label className="block mb-2 text-xs font-bold text-slate-500 uppercase ml-1" htmlFor="restartController">Target Hardware</label>
            <select
                  value={selectedControllerId || ""}
                  onChange={e => setSelectedControllerId(e.target.value )}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                  id="restartController"
                >
                  {controllers.length === 0 ? (
                    <option value="">Create a controler first!</option>
                  ) : (
                    controllers.map((ctrl) => (
                      <option key={ctrl.id} value={ctrl.id}>
                        {ctrl.name} - {ctrl.ip_address}
                      </option>
                    ))
                  )}
                </select>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => handleReboot('selected')}
              className="flex-1 md:flex-none cursor-pointer bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <RotateCcw size={18} /> REBOOT SELECTED
            </button>
            <button
              onClick={() => handleReboot('all')}
              className="flex-1 md:flex-none cursor-pointer bg-rose-600 hover:bg-rose-500 text-white font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-900/20"
            >
              <RotateCcw size={18} /> REBOOT ALL
            </button>
          </div>
        </div>
      </div>

      {/* Group Management Section */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Groups Management</h3>
          <button
            type="submit"
            className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} /> CREATE GROUP
          </button>
        </div>
        <form onSubmit={handleCreateGroup} className="flex flex-col md:flex-row gap-4 mb-8 items-end">
          <div className="flex-1 w-full">
            <label className="block mb-2 text-xs font-bold text-slate-500 uppercase ml-1" htmlFor="groupName">
              New Group Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Master Bedroom"
              id="groupName"
              value={formData.group_name}
              onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
        </form>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/50 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
              <tr>
                <th className="p-4">ID</th>
                <th className="p-4">Group Name</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {groups.length > 0 ? (
                groups.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="p-4 text-slate-500 font-mono text-xs">#{item.id}</td>
                    <td className="p-4 font-bold text-slate-200">{item.group_name}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDeleteGroup(item.id)}
                        className="cursor-pointer text-rose-500 hover:bg-rose-500/10 p-2 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="p-8 text-center text-slate-600 italic text-xs">
                    No Groups Defined.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pallet Management Section */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl">
        <div className="flex justify-between pb-4 items-baseline">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Palette Management</h3>
          <button
            onClick={() => palettesModal()}
            className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={16} /> CREATE PALETTE
          </button>
        </div>
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/50 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
              <tr>
                <th className="p-4 text-center">Palette ID</th>
                <th className="p-4 text-center">Palette name</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-center">
              {palettes.map(pal => (
                <tr key={pal.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="font-bold text-slate-200">{pal.palettes_id}</td>
                  <td className="font-bold text-slate-200">{pal.name}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => palettesModal(pal)} className="cursor-pointer p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => setPalettesDeletingId(pal.id)}
                        className="cursor-pointer p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isPalettesModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsPalettesModalOpen(false)} />

          <form onSubmit={palettesSave} className="relative bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-3xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
              <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                {editingPalettes ? 'Edit Palette' : 'New Palette'}
              </h2>
              <button type="button" onClick={() => setIsPalettesModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
            </div>

            <div className="p-6 grid grid-cols-2 gap-5">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Palette Name</label>
                <input
                  required
                  placeholder='Custom Palette'
                  value={palettesData.name}
                  onChange={e => setPalettesData({ ...palettesData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Palette ID</label>
                <input
                  required
                  type="number"
                  placeholder='255'
                  value={palettesData.palettes_id}
                  onChange={e => setPalettesData({ ...palettesData, palettes_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
            <div className="p-6 bg-slate-800/30">
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/20">
                {editingPalettes ? 'UPDATE PALETTE' : 'SAVE PALETTE'}
              </button>
            </div>
          </form>
        </div>
      )}

      {palettesDeletingId && (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setDeletingId(null)} />
          <div className="relative bg-slate-900 border border-rose-500/20 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center">
             <div className="bg-rose-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="text-rose-500" size={32} />
             </div>
             <h2 className="text-xl font-black text-white uppercase tracking-tight">Confirm Deletion</h2>
             <p className="text-slate-400 text-sm mt-3">This will permanently remove this palette from your system.</p>
             <div className="flex gap-3 mt-8">
                <button onClick={() => setPalettesDeletingId(null)} className="flex-1 bg-slate-800 text-slate-300 font-bold py-3 rounded-xl cursor-pointer">CANCEL</button>
                <button onClick={() => handleDelete(palettesDeletingId)} className="flex-1 bg-rose-600 text-white font-bold py-3 rounded-xl cursor-pointer">DELETE</button>
             </div>
          </div>
        </div>
      )}
      </div>

    </div>
  );
}