import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../services/api'
import { Edit3, Trash2, Plus, X, ListMusic, ListPlus, Clock, Hash } from 'lucide-react'

export default function Playlists() {
  const [playlists, setPlaylists] = useState([])
  const [presets, setPresets] = useState([])
  
  // Playlist Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [isItemsModalOpen, setIsItemsModalOpen] = useState(false)
  
  const [editingPlaylist, setEditingPlaylist] = useState(null)
  const [managingPlaylist, setManagingPlaylist] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  
  const [formData, setFormData] = useState({
    name: '',
    repeat_forever: true
  })
  
  const [itemFormData, setItemFormData] = useState({
    preset_id: '',
    sort_order: 1,
    duration_seconds: 10
  })

  // Pagination & Sorting
  const [sort, setSort] = useState({ column: 'id', direction: 'asc' });
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchData = useCallback(async () => {
    try {
      const [plRes, prRes] = await Promise.all([
        api.get('/api/playlists'),
        api.get('/api/presets')
      ])
      setPlaylists(plRes.data)
      setPresets(prRes.data)
      
      // If we are currently managing a playlist, update its items
      if (managingPlaylist) {
        const updated = plRes.data.find(p => p.id === managingPlaylist.id)
        if (updated) setManagingPlaylist(updated)
      }
    } catch (err) {
      console.error("Failed to load data", err)
    }
  }, [managingPlaylist])

  useEffect(() => { fetchData() }, [])

  const handleSortRequest = (column) => {
      let direction = 'asc';
      if (sort.column === column && sort.direction === 'asc') {
          direction = 'desc';
      }
      setSort({ column, direction });
      setPage(1);
  };

  const sortedPlaylists = useMemo(() => {
      const sortableItems = [...playlists];
      if (sort.column !== null) {
          sortableItems.sort((a, b) => {
              let aVal = a[sort.column];
              let bVal = b[sort.column];

              if (['id', 'item_count'].includes(sort.column)) {
                  if (sort.column === 'item_count') {
                    aVal = a.items?.length || 0;
                    bVal = b.items?.length || 0;
                  }
                  return sort.direction === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
              }
              if (['repeat_forever'].includes(sort.column)) {
                  return sort.direction === 'asc' ? (aVal === bVal ? 0 : aVal ? 1 : -1) : (aVal === bVal ? 0 : aVal ? -1 : 1);
              }

              aVal = aVal?.toString().toLowerCase() || '';
              bVal = bVal?.toString().toLowerCase() || '';
              if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
              if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
              return 0;
          });
      }
      return sortableItems;
  }, [playlists, sort]);

  const totalPages = Math.ceil(sortedPlaylists.length / rowsPerPage) || 1;
  const paginatedPlaylists = useMemo(() => {
      const startIndex = (page - 1) * rowsPerPage;
      return sortedPlaylists.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedPlaylists, page, rowsPerPage]);

  const SortIndicator = ({ currentSort, column }) => {
      if (currentSort.column !== column) return <span className="opacity-40 ml-1">↕</span>;
      return currentSort.direction === 'asc' 
          ? <span className="text-indigo-400 ml-1">↑</span> 
          : <span className="text-indigo-400 ml-1">↓</span>;
  };

  const openFormModal = (playlist = null) => {
    if (playlist) {
      setEditingPlaylist(playlist)
      setFormData({
        name: playlist.name,
        repeat_forever: playlist.repeat_forever
      })
    } else {
      setEditingPlaylist(null)
      setFormData({ name: '', repeat_forever: true })
    }
    setIsFormModalOpen(true)
  }
  
  const openItemsModal = (playlist) => {
    setManagingPlaylist(playlist)
    setItemFormData({
      preset_id: presets[0]?.id || '',
      sort_order: (playlist.items?.length || 0) + 1,
      duration_seconds: 10
    })
    setIsItemsModalOpen(true)
  }

  const handleSavePlaylist = async (e) => {
    e.preventDefault()
    try {
      if (editingPlaylist) {
        await api.put(`/api/playlists/${editingPlaylist.id}`, formData)
      } else {
        await api.post('/api/playlists', formData)
      }
      fetchData()
      setIsFormModalOpen(false)
    } catch (err) {
      alert("Error saving playlist.")
    }
  }

  const handleDeletePlaylist = async (id) => {
    try {
      await api.delete(`/api/playlists/${id}`);
      fetchData();
      setDeletingId(null);
      if (paginatedPlaylists.length === 1 && page > 1) {
          setPage(prev => prev - 1);
      }
    } catch (err) {
      alert("Error deleting playlist.")
    }
  }

  const handleAddItem = async (e) => {
    e.preventDefault()
    if (!managingPlaylist || !itemFormData.preset_id) return
    
    try {
      await api.post(`/api/playlists/${managingPlaylist.id}/items`, {
        preset_id: parseInt(itemFormData.preset_id),
        sort_order: parseInt(itemFormData.sort_order),
        duration_seconds: parseInt(itemFormData.duration_seconds)
      })
      fetchData()
      setItemFormData({
        ...itemFormData,
        sort_order: parseInt(itemFormData.sort_order) + 1
      })
    } catch (err) {
      alert("Error adding item.")
    }
  }

  const handleDeleteItem = async (itemId) => {
    if (!managingPlaylist) return
    try {
      await api.delete(`/api/playlists/${managingPlaylist.id}/items/${itemId}`)
      fetchData()
    } catch (err) {
      alert("Error deleting item.")
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto p-4 flex-1 overflow-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
            <ListMusic size={24} />
        </div>
        <h1 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Playlists</h1>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800/60 p-6 shadow-xl">
        <div className="flex justify-between pb-4 items-baseline">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Saved Playlists</h3>
            <button
                onClick={() => openFormModal()}
                className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
            >
                <Plus size={16} /> CREATE PLAYLIST
            </button>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-center text-sm table-auto min-w-max">
              <thead className="bg-slate-800/80 text-slate-400 font-bold uppercase text-[13px] tracking-widest select-none">
                <tr>
                  <th onClick={() => handleSortRequest('id')} className="p-4 cursor-pointer hover:text-white transition-colors">
                    ID <SortIndicator currentSort={sort} column="id" />
                  </th>
                  <th onClick={() => handleSortRequest('name')} className="p-4 cursor-pointer hover:text-white transition-colors">
                    Name <SortIndicator currentSort={sort} column="name" />
                  </th>
                  <th onClick={() => handleSortRequest('item_count')} className="p-4 cursor-pointer hover:text-white transition-colors">
                    Items <SortIndicator currentSort={sort} column="item_count" />
                  </th>
                  <th onClick={() => handleSortRequest('repeat_forever')} className="p-4 cursor-pointer hover:text-white transition-colors">
                    Repeat <SortIndicator currentSort={sort} column="repeat_forever" />
                  </th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-center text-[14px]">
                {paginatedPlaylists.length > 0 ? (
                  paginatedPlaylists.map(pl => (
                  <tr key={pl.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 font-mono text-slate-400">{pl.id}</td>
                    <td className="p-4 font-bold text-slate-200">{pl.name}</td>
                    <td className="p-4">
                      <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-xs font-bold border border-indigo-500/20">
                        {pl.items?.length || 0}
                      </span>
                    </td>
                    <td className="p-4">
                      {pl.repeat_forever ? (
                        <span className="text-emerald-400 text-xs font-bold">FOREVER</span>
                      ) : (
                        <span className="text-slate-500 text-xs font-bold">ONCE</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openItemsModal(pl)} className="cursor-pointer px-3 py-1.5 text-xs font-bold bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white rounded-lg transition-all flex items-center gap-1">
                          <ListPlus size={14} /> ITEMS
                        </button>
                        <button onClick={() => openFormModal(pl)} className="cursor-pointer p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                          <Edit3 size={16} />
                        </button>
                        <button onClick={() => setDeletingId(pl.id)} className="cursor-pointer p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
                ) : (
                  <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-600 italic text-xs">
                          No Playlists created.
                      </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="bg-slate-900/50 border-t border-slate-800 px-4 py-3 flex items-center justify-between flex-wrap gap-3 text-xs font-bold text-slate-400">
              <div className="flex items-center gap-2">
                  <span>Rows per page:</span>
                  <select 
                      value={rowsPerPage} 
                      onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 outline-none cursor-pointer hover:bg-slate-800/40"
                  >
                      {[5, 10, 25, 50].map(size => 
                      <option key={size} value={size} className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 outline-none cursor-pointer">
                          {size}
                      </option>)}
                  </select>
              </div>
              <div className="flex items-center gap-4">
                  <span>Page {page} of {totalPages}</span>
                  <div className="flex gap-1">
                      <button 
                          disabled={page === 1}
                          onClick={() => setPage(prev => prev - 1)}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                      >
                          <span className="font-bold px-2">{"<"}</span>
                      </button>
                      <button 
                          disabled={page === totalPages}
                          onClick={() => setPage(prev => prev + 1)}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                      >
                          <span className="font-bold px-2">{">"}</span>
                      </button>
                  </div>
              </div>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsFormModalOpen(false)} />
          <form onSubmit={handleSavePlaylist} className="relative bg-slate-900/90 backdrop-blur-md border border-slate-800/60 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
              <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                {editingPlaylist ? 'Edit Playlist' : 'New Playlist'}
              </h2>
              <button type="button" onClick={() => setIsFormModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Playlist Name</label>
                <input
                  required
                  placeholder='My Awesome Playlist'
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-between bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-200">Repeat Forever</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">Loop items continuously</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.repeat_forever}
                  onChange={e => setFormData({ ...formData, repeat_forever: e.target.checked })}
                  className="w-6 h-6 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 cursor-pointer"
                />
              </div>
            </div>

            <div className="p-6 bg-slate-800/30 border-t border-slate-800">
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/20">
                {editingPlaylist ? 'UPDATE PLAYLIST' : 'SAVE PLAYLIST'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Items Modal */}
      {isItemsModalOpen && managingPlaylist && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsItemsModalOpen(false)} />
          <div className="relative bg-slate-900/90 backdrop-blur-md border border-slate-800/60 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
              <div>
                <h2 className="text-lg font-bold text-white uppercase tracking-tight">Manage Items</h2>
                <p className="text-xs text-indigo-400 font-mono mt-1">{managingPlaylist.name}</p>
              </div>
              <button type="button" onClick={() => setIsItemsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Left side - Items List */}
              <div className="flex-1 overflow-y-auto p-6 border-r border-slate-800 bg-slate-950/30">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Playlist Sequence</h3>
                
                {managingPlaylist.items?.length > 0 ? (
                  <div className="space-y-3">
                    {managingPlaylist.items.sort((a,b) => a.sort_order - b.sort_order).map(item => (
                      <div key={item.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4 group">
                        <div className="w-8 h-8 rounded-full bg-indigo-900/50 text-indigo-400 flex items-center justify-center font-bold text-sm">
                          {item.sort_order}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-slate-200">{item.preset?.name || `Preset ID: ${item.preset_id}`}</h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
                            <Clock size={12} /> {item.duration_seconds}s duration
                          </div>
                        </div>
                        <button onClick={() => handleDeleteItem(item.id)} className="cursor-pointer p-2 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 border border-dashed border-slate-800 rounded-2xl text-slate-600 flex flex-col items-center">
                    <ListMusic size={32} className="mb-3 opacity-20" />
                    <p className="text-sm font-bold">No presets added yet.</p>
                    <p className="text-xs mt-1">Use the form to add presets to this playlist.</p>
                  </div>
                )}
              </div>

              {/* Right side - Add Item Form */}
              <div className="w-full md:w-80 p-6 bg-slate-900 flex flex-col">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Add Preset</h3>
                
                <form onSubmit={handleAddItem} className="space-y-5 flex-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Select Preset</label>
                    <select
                      required
                      value={itemFormData.preset_id}
                      onChange={e => setItemFormData({ ...itemFormData, preset_id: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                    >
                      <option value="" disabled>Select a preset...</option>
                      {presets.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-1"><Clock size={12}/> Duration (Seconds)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={itemFormData.duration_seconds}
                      onChange={e => setItemFormData({ ...itemFormData, duration_seconds: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-1"><Hash size={12}/> Sort Order</label>
                    <input
                      type="number"
                      required
                      value={itemFormData.sort_order}
                      onChange={e => setItemFormData({ ...itemFormData, sort_order: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div className="pt-4 mt-auto">
                    <button type="submit" className="w-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white font-bold py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2">
                      <Plus size={16} /> ADD TO PLAYLIST
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setDeletingId(null)} />
          <div className="relative bg-slate-900 border border-rose-500/20 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center">
            <div className="bg-rose-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="text-rose-500" size={32} />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Confirm Deletion</h2>
            <p className="text-slate-400 text-sm mt-3">This will permanently remove this playlist.</p>
            <div className="flex gap-3 mt-8">
              <button type="button" onClick={() => setDeletingId(null)} className="flex-1 bg-slate-800 text-slate-300 font-bold py-3 rounded-xl cursor-pointer">CANCEL</button>
              <button type="button" onClick={() => handleDeletePlaylist(deletingId)} className="flex-1 bg-rose-600 text-white font-bold py-3 rounded-xl cursor-pointer">DELETE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
