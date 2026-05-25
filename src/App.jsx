import { useState, useEffect, useMemo } from 'react'
import {
  LayoutDashboard, Database, Layers, ListMusic,
  Radio, Search, Settings2, SplitSquareVertical, CalendarCheck, Palette
} from 'lucide-react'

// Page Imports
import Dashboard from './pages/dashboard'
import Controllers from './pages/controllers'
import Segments from './pages/segments'
import Presets from './pages/presets'
import Playlists from './pages/playlist'
import Schedule from './pages/schedule'
import Broadcasts from './pages/broadcast'
import Query from './pages/query'
import Settings from './pages/settings'
import Footer from './components/footer'
import Header from './components/header'
import Navbar from './components/navbar'
import PalletsEffects from './pages/palletsandeffects'

export default function App() {
  // 1. Define the Navigation Configuration
  const menuItems = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, component: <Dashboard /> },
    { id: 'controllers', label: 'Controllers', icon: <Database size={18} />, component: <Controllers /> },
    { id: 'segments', label: 'Segments', icon: <SplitSquareVertical size={18} />, component: <Segments /> },
    { id: 'presets', label: 'Presets', icon: <Layers size={18} />, component: <Presets /> },
    { id: 'playlists', label: 'Playlists', icon: <ListMusic size={18} />, component: <Playlists /> },
    { id: 'broadcasts', label: 'Broadcasts', icon: <Radio size={18} />, component: <Broadcasts /> },
    { id: 'schedule', label: 'Schedule', icon: <CalendarCheck size={18} />, component: <Schedule /> },
    { id: 'query', label: 'Query', icon: <Search size={18} />, component: <Query /> },
    { id: 'palletseffects', label: 'Pallets & Effects', icon: <Palette size={18} />, component: <PalletsEffects /> },
    { id: 'settings', label: 'Settings', icon: <Settings2 size={18} />, component: <Settings /> },
  ], []);

  // 2. Initialize State from URL Hash
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    // Ensure the hash exists in our menu, otherwise default to dashboard
    return menuItems.find(item => item.id === hash) ? hash : 'dashboard';
  });

  // 3. Sync State with Browser History (Back/Forward buttons)
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

  // 4. Navigation Handler
  const navigateTo = (id) => {
    window.location.hash = id;
    setActiveTab(id);
  };

  const [isCollapsed, setIsCollapsed] = useState(false);

  const activeItem = menuItems.find(item => item.id === activeTab);

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden font-sans">
      
      {/* 1. Pass state to Header so it can shift right */}
      <Header isCollapsed={isCollapsed} />
      
      {/* 2. Pass state and setter to Navbar */}
      <Navbar 
        menuItems={menuItems} 
        activeTab={activeTab} 
        navigateTo={navigateTo}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      <main className={`flex-1 overflow-auto pt-14 pb-12 transition-all duration-300`}>
        <div className="max-w-8xl mx-auto p-4 md:p-8">
           {activeItem ? activeItem.component : <Dashboard />}
        </div>
      </main>

      <Footer isCollapsed={isCollapsed} />
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