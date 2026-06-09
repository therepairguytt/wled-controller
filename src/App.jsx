import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import api from './services/api'
import {
  LayoutDashboard, Database, Layers, ListMusic, GlobeOff,
  Radio, Search, Settings2, SplitSquareVertical, CalendarCheck, Palette, ScrollText, Radar
} from 'lucide-react'

// Page Imports
import Dashboard from './pages/dashboard'
import Controllers from './pages/controllers'
import Segments from './pages/segments'
import Presets from './pages/presets'
import Playlists from './pages/playlists'
import Schedule from './pages/schedule'
import Broadcasts from './pages/broadcast'
import Query from './pages/query'
import Settings from './pages/settings'
import Footer from './components/footer'
import Header from './components/header'
import Navbar from './components/navbar'
import PalletsEffects from './pages/palletsandeffects'
import Logs from './pages/logs'
import Discovery from './pages/discovery'

export default function App() {

  const menuItems = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, component: <Dashboard /> },
    { id: 'controllers', label: 'Controllers', icon: <Database size={18} />, component: <Controllers /> },
    { id: 'discovery', label: 'Discovery', icon: <Radar size={18} />, component: <Discovery /> },
    { id: 'segments', label: 'Segments', icon: <SplitSquareVertical size={18} />, component: <Segments /> },
    { id: 'presets', label: 'Presets', icon: <Layers size={18} />, component: <Presets /> },
    { id: 'playlists', label: 'Playlists', icon: <ListMusic size={18} />, component: <Playlists /> },
    { id: 'broadcasts', label: 'Broadcasts', icon: <Radio size={18} />, component: <Broadcasts /> },
    { id: 'schedule', label: 'Schedule', icon: <CalendarCheck size={18} />, component: <Schedule /> },
    { id: 'query', label: 'Query', icon: <Search size={18} />, component: <Query /> },
    { id: 'palletseffects', label: 'Pallets & Effects', icon: <Palette size={18} />, component: <PalletsEffects /> },
    { id: 'logs',           label: 'Logs',              icon: <ScrollText size={18} />, component: <Logs /> },
    { id: 'settings',       label: 'Settings',          icon: <Settings2 size={18} />, component: <Settings /> },
  ], []);

  const [systemStatus, setSystemStatus] = useState({ api: 'checking', database: 'checking' })
  const [loading, setLoading] = useState(true)

  const verifySystemHealth = useCallback(async () => {
    try {
      const res = await api.get('/api/health')
      setSystemStatus(res.data)
    } catch (err) {
      console.error("Global Health Interception Failure:", err)
      if (err.response && err.response.data && err.response.data.detail) {
        setSystemStatus(err.response.data.detail)
      } else {
        setSystemStatus({ api: 'down', database: 'down' })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    verifySystemHealth()
    const interval = setInterval(verifySystemHealth, 15000)
    return () => clearInterval(interval)
  }, [verifySystemHealth])

  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return menuItems.find(item => item.id === hash) ? hash : 'dashboard';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && menuItems.find(item => item.id === hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [menuItems]);

  const navigateTo = (id) => {
    window.location.hash = id;
    setActiveTab(id);
  };

  const [isCollapsed, setIsCollapsed] = useState(false);
  const activeItem = menuItems.find(item => item.id === activeTab);

  const isSystemOnline = systemStatus.api === 'up' && systemStatus.database === 'up'

  if (loading && systemStatus.api === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950">
        <div className="text-slate-500 animate-pulse font-mono text-[10px] tracking-[0.4em] uppercase">
          Initializing Core Engine...
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-white font-sans">

      <Header isCollapsed={isCollapsed} systemStatus={systemStatus} />

      <Navbar
        menuItems={menuItems}
        activeTab={activeTab}
        navigateTo={navigateTo}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      <main className={`flex-1 pt-20 pb-24 transition-all duration-300 w-full overflow-x-hidden
        ${isCollapsed ? 'lg:ml-20' : 'lg:ml-52'}
      `}>
        <div className="max-w-8xl mx-auto p-6 md:p-8">

          {!isSystemOnline ? (
            <div className="flex items-center justify-center min-h-[60vh] animate-in fade-in duration-500">
              <div className="bg-rose-500/10 border border-rose-500/20 p-12 rounded-3xl text-center max-w-xl w-full backdrop-blur-md shadow-2xl">
                <GlobeOff className="mx-auto text-rose-500 mb-4 animate-bounce" size={40} />
                <h3 className="text-rose-500 font-black uppercase tracking-widest text-sm">System Offline</h3>
                <p className="text-xs text-slate-400 font-mono mt-3 uppercase tracking-wider">
                  {systemStatus.api === 'down' ? 'CRITICAL: API Unreachable' : 'CRITICAL: Database Disconnected'}
                </p>
                <button
                  onClick={verifySystemHealth}
                  className="mt-6 px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-[10px] font-black text-indigo-400 transition-colors uppercase tracking-wider"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          ) : (
            activeItem ? activeItem.component : <Dashboard />
          )}

        </div>
      </main>

      <Footer isCollapsed={isCollapsed} systemStatus={systemStatus} />
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
        ${active
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
          : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}
      `}
    >
      <span className={`${active ? 'text-white' : 'group-hover:scale-110 transition-transform'}`}>
        {icon}
      </span>
      <span className="font-medium text-sm">{label}</span>
    </button>
  )
}
