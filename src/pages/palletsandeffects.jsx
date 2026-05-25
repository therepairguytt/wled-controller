import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { Trash2, Plus, Zap, Edit3, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';

export default function PalletsEffects() {
    const [palettes, setPalettes] = useState([])
    const [isPalettesModalOpen, setIsPalettesModalOpen] = useState(false)
    const [editingPalettes, setEditingPalettes] = useState([])
    const [palettesDeletingId, setPalettesDeletingId] = useState(null)
    const [palettesData, setPalettesData] = useState({
        palettes_id: "",
        name: ""
    })

    const [paletteSort, setPaletteSort] = useState({ column: 'palettes_id', direction: 'asc' });
    const [palettePage, setPalettePage] = useState(1);
    const [paletteRowsPerPage, setPaletteRowsPerPage] = useState(10);

    const [effects, setEffects] = useState([])
    const [isEffectsModalOpen, setIsEffectsModalOpen] = useState(false)
    const [editingEffects, setEditingEffects] = useState([])
    const [effectsDeletingId, setEffectsDeletingId] = useState(null)
    const [effectsData, setEffectsData] = useState({
        effect_id: "",
        name: ""
    })

    const [effectSort, setEffectSort] = useState({ column: 'effect_id', direction: 'asc' });
    const [effectPage, setEffectPage] = useState(1);
    const [effectRowsPerPage, setEffectRowsPerPage] = useState(10);

    const fetchData = useCallback(async () => {
        try {
            const [palettesRes, effectsRes] = await Promise.all([
                api.get('/api/palettes'),
                api.get('/api/effects')
            ]);
            setPalettes(palettesRes.data);
            setEffects(effectsRes.data);
        } catch (err) {
            console.error("Failed to sync effects or palettes data", err);
        }
    }, []);

    useEffect(() => { fetchData() }, [fetchData])

    const handlePaletteSortRequest = (column) => {
        let direction = 'asc';
        if (paletteSort.column === column && paletteSort.direction === 'asc') {
            direction = 'desc';
        }
        setPaletteSort({ column, direction });
        setPalettePage(1);
    };

    const handleEffectSortRequest = (column) => {
        let direction = 'asc';
        if (effectSort.column === column && effectSort.direction === 'asc') {
            direction = 'desc';
        }
        setEffectSort({ column, direction });
        setEffectPage(1);
    };

    const sortedPalettes = useMemo(() => {
        const sortableItems = [...palettes];
        if (paletteSort.column !== null) {
            sortableItems.sort((a, b) => {
                let aVal = a[paletteSort.column];
                let bVal = b[paletteSort.column];

                if (paletteSort.column === 'palettes_id') {
                    return paletteSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
                }

                aVal = aVal?.toString().toLowerCase() || '';
                bVal = bVal?.toString().toLowerCase() || '';
                if (aVal < bVal) return paletteSort.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return paletteSort.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [palettes, paletteSort]);

    const sortedEffects = useMemo(() => {
        const sortableItems = [...effects];
        if (effectSort.column !== null) {
            sortableItems.sort((a, b) => {
                let aVal = a[effectSort.column];
                let bVal = b[effectSort.column];

                if (effectSort.column === 'effect_id') {
                    return effectSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
                }

                aVal = aVal?.toString().toLowerCase() || '';
                bVal = bVal?.toString().toLowerCase() || '';
                if (aVal < bVal) return effectSort.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return effectSort.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [effects, effectSort]);

    const totalPalettePages = Math.ceil(sortedPalettes.length / paletteRowsPerPage) || 1;
    const paginatedPalettes = useMemo(() => {
        const startIndex = (palettePage - 1) * paletteRowsPerPage;
        return sortedPalettes.slice(startIndex, startIndex + paletteRowsPerPage);
    }, [sortedPalettes, palettePage, paletteRowsPerPage]);

    const totalEffectPages = Math.ceil(sortedEffects.length / effectRowsPerPage) || 1;
    const paginatedEffects = useMemo(() => {
        const startIndex = (effectPage - 1) * effectRowsPerPage;
        return sortedEffects.slice(startIndex, startIndex + effectRowsPerPage);
    }, [sortedEffects, effectPage, effectRowsPerPage]);

    const SortIndicator = ({ currentSort, column }) => {
        if (currentSort.column !== column) return <ArrowUpDown size={14} className="opacity-40" />;
        return currentSort.direction === 'asc' 
            ? <ArrowUp size={14} className="text-indigo-400" /> 
            : <ArrowDown size={14} className="text-indigo-400" />;
    };

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
    };

    const palettesSave = async (e) => {
        e.preventDefault()
        const paletteIdInt = parseInt(palettesData.palettes_id, 10)
        if (isNaN(paletteIdInt)) {
            alert("Please select or create a valid playlist!")
            return
        }
        const payload = { ...palettesData, palettes_id: paletteIdInt }

        try {
            if (editingPalettes) {
                await api.put(`/api/palettes/${editingPalettes.id}`, payload)
            } else {
                await api.post('/api/palettes', payload)
            }
            fetchData()
            setIsPalettesModalOpen(false)
        } catch (err) {
            alert("Error saving Palettes info: " + (err.response?.data?.detail?.[0]?.msg || err.message))
        }
    };

    const handleDeletePalettes = async (id) => {
        try {
            await api.delete(`/api/palettes/${id}`);
            fetchData();
            setPalettesDeletingId(null);
            if (paginatedPalettes.length === 1 && palettePage > 1) {
                setPalettePage(prev => prev - 1);
            }
        } catch (err) {
            const errorMessage = err.response?.data?.detail
                ? (typeof err.response.data.detail === 'string' ? err.response.data.detail : JSON.stringify(err.response.data.detail))
                : "An unexpected error occurred.";
            alert(`Failed to delete: ${errorMessage}`);
        }
    };

    const effectsModal = (effects = null) => {
        if (effects) {
            setEditingEffects(effects)
            setEffectsData({
                effect_id: effects.effect_id,
                name: effects.name
            })
        } else {
            setEditingEffects(null)
            setEffectsData({
                effect_id: "",
                name: ""
            })
        }
        setIsEffectsModalOpen(true)
    };

    const effectsSave = async (e) => {
        e.preventDefault()
        const effectsIdInt = parseInt(effectsData.effect_id, 10)
        if (isNaN(effectsIdInt)) {
            alert("Please select or create a valid effect!")
            return
        }
        const payload = { ...effectsData, effect_id: effectsIdInt }

        try {
            if (editingEffects) {
                await api.put(`/api/effects/${editingEffects.id}`, payload)
            } else {
                await api.post('/api/effects', payload)
            }
            fetchData()
            setIsEffectsModalOpen(false)
        } catch (err) {
            alert("Error saving Effects info: " + (err.response?.data?.detail?.[0]?.msg || err.message))
        }
    };

    const handleDeleteEffects = async (id) => {
        try {
            await api.delete(`/api/effects/${id}`);
            fetchData();
            setEffectsDeletingId(null);
            if (paginatedEffects.length === 1 && effectPage > 1) {
                setEffectPage(prev => prev - 1);
            }
        } catch (err) {
            const errorMessage = err.response?.data?.detail
                ? (typeof err.response.data.detail === 'string' ? err.response.data.detail : JSON.stringify(err.response.data.detail))
                : "An unexpected error occurred.";
            alert(`Failed to delete: ${errorMessage}`);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl flex-1 overflow-auto mx-auto p-4">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
                    <Zap size={24} />
                </div>
                <h1 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Palettes & Effects</h1>
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
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                    <table className="w-full text-center text-sm table-auto">
                        <thead className="bg-slate-700/50 text-slate-400 font-bold uppercase text-[13px] tracking-widest select-none">
                            <tr>
                                <th onClick={() => handlePaletteSortRequest('palettes_id')} className="p-4 cursor-pointer hover:bg-slate-700/80 hover:text-white transition-colors">
                                    <div className="flex items-center justify-center gap-2">Palette ID <SortIndicator currentSort={paletteSort} column="palettes_id" /></div>
                                </th>
                                <th onClick={() => handlePaletteSortRequest('name')} className="p-4 cursor-pointer hover:bg-slate-700/80 hover:text-white transition-colors">
                                    <div className="flex items-center justify-center gap-2">Palette name <SortIndicator currentSort={paletteSort} column="name" /></div>
                                </th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-center text-[14px]">
                            {paginatedPalettes.length > 0 ? (
                                paginatedPalettes.map(pal => (
                                    <tr key={pal.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="text-slate-200 font-mono p-4">{pal.palettes_id}</td>
                                        <td className="text-slate-200 font-mono p-4">{pal.name}</td>
                                        <td className="p-2 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => palettesModal(pal)} className="cursor-pointer p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setPalettesDeletingId(pal.id)}
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
                                        No Palettes Defined.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* PALETTE PAGINATION FOOTER CONTROL */}
                    <div className="bg-slate-900/50 border-t border-slate-800 px-4 py-3 flex items-center justify-between flex-wrap gap-3 text-xs font-bold text-slate-400">
                        <div className="flex items-center gap-2">
                            <span>Rows per page:</span>
                            <select 
                                value={paletteRowsPerPage} 
                                onChange={e => { setPaletteRowsPerPage(Number(e.target.value)); setPalettePage(1); }}
                                className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 outline-none cursor-pointer"
                            >
                                {[5, 10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-4">
                            <span>Page {palettePage} of {totalPalettePages}</span>
                            <div className="flex gap-1">
                                <button 
                                    disabled={palettePage === 1}
                                    onClick={() => setPalettePage(prev => prev - 1)}
                                    className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button 
                                    disabled={palettePage === totalPalettePages}
                                    onClick={() => setPalettePage(prev => prev + 1)}
                                    className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Palettes Modals */}
                {isPalettesModalOpen && (
                    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsPalettesModalOpen(false)} />
                        <form onSubmit={palettesSave} className="relative bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
                                <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                                    {editingPalettes ? 'Edit Palette' : 'Create Palette'}
                                </h2>
                                <button type="button" onClick={() => setIsPalettesModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
                            </div>
                            <div className="p-6 grid grid-cols-3 gap-5">
                                <div className="col-span-1">
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
                            </div>
                            <div className="p-6 bg-slate-800/30">
                                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/20">
                                    {editingPalettes ? 'UPDATE PALETTE' : 'CREATE PALETTE'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {palettesDeletingId && (
                    <div className="fixed inset-0 z-110 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setPalettesDeletingId(null)} />
                        <div className="relative bg-slate-900 border border-rose-500/20 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center">
                            <div className="bg-rose-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Trash2 className="text-rose-500" size={32} />
                            </div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">Confirm Deletion</h2>
                            <p className="text-slate-400 text-sm mt-3">This will permanently remove this palette from your system.</p>
                            <div className="flex gap-3 mt-8">
                                <button type="button" onClick={() => setPalettesDeletingId(null)} className="flex-1 bg-slate-800 text-slate-300 font-bold py-3 rounded-xl cursor-pointer">CANCEL</button>
                                <button type="button" onClick={() => handleDeletePalettes(palettesDeletingId)} className="flex-1 bg-rose-600 text-white font-bold py-3 rounded-xl cursor-pointer">DELETE PALETTE</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Effects Management Section */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl">
                <div className="flex justify-between pb-4 items-baseline">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Effects Management</h3>
                    <button
                        onClick={() => effectsModal()}
                        className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <Plus size={16} /> CREATE EFFECT
                    </button>
                </div>
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                    <table className="w-full text-center text-sm table-auto">
                        <thead className="bg-slate-700/50 text-slate-400 font-bold uppercase text-[13px] tracking-widest select-none">
                            <tr>
                                <th onClick={() => handleEffectSortRequest('effect_id')} className="p-4 cursor-pointer hover:bg-slate-700/80 hover:text-white transition-colors">
                                    <div className="flex items-center justify-center gap-2">Effect ID <SortIndicator currentSort={effectSort} column="effect_id" /></div>
                                </th>
                                <th onClick={() => handleEffectSortRequest('name')} className="p-4 cursor-pointer hover:bg-slate-700/80 hover:text-white transition-colors">
                                    <div className="flex items-center justify-center gap-2">Effect name <SortIndicator currentSort={effectSort} column="name" /></div>
                                </th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-center text-[14px]">
                            {paginatedEffects.length > 0 ? (
                                paginatedEffects.map(efft => (
                                    <tr key={efft.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="text-slate-200 font-mono p-4">{efft.effect_id}</td>
                                        <td className="text-slate-200 font-mono p-4">{efft.name}</td>
                                        <td className="p-2 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => effectsModal(efft)} className="cursor-pointer p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setEffectsDeletingId(efft.id)}
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
                                        No Effects Defined.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* EFFECT PAGINATION FOOTER CONTROL */}
                    <div className="bg-slate-900/50 border-t border-slate-800 px-4 py-3 flex items-center justify-between flex-wrap gap-3 text-xs font-bold text-slate-400">
                        <div className="flex items-center gap-2">
                            <span>Rows per page:</span>
                            <select 
                                value={effectRowsPerPage} 
                                onChange={e => { setEffectRowsPerPage(Number(e.target.value)); setEffectPage(1); }}
                                className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 outline-none cursor-pointer"
                            >
                                {[5, 10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-4">
                            <span>Page {effectPage} of {totalEffectPages}</span>
                            <div className="flex gap-1">
                                <button 
                                    disabled={effectPage === 1}
                                    onClick={() => setEffectPage(prev => prev - 1)}
                                    className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button 
                                    disabled={effectPage === totalEffectPages}
                                    onClick={() => setEffectPage(prev => prev + 1)}
                                    className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Effects Modals */}
                {isEffectsModalOpen && (
                    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsEffectsModalOpen(false)} />
                        <form onSubmit={effectsSave} className="relative bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
                                <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                                    {editingEffects ? 'Edit Effect' : 'Create Effect'}
                                </h2>
                                <button type="button" onClick={() => setIsEffectsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
                            </div>
                            <div className="p-6 grid grid-cols-3 gap-5">
                                <div className="col-span-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Effect ID</label>
                                    <input
                                        required
                                        type="number"
                                        placeholder='140'
                                        value={effectsData.effect_id}
                                        onChange={e => setEffectsData({ ...effectsData, effect_id: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Effect Name</label>
                                    <input
                                        required
                                        placeholder='Custom Effect'
                                        value={effectsData.name}
                                        onChange={e => setEffectsData({ ...effectsData, name: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1 text-slate-200 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div className="p-6 bg-slate-800/30">
                                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/20">
                                    {editingEffects ? 'UPDATE EFFECT' : 'CREATE EFFECT'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {effectsDeletingId && (
                    <div className="fixed inset-0 z-110 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setEffectsDeletingId(null)} />
                        <div className="relative bg-slate-900 border border-rose-500/20 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center">
                            <div className="bg-rose-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Trash2 className="text-rose-500" size={32} />
                            </div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">Confirm Deletion</h2>
                            <p className="text-slate-400 text-sm mt-3">This will permanently remove this effect from your system.</p>
                            <div className="flex gap-3 mt-8">
                                <button type="button" onClick={() => setEffectsDeletingId(null)} className="flex-1 bg-slate-800 text-slate-300 font-bold py-3 rounded-xl cursor-pointer">CANCEL</button>
                                <button type="button" onClick={() => handleDeleteEffects(effectsDeletingId)} className="flex-1 bg-rose-600 text-white font-bold py-3 rounded-xl cursor-pointer">DELETE EFFECT</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}