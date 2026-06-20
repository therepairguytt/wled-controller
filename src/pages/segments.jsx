import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../services/api'
import { Edit3, Trash2, Plus, X, Server, Lightbulb, Sun, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

export default function ControllerSegments() {
  const [controllers, setControllers] = useState([])
  const [segment, setSegment] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSegment, setEditingSegment] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [formData, setFormData] = useState({
    controller_id: '',
    name: '',
    segment_id: 0,
    start_led: 0,
    stop_led: 200,
    reverse_direction: false,
    mirror_effect: false,
    offset: 0,
    grouping: 1,
    spacing: 0,
    seg_bri: 255
  })

  const [segmentSort, setSegmentSort] = useState({ column: 'controller_name', direction: 'asc' });
  const [segmentPage, setSegmentPage] = useState(1);
  const [segmentRowsPerPage, setSegmentRowsPerPage] = useState(10);

  const handleSegmentSortRequest = (column) => {
      let direction = 'asc';
      if (segmentSort.column === column && segmentSort.direction === 'asc') {
          direction = 'desc';
      }
      setSegmentSort({ column, direction });
      setSegmentPage(1);
  };

  const sortedSegments = useMemo(() => {
      const sortableItems = [...segment];
      if (segmentSort.column !== null) {
          sortableItems.sort((a, b) => {
              let aVal = segmentSort.column === 'controller_name' ? a.controller_name?.name : a[segmentSort.column];
              let bVal = segmentSort.column === 'controller_name' ? b.controller_name?.name : b[segmentSort.column];

              if (['segment_id', 'start_led', 'stop_led', 'seg_bri', 'offset', 'grouping', 'spacing'].includes(segmentSort.column)) {
                  return segmentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
              }

              aVal = aVal?.toString().toLowerCase() || '';
              bVal = bVal?.toString().toLowerCase() || '';
              if (aVal < bVal) return segmentSort.direction === 'asc' ? -1 : 1;
              if (aVal > bVal) return segmentSort.direction === 'asc' ? 1 : -1;
              return 0;
          });
      }
      return sortableItems;
  }, [segment, segmentSort]);

  const totalSegmentPages = Math.ceil(sortedSegments.length / segmentRowsPerPage) || 1;
  const paginatedSegments = useMemo(() => {
      const startIndex = (segmentPage - 1) * segmentRowsPerPage;
      return sortedSegments.slice(startIndex, startIndex + segmentRowsPerPage);
  }, [sortedSegments, segmentPage, segmentRowsPerPage]);

  const SortIndicator = ({ currentSort, column }) => {
      if (currentSort.column !== column) return <ArrowUpDown size={14} className="opacity-40 inline" />;
      return currentSort.direction === 'asc' 
          ? <ArrowUp size={14} className="text-indigo-400 inline" /> 
          : <ArrowDown size={14} className="text-indigo-400 inline" />;
  };

  useEffect(() => {
    const loadControllers = async () => {
      const res = await api.get('/api/controllers');
      setControllers(res.data);
    };
    loadControllers();
  }, []);

  const fetchSegment = useCallback(async () => {
    try {
      const res = await api.get('/api/segments')
      setSegment(res.data)
    } catch (err) {
      console.error("Failed to load segments", err)
    }
  }, [])

  useEffect(() => { fetchSegment() }, [fetchSegment])

  const getNextSegmentId = useCallback((controllerId) => {
    if (!controllerId) return 0;
    const ctrlId = parseInt(controllerId, 10);
    const controllerSegments = segment.filter(s => s.controller_id === ctrlId);
    if (controllerSegments.length === 0) return 0;
    const maxId = Math.max(...controllerSegments.map(s => s.segment_id));
    return maxId + 1;
  }, [segment])

  const getNextStartLed = useCallback((controllerId) => {
    if (!controllerId) return 0;
    const ctrlId = parseInt(controllerId, 10);
    const controllerSegments = segment.filter(s => s.controller_id === ctrlId);
    if (controllerSegments.length === 0) return 0;
    const maxStartLed = Math.max(...controllerSegments.map(s => s.stop_led));
    return maxStartLed;
  }, [segment])

  const openModal = (segment = null) => {
    if (segment) {
      setEditingSegment(segment)
      setFormData({
        name: segment.name,
        controller_id: segment.controller_id,
        segment_id: segment.segment_id,
        start_led: segment.start_led,
        stop_led: segment.stop_led,
        offset: segment.offset,
        grouping: segment.grouping,
        spacing: segment.spacing,
        reverse_direction: segment.reverse_direction,
        mirror_effect: segment.mirror_effect,
        seg_bri: segment.seg_bri
      })
    } else {
      setEditingSegment(null)
      const defaultControllerId = controllers.length > 0 ? controllers[0].id : '';
      setFormData({
        controller_id: defaultControllerId,
        name: '',
        segment_id: getNextSegmentId(defaultControllerId),
        start_led: getNextStartLed(defaultControllerId),
        stop_led: getNextStartLed(defaultControllerId) + 200,
        reverse_direction: false,
        mirror_effect: false,
        offset: 0,
        grouping: 1,
        spacing: 0,
        seg_bri: 255
      })
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()

    const controllerIdInt = parseInt(formData.controller_id, 10)
    if (isNaN(controllerIdInt)) {
      alert("Please select a valid WLED controller.")
      return
    }

    const payload = {
      ...formData,
      controller_id: controllerIdInt,
      segment_id: parseInt(formData.segment_id, 10) || 0,
      start_led: parseInt(formData.start_led, 10) || 0,
      stop_led: parseInt(formData.stop_led, 10) || 0,
      offset: parseInt(formData.offset, 10) || 0,
      grouping: parseInt(formData.grouping, 10) || 1,
      spacing: parseInt(formData.spacing, 10) || 0,
      seg_bri: parseInt(formData.seg_bri, 10) || 0
    }

    try {
      if (editingSegment) {
        await api.put(`/api/segments/${editingSegment.id}`, payload)
      } else {
        await api.post('/api/segments', payload)
      }
      fetchSegment()
      setIsModalOpen(false)
    } catch (err) {
      alert("Error saving segment info: " + (err.response?.data?.detail?.[0]?.msg || err.message))
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/segments/${id}`);
      fetchSegment();
      setDeletingId(null);
      if (paginatedSegments.length === 1 && segmentPage > 1) {
          setSegmentPage(prev => prev - 1);
      }
    } catch (err) {
      alert("Error deleting segment.")
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Segment Management</h1>
        <button
          onClick={() => openModal()}
          className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
        >
          <Plus size={16} /> CREATE SEGMENT
        </button>
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm table-auto min-w-max">
            <thead className="bg-slate-800/80 text-slate-400 font-bold uppercase text-[13px] tracking-widest select-none">
              <tr>
                <th onClick={() => handleSegmentSortRequest('segment_id')} className="p-4 text-center cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center justify-center gap-1">ID & Name<SortIndicator currentSort={segmentSort} column="segment_id" /></div>
                </th>
                <th onClick={() => handleSegmentSortRequest('controller_name')} className="p-4 text-center cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center justify-center gap-1">Controller<SortIndicator currentSort={segmentSort} column="controller_name" /></div>
                </th>
                <th onClick={() => handleSegmentSortRequest('start_led')} className="p-4 text-center cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center justify-center gap-1">Start LED<SortIndicator currentSort={segmentSort} column="start_led" /></div>
                </th>
                <th onClick={() => handleSegmentSortRequest('stop_led')} className="p-4 text-center cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center justify-center gap-1">Stop LED<SortIndicator currentSort={segmentSort} column="stop_led" /></div>
                </th>
                <th onClick={() => handleSegmentSortRequest('seg_bri')} className="p-4 text-center cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center justify-center gap-1">Brightness<SortIndicator currentSort={segmentSort} column="seg_bri" /></div>
                </th>
                <th onClick={() => handleSegmentSortRequest('offset')} className="p-4 text-center cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center justify-center gap-1">Offset<SortIndicator currentSort={segmentSort} column="offset" /></div>
                </th>
                <th onClick={() => handleSegmentSortRequest('grouping')} className="p-4 text-center cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center justify-center gap-1">Grouping<SortIndicator currentSort={segmentSort} column="grouping" /></div>
                </th>
                <th onClick={() => handleSegmentSortRequest('spacing')} className="p-4 text-center cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center justify-center gap-1">Spacing<SortIndicator currentSort={segmentSort} column="spacing" /></div>
                </th>
                <th onClick={() => handleSegmentSortRequest('reverse_direction')} className="p-4 text-center cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center justify-center gap-1">Reverse<SortIndicator currentSort={segmentSort} column="reverse_direction" /></div>
                </th>
                <th className="p-4 text-center">Mirror</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-center text-[14px]">
              {paginatedSegments.map(ctrl => (
              <tr key={ctrl.id} className="hover:bg-slate-800/30 transition-colors group">
                <td className="p-4">
                  <div className="font-bold text-slate-200">Seg#{ctrl.segment_id}</div>
                  <div className="text-[10px] text-slate-500 uppercase">{ctrl.name}</div>
                </td>
                <td className="font-bold text-slate-200">{ctrl.controller_name?.name}</td>
                <td className="p-4 text-center">
                  <span className="font-bold text-slate-200">{ctrl.start_led}</span>
                </td>
                <td className="p-4 text-center">
                  <span className="text-xs font-mono text-slate-300">{ctrl.stop_led}</span>
                </td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-slate-400 font-mono text-xs">
                    <Sun size={14} className="text-amber-500" />
                    {Math.round((ctrl.seg_bri / 255) * 100)}%
                  </div>
                </td>
                <td className="p-4 text-center">
                  <span className="text-xs font-mono text-slate-300">{ctrl.offset}</span>
                </td>
                <td className="p-4 text-center">
                  <span className="text-xs font-mono text-slate-300">{ctrl.grouping}</span>
                </td>
                <td className="p-4 text-center">
                  <span className="text-xs font-mono text-slate-300">{ctrl.spacing}</span>
                </td>
                <td className="p-4 text-center">
                  <input
                    type="checkbox"
                    value={ctrl.reverse_direction}
                    checked={ctrl.reverse_direction}
                    readOnly
                    onClick={(e) => e.preventDefault()}
                    className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 pointer-events-none"
                  />
                </td>
                <td className="p-4 text-center">
                  <input
                    type="checkbox"
                    value={ctrl.mirror_effect}
                    checked={ctrl.mirror_effect}
                    readOnly
                    onClick={(e) => e.preventDefault()}
                    className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 pointer-events-none"
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
            ))}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        <div className="bg-slate-900/50 border-t border-slate-800 px-4 py-3 flex items-center justify-between flex-wrap gap-3 text-xs font-bold text-slate-400">
            <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select 
                    value={segmentRowsPerPage} 
                    onChange={e => { setSegmentRowsPerPage(Number(e.target.value)); setSegmentPage(1); }}
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
                <span>Page {segmentPage} of {totalSegmentPages}</span>
                <div className="flex gap-1">
                    <button 
                        disabled={segmentPage === 1}
                        onClick={() => setSegmentPage(prev => prev - 1)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button 
                        disabled={segmentPage === totalSegmentPages}
                        onClick={() => setSegmentPage(prev => prev + 1)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* Add & Update Segments Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />

          <form onSubmit={handleSave} className="relative bg-slate-900/80 backdrop-blur-md border border-slate-800/60 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
              <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                {editingSegment ? 'Edit Segment' : 'New Segment'}
              </h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
            </div>

            <div className="p-6 grid grid-cols-3 gap-5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Segment ID</label>
                <input
                  required
                  placeholder='0'
                  type="number"
                  title="Segment ID must be unique per controller. The next available ID will be auto-filled when you select a controller."
                  value={formData.segment_id}
                  onChange={e => setFormData({ ...formData, segment_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Start LED</label>
                <input
                  required
                  placeholder='1'
                  type="number"
                  title="Start LED is the index of the first LED in this segment."
                  value={formData.start_led}
                  onChange={e => setFormData({ ...formData, start_led: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Stop LED</label>
                <input
                  required
                  placeholder='200'
                  type="number"
                  title="Stop LED is the index of the last LED in this segment."
                  value={formData.stop_led}
                  onChange={e => setFormData({ ...formData, stop_led: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="col-span-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Segment Name</label>
                <input
                  placeholder='Wave 1'
                  type="text"
                  title="Segment Name is a user-defined label for this segment to identify it."
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Controller</label>
                <select
                  value={formData.controller_id}
                  title="Select the WLED controller this segment belongs to."
                  onChange={e => {
                    const newControllerId = e.target.value;
                    setFormData({
                      ...formData,
                      controller_id: newControllerId,
                      segment_id: getNextSegmentId(newControllerId),
                      start_led: getNextStartLed(newControllerId),
                      stop_led: getNextStartLed(newControllerId) + 30
                    })
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                >
                  {controllers.length === 0 ? (
                    <option value="">Create a controller first</option>
                  ) : (
                    controllers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} - {c.ip_address}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Offset</label>
                <input
                  required
                  placeholder='0'
                  type="number"
                  title="Offset is the number of LEDs to skip before starting this segment."
                  value={formData.offset}
                  onChange={e => setFormData({ ...formData, offset: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Grouping</label>
                <input
                  required
                  placeholder='1'
                  type="number"
                  title="Grouping is the number of LEDs to group together."
                  value={formData.grouping}
                  onChange={e => setFormData({ ...formData, grouping: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Spacing</label>
                <input
                  required
                  placeholder='0'
                  type="number"
                  title="Spacing is the number of LEDs to skip between each group."
                  value={formData.spacing}
                  onChange={e => setFormData({ ...formData, spacing: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="col-span-3 bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Segment Brightness</label>
                  <span className="text-xs font-mono text-indigo-400 font-bold">{formData.seg_bri}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  title="Segment Brightness is the intensity level for this segment."
                  value={formData.seg_bri}
                  onChange={e => setFormData({ ...formData, seg_bri: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  title="Mirror Effect duplicates the segment's effect on the opposite side."
                  checked={formData.mirror_effect}
                  onChange={e => setFormData({ ...formData, mirror_effect: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                />
                <label className="text-xs font-bold text-slate-300 cursor-pointer">Mirror Effect</label>
              </div>

              <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  title="Reverse Direction reverses the order of LEDs in this segment."
                  checked={formData.reverse_direction}
                  onChange={e => setFormData({ ...formData, reverse_direction: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-0"
                />
                <label className="text-xs font-bold text-slate-300 cursor-pointer">Reverse</label>
              </div>
            </div>

            <div className="p-6 bg-slate-800/30">
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/20">
                {editingSegment ? 'UPDATE SEGMENT' : 'SAVE SEGMENT'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Segment Window */}
      {deletingId && (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setDeletingId(null)} />
          <div className="relative bg-slate-900/80 backdrop-blur-md border border-rose-500/20 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center">
            <div className="bg-rose-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="text-rose-500" size={32} />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Confirm Deletion</h2>
            <p className="text-slate-400 text-sm mt-3">This will remove the segment from the controller and no longer show effects.</p>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setDeletingId(null)} className="flex-1 bg-slate-800 text-slate-300 font-bold py-3 rounded-xl cursor-pointer">CANCEL</button>
              <button onClick={() => handleDelete(deletingId)} className="flex-1 bg-rose-600 text-white font-bold py-3 rounded-xl cursor-pointer">DELETE SEGMENT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}