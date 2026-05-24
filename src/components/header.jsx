import { useState, useEffect } from 'react';
import { useAppConfig } from '../hooks/useAppConfig';

export default function Header({ isCollapsed }) {
  const { config, loading } = useAppConfig();
  const [isApiOnline, setIsApiOnline] = useState(true);
  const appHost = import.meta.env.VITE_APP_HOST;
  const appPort = parseInt(import.meta.env.VITE_APP_PORT);
  const apiHost = import.meta.env.VITE_API_HOST;
  const apiPort = parseInt(import.meta.env.VITE_API_PORT);
  const appAddress = `http://${appHost}:${appPort}`;
  const apiAddress = `http://${apiHost}:${apiPort}/docs`;

  const appNavigation = (e) => {
    e.preventDefault();
  
    const appWindow = window.open();
    if (appWindow) {
      appWindow.opener = null;
      appWindow.location.href = appAddress;
    }
  };
  
  const apiNavigation = (e) => {
    e.preventDefault();
  
    const apiWindow = window.open();
    if (apiWindow) {
      apiWindow.opener = null;
      apiWindow.location.href = apiAddress;
    }
  };

  useEffect(() => {
    const handleStatusChange = (e) => {
        setIsApiOnline(e.detail.online);
    };

    window.addEventListener('api-status', handleStatusChange);
    return () => window.removeEventListener('api-status', handleStatusChange);
  }, []);

  if (loading && !config) {
    return (
      <header className="fixed top-0 left-0 right-0 h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center px-6 z-50">
          CONNECTING TO BACKEND...
      </header>
    );
  }

  return (
    <header className={`
      fixed top-0 left-0 right-0 h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 z-40
      transition-all duration-300 flex items-center justify-between px-6
      ${isCollapsed ? 'lg:pl-20' : 'lg:pl-52'} 
    `}>
      <div className="flex items-center gap-4 px-8">
        
        <h1 className="text-sm font-bold text-slate-100 uppercase">
          {import.meta.env.VITE_APP_NAME || "WLED CONTROLLER"}
        </h1>

        {/* THE DYNAMIC INDICATOR */}
        <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border transition-colors ${
          isApiOnline ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'
        }`}>
          <div className={`h-1.5 w-1.5 rounded-full ${
            isApiOnline 
              ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' 
              : 'bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-pulse'
          }`} />
          <span className={`text-[9px] font-black uppercase tracking-tighter ${
            isApiOnline ? 'text-emerald-500' : 'text-rose-500'
          }`}>
            {isApiOnline ? 'System Online' : 'Unreachable'}
          </span>
        </div>
      </div>
      
      <div className="grid auto-col-min items-center gap-1 text-[11px] font-mono">
        <div className="text-slate-500 uppercase hidden md:block">
          Frontend: 
          <a
            href={appAddress}
            onClick={appNavigation}
            className="cursor-pointer hover:text-white hover:bg-indigo-800 hover:font-bold hover:underline hover:rounded transition-all"
            >
              <span className="text-slate-300">{appHost}:{appPort}</span>
            </a>
        </div>
        <div className="text-slate-500 uppercase hidden md:block">
          Backend: 
          <a 
            href={apiAddress}
            onClick={apiNavigation}
            className="cursor-pointer hover:text-white hover:bg-indigo-800 hover:font-bold hover:underline hover:rounded transition-all"
          >
            <span className="text-slate-300">{apiHost}:{apiPort}</span>
          </a>
        </div>
      </div>
    </header>
  );
}