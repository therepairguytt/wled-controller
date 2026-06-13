import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { Trash2, RotateCcw, Plus, Zap, X, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';

export default function Settings() {
  const [groups, setGroups] = useState([])
  const [controllers, setControllers] = useState([])
  const [selectedControllerId, setSelectedControllerId] = useState("")
  const [formData, setFormData] = useState({ group_name: "" })
  const [groupsSort, setGroupsSort] = useState({ column: 'id', direction: 'asc' })
  const [groupsPage, setGroupsPage] = useState(1)
  const [groupsRowsPerPage, setGroupsRowsPerPage] = useState(10)
  const [groupsDeletingID, setGroupsDeletingID] = useState(null)
  const [isGroupsModalOpen, setIsGroupsModalOpen] = useState(false)
  const [editingGroups, setEditingGroups] = useState([null])
  const groupBeingDeleted = groups.find(g => g.id === groupsDeletingID)

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

  const handleGroupsSortRequest = (column) => {
    let direction = 'asc';
    if (groupsSort.column === column && groupsSort.direction === 'asc') {
      direction = 'desc';
    }
    setGroupsSort({ column, direction });
    setGroupsPage(1);
  };

  const sortedGroups = useMemo(() => {
    const sortableItems = [...groups];
    if (groupsSort.column !== null) {
      sortableItems.sort((a, b) => {
        let aVal = a[groupsSort.column];
        let bVal = b[groupsSort.column];

        if (groupsSort.column === 'id') {
          return groupsSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        aVal = aVal?.toString().toLowerCase() || '';
        bVal = bVal?.toString().toLowerCase() || '';
        if (aVal < bVal) return groupsSort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return groupsSort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [groups, groupsSort]);

  const totalGroupPages = Math.ceil(sortedGroups.length / groupsRowsPerPage) || 1;
  const paginatedGroups = useMemo(() => {
    const startIndex = (groupsPage - 1) * groupsRowsPerPage;
    return sortedGroups.slice(startIndex, startIndex + groupsRowsPerPage);
  }, [sortedGroups, groupsPage, groupsRowsPerPage]);

  const SortIndicator = ({ currentSort, column }) => {
    if (currentSort.column != column) return <ArrowUpDown size={14} className="opacity-40" />;
    return currentSort.direction === 'asc'
      ? <ArrowUp size={14} className="text-indigo-400" />
      : <ArrowDown size={14} className="text-indigo-400" />;
  };

  const groupsModal = (groups = null) => {
    if (groups) {
      setEditingGroups(groups)
      setFormData({
        group_name: groups.group_name
      })
    } else {
      setEditingGroups(null)
      setFormData({
        group_name: ""
      })
    }
    setIsGroupsModalOpen(true)
  }

  const groupsSave = async (e) => {
    e.preventDefault()
    const payload = { ...formData }
    try {
      if (editingGroups) {
        await api.put(`/api/groups/${editingGroups.id}`, payload)
      } else {
        await api.post('/api/groups', payload)
      }
      fetchData()
      setIsGroupsModalOpen(false)
    } catch (err) {
      alert("Error saving group info: " + (err.response?.data?.detail?.[0]?.msg || err.msg))
    }
  };

  const groupsDelete = async (id) => {
    try {
      await api.delete(`/api/groups/${id}`);
      fetchData();
      setGroupsDeletingID(null);
      if (paginatedGroups.length === 1 && groupsPage > 1) {
        setGroupsPage(prev => prev - 1);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail
        ? (typeof err.response.data.detail === 'string' ? err.response.data.detail : JSON.stringify(err.response.data.detail))
        : "An unexpected error occured."
      alert(`Failed to delete: ${errorMessage}`);
    }
  };

  const handleReboot = async (target) => {
    const isAll = target === 'all';
    const endpoint = isAll
      ? '/api/controllers/reboot-all'
      : `/api/reboot/${selectedControllerId}`;

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
      <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800/60 p-6 shadow-xl">
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
      <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800/60 p-6 shadow-xl">
        <div className="flex justify-between items-baseline pb-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Group Management</h3>
          <button
            onClick={() => groupsModal()}
            className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={16} /> CREATE GROUP
          </button>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
          <table className="w-full text-center text-sm">
            <thead className="bg-slate-800/80 text-slate-400 font-bold uppercase text-[13px] tracking-widest">
              <tr>
                <th onClick={() => handleGroupsSortRequest('id')} className="p-4 cursor-pointer hover:bg-slate-700/80 hover:text-white transition-colors">
                  <div className="flex items-center justify-center gap-2">ID<SortIndicator currentSort={groupsSort} column="id" /></div>
                </th>
                <th onClick={() => handleGroupsSortRequest('group_name')} className="p-4 cursor-pointer hover:bg-slate-700/80 hover:text-white transition-colors">
                  <div className="flex items-center justify-center gap-2">Name<SortIndicator currentSort={groupsSort} column="group_name" /></div>
                </th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-center text-[14px]">
              {paginatedGroups.length > 0 ? (
                paginatedGroups.map(groups => (
                  <tr key={groups.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="text-slate-200 font-mono p-4">{groups.id}</td>
                    <td className="text-slate-200 font-mono p-4">{groups.group_name}</td>
                    <td className="p-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => groupsModal(groups)} className="cursor-pointer p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => setGroupsDeletingID(groups.id)}
                          className="cursor-pointer text-rose-500 hover:bg-rose-500/10 p-2 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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

          {/* Groups Pagination */}
          <div className="bg-slate-800/80 border-t border-slate-900 px-4 py-3 flex items-center justify-between flex-wrap gap-3 text-xs font-bold text-slate-400">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={groupsRowsPerPage}
                onChange={e => { setGroupsRowsPerPage(Number(e.target.value)); setGroupsPage(1); }}
                className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 outline-none cursor-pointer"
              >
                {[5, 10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <span>Page {groupsPage} of {totalGroupPages}</span>
              <div className="flex gap-1">
                <button
                  disabled={groupsPage === 1}
                  onClick={() => setGroupsPage(prev => prev - 1)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  disabled={groupsPage === totalGroupPages}
                  onClick={() => setGroupsPage(prev => prev + 1)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Groups Modal */}
          {isGroupsModalOpen && (
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsGroupsModalOpen(false)} />
              <form onSubmit={groupsSave} className="relative bg-slate-900/80 backdrop-blur-md border border-slate-800/60 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
                  <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                    {editingGroups ? 'Edit Group' : 'Create Group'}
                  </h2>
                  <button type="button" onClick={() => setIsGroupsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
                </div>
                <div className="p-6 grid grid-cols-1 gap-5">
                  <div className="col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Group Name</label>
                    <input
                      required
                      placeholder='Main Group'
                      value={formData.group_name}
                      onChange={e => setFormData({ ...formData, group_name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="p-6 bg-slate-800/30">
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/20 uppercase">
                    {editingGroups ? 'UPDATE GROUP' : 'CREATE GROUP'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {groupsDeletingID && (
            <div className="fixed inset-0 z-110 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setGroupsDeletingID(null)} />
              <div className="relative bg-slate-900/80 backdrop-blur-md border border-rose-500/20 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center">
                <div className="bg-rose-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 className="text-rose-500" size={32} />
                </div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Confirm Deletion of Group {groupBeingDeleted.group_name}</h2>
                <p className="text-slate-400 text-sm mt-3">This will permanently remove the group {groupBeingDeleted.group_name} from your system. Please ensure no controllers are assigned to this group!</p>
                <div className="flex gap-3 mt-8">
                  <button type="button" onClick={() => setGroupsDeletingID(null)} className="flex-1 bg-slate-800 text-slate-300 font-bold py-3 rounded-xl cursor-pointer">CANCEL</button>
                  <button type="button" onClick={() => groupsDelete(groupsDeletingID)} className="flex-1 bg-rose-600 text-white font-bold py-3 rounded-xl cursor-pointer">DELETE GROUP</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}