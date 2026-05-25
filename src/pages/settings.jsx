import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Trash2, RotateCcw, Plus, Zap, X } from 'lucide-react';

export default function Settings() {
  const [groups, setGroups] = useState([])
  const [controllers, setControllers] = useState([])
  const [selectedControllerId, setSelectedControllerId] = useState("")
  const [formData, setFormData] = useState({ group_name: "" })

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
              onChange={e => setSelectedControllerId(e.target.value)}
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
          <button
            type="submit"
            className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} /> CREATE GROUP
          </button>
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

    </div>
  );
}