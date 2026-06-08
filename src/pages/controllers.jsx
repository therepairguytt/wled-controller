import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../services/api'
import { Edit3, Trash2, Plus, X, Server, Lightbulb, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Sun } from 'lucide-react'

export default function Controllers() {
  const [controllers, setControllers] = useState([])
  const [groups, setGroups] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingController, setEditingController] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    ip_address: '',
    location: '',
    group_id: '',
    main_brightness: 128,
    led_on: true,
    is_active: true
  })

  useEffect(() => {
    const loadGroups = async () => {
      const res = await api.get('/api/groups');
      setGroups(res.data);
    };
    loadGroups();
  }, []);

  const fetchControllers = useCallback(async () => {
    try {
      const res = await api.get('/api/controllers')
      setControllers(res.data)
    } catch (err) {
      console.error("Failed to load controllers", err)
    }
  }, [])

  useEffect(() => { fetchControllers() }, [fetchControllers])

  const [controllerSort, setControllerSort] = useState({ column: 'name', direction: 'asc' });
  const [controllerPage, setControllerPage] = useState(1);
  const [controllerRowsPerPage, setControllerRowsPerPage] = useState(10);

  const handleControllerSortRequest = (column) => {
      let direction = 'asc';
      if (controllerSort.column === column && controllerSort.direction === 'asc') {
          direction = 'desc';
      }
      setControllerSort({ column, direction });
      setControllerPage(1);
  };

  const sortedControllers = useMemo(() => {
      const sortableItems = [...controllers];
      if (controllerSort.column !== null) {
          sortableItems.sort((a, b) => {
              let aVal = controllerSort.column === 'group_name' ? a.group?.group_name : a[controllerSort.column];
              let bVal = controllerSort.column === 'group_name' ? b.group?.group_name : b[controllerSort.column];

              if (['id', 'main_brightness'].includes(controllerSort.column)) {
                  return controllerSort.direction === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
              }
              if (['led_on', 'is_active'].includes(controllerSort.column)) {
                  return controllerSort.direction === 'asc' ? (aVal === bVal ? 0 : aVal ? 1 : -1) : (aVal === bVal ? 0 : aVal ? -1 : 1);
              }

              aVal = aVal?.toString().toLowerCase() || '';
              bVal = bVal?.toString().toLowerCase() || '';
              if (aVal < bVal) return controllerSort.direction === 'asc' ? -1 : 1;
              if (aVal > bVal) return controllerSort.direction === 'asc' ? 1 : -1;
              return 0;
          });
      }
      return sortableItems;
  }, [controllers, controllerSort]);

  const totalControllerPages = Math.ceil(sortedControllers.length / controllerRowsPerPage) || 1;
  const paginatedControllers = useMemo(() => {
      const startIndex = (controllerPage - 1) * controllerRowsPerPage;
      return sortedControllers.slice(startIndex, startIndex + controllerRowsPerPage);
  }, [sortedControllers, controllerPage, controllerRowsPerPage]);

  const SortIndicator = ({ currentSort, column }) => {
      if (currentSort.column !== column) return <ArrowUpDown size={14} className="opacity-40 inline" />;
      return currentSort.direction === 'asc' 
          ? <ArrowUp size={14} className="text-indigo-400 inline" /> 
          : <ArrowDown size={14} className="text-indigo-400 inline" />;
  };

  const openModal = (controller = null) => {
    if (controller) {
      setEditingController(controller)
      setFormData({
        name: controller.name,
        ip_address: controller.ip_address,
        location: controller.location || '',
        group_id: controller.group_id || (groups.length > 0 ? groups[0].id : ''),
        main_brightness: controller.main_brightness,
        led_on: controller.led_on,
        is_active: controller.is_active
      })
    } else {
      setEditingController(null)
      setFormData({
        name: '',
        ip_address: '',
        location: '',
        group_id: groups.length > 0 ? groups[0].id : '',
        main_brightness: 128,
        led_on: true,
        is_active: true
      })
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()

    const groupIdInt = parseInt(formData.group_id, 10)
    if (isNaN(groupIdInt)) {
      alert("Please select or create a valid group first.")
      return
    }

    const payload = {
      ...formData,
      group_id: groupIdInt,
      main_brightness: parseInt(formData.main_brightness, 10) || 128
    }

    try {
      if (editingController) {
        await api.put(`/api/controllers/${editingController.id}`, payload)
      } else {
        await api.post('/api/controllers', payload)
      }
      fetchControllers()
      setIsModalOpen(false)
    } catch (err) {
      alert("Error saving controller info: " + (err.response?.data?.detail?.[0]?.msg || err.message))
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/controllers/${id}`);
      fetchControllers();
      setDeletingId(null);
      if (paginatedControllers.length === 1 && controllerPage > 1) {
          setControllerPage(prev => prev - 1);
      }
    } catch (err) {
      alert("Error deleting controller.")
    }
  };


  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Controller Management</h1>
        {groups.length > 0 ? (
          <button
            onClick={() => openModal()}
            className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={16} /> CREATE CONTROLLER
          </button>
        ) : (
          <button
            disabled={groups.length === 0}
            className="cursor-not-allowed bg-indigo-600 text-white text-xs font-bold disabled:opacity-50 px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={16} /> CREATE CONTROLLER
          </button>
        )}
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm table-auto min-w-max">
            <thead className="bg-slate-800/80 text-slate-400 font-bold uppercase text-[13px] tracking-widest select-none">
              <tr>
                <th onClick={() => handleControllerSortRequest('name')} className="p-4 cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center gap-1">Name & Location <SortIndicator currentSort={controllerSort} column="name" /></div>
                </th>
                <th onClick={() => handleControllerSortRequest('ip_address')} className="p-4 text-center cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center justify-center gap-1">IP Address <SortIndicator currentSort={controllerSort} column="ip_address" /></div>
                </th>
                <th onClick={() => handleControllerSortRequest('group_name')} className="p-4 text-center cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center justify-center gap-1">Group <SortIndicator currentSort={controllerSort} column="group_name" /></div>
                </th>
                <th onClick={() => handleControllerSortRequest('main_brightness')} className="p-4 text-center cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center justify-center gap-1">Brightness <SortIndicator currentSort={controllerSort} column="main_brightness" /></div>
                </th>
                <th onClick={() => handleControllerSortRequest('led_on')} className="p-4 text-center cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center justify-center gap-1">LED On <SortIndicator currentSort={controllerSort} column="led_on" /></div>
                </th>
                <th onClick={() => handleControllerSortRequest('is_active')} className="p-4 text-center cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center justify-center gap-1">Enabled <SortIndicator currentSort={controllerSort} column="is_active" /></div>
                </th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-center text-[14px]">
              {paginatedControllers.length > 0 ? (
                paginatedControllers.map(ctrl => (
                <tr key={ctrl.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="p-4">
                    <div className="font-bold text-slate-200">{ctrl.name}</div>
                    <div className="text-[10px] text-slate-500 uppercase">{ctrl.location}</div>
                  </td>
                  <td className="p-4 text-center font-mono text-xs text-slate-400">{ctrl.ip_address}</td>
                  <td className="p-4 text-center">
                    <span className="px-2 py-1 bg-slate-800 rounded text-[10px] font-bold text-indigo-400 border border-slate-700">
                      {ctrl.group?.group_name || "No Group"}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-slate-400 font-mono text-xs">
                    <Sun size={14} className="text-amber-500" />
                    {Math.round((ctrl.main_brightness / 255) * 100)}%
                  </div>
                </td>
                  <td className="p-4 text-center">
                    <input
                      type="checkbox"
                      value={ctrl.led_on}
                      checked={ctrl.led_on}
                      readOnly
                      className="pointer-events-none w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 mx-auto"
                    />
                  </td>
                  <td className="p-4 text-center">
                    <input
                      type="checkbox"
                      value={ctrl.is_active}
                      checked={ctrl.is_active}
                      readOnly
                      className="pointer-events-none w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-0 mx-auto"
                    />
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openModal(ctrl)} className="cursor-pointer p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => setDeletingId(ctrl.id)}
                        className="cursor-pointer p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="p-8 text-center text-slate-400 italic text-m bg-slate-600/10 justify-center col-auto"
                >
                  {groups.length > 0 ? (
                    <div>No controllers created.</div>
                  ) : (
                    <div>
                      <p>Please create a group first then create a controller.</p>
                      <button
                        onClick={() => window.location.hash = 'settings'}
                        className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                      >
                        Go to Groups
                      </button>
                    </div>
                  )}

                </td>
              </tr>
            )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        <div className="bg-slate-900/50 border-t border-slate-800 px-4 py-3 flex items-center justify-between flex-wrap gap-3 text-xs font-bold text-slate-400">
            <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select 
                    value={controllerRowsPerPage} 
                    onChange={e => { setControllerRowsPerPage(Number(e.target.value)); setControllerPage(1); }}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 outline-none cursor-pointer hover:bg-slate-800/40"
                >
                    {[5, 10, 25, 50].map(size => 
                    <option
                        key={size}
                        value={size}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 outline-none cursor-pointer"
                    >
                        {size}
                    </option>)}
                </select>
            </div>
            <div className="flex items-center gap-4">
                <span>Page {controllerPage} of {totalControllerPages}</span>
                <div className="flex gap-1">
                    <button 
                        disabled={controllerPage === 1}
                        onClick={() => setControllerPage(prev => prev - 1)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button 
                        disabled={controllerPage === totalControllerPages}
                        onClick={() => setControllerPage(prev => prev + 1)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* Add & Update Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />

          <form onSubmit={handleSave} className="relative bg-slate-900/80 backdrop-blur-md border border-slate-800/60 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
              <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                {editingController ? 'Edit Controller' : 'New Controller'}
              </h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
            </div>

            <div className="p-6 grid grid-cols-2 gap-5">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Controller Name</label>
                <input
                  required
                  placeholder='Kitchen Controller 1'
                  value={formData.name}
                  title="A friendly name to identify this controller in the app. It has no effect on the actual device functionality."
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">IP Address</label>
                <input
                  required
                  placeholder='192.168.1.xx'
                  value={formData.ip_address}
                  title="The IP address of the controller device on the network."
                  onChange={e => setFormData({ ...formData, ip_address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Assign Group</label>
                <select
                  value={formData.group_id}
                  title="The group to which this controller belongs."
                  onChange={e => setFormData({ ...formData, group_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                >
                  {groups.length === 0 ? (
                    <option value="">Create a group first!</option>
                  ) : (
                    groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.group_name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Physical Location</label>
                <input
                  placeholder='Cabinet area, North wall...'
                  value={formData.location}
                  title="The physical location of the controller device."
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="col-span-2 bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Main Brightness</label>
                  <span className="text-xs font-mono text-indigo-400 font-bold">{formData.main_brightness}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  title="The default brightness level for the controller. This sets the maximum brightness that can be applied to the LEDs connected to this controller."
                  value={formData.main_brightness}
                  onChange={e => setFormData({ ...formData, main_brightness: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="led_on"
                  checked={formData.led_on}
                  title="If enabled, the controller will turn on the LEDs when powered on. If disabled, the controller will keep the LEDs off until turned on via software."
                  onChange={e => setFormData({ ...formData, led_on: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="led_on" className="text-xs font-bold text-slate-300 cursor-pointer">LED On</label>
              </div>

              <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  title="If disabled, the controller will be ignored in all operations and no effects will be applied."
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-0"
                />
                <label htmlFor="is_active" className="text-xs font-bold text-slate-300 cursor-pointer">Enabled</label>
              </div>
            </div>

            <div className="p-6 bg-slate-800/30">
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/20">
                {editingController ? 'UPDATE SETTINGS' : 'SAVE CONTROLLER'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Window */}
      {deletingId && (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setDeletingId(null)} />
          <div className="relative bg-slate-900/80 backdrop-blur-md border border-rose-500/20 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center">
            <div className="bg-rose-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="text-rose-500" size={32} />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Confirm Deletion</h2>
            <p className="text-slate-400 text-sm mt-3">This will permanently remove the controller from your network grid.</p>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setDeletingId(null)} className="flex-1 bg-slate-800 text-slate-300 font-bold py-3 rounded-xl cursor-pointer">CANCEL</button>
              <button onClick={() => handleDelete(deletingId)} className="flex-1 bg-rose-600 text-white font-bold py-3 rounded-xl cursor-pointer">DELETE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}