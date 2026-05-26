import { useAppConfig } from '../hooks/useAppConfig';

export default function Header({ isCollapsed, systemStatus }) {
  const { config, loading } = useAppConfig();
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

  const apiOnline = systemStatus?.api === 'up';
  const dbOnline = systemStatus?.database === 'up';

  if (loading && !config) {
    return (
      <header className="fixed top-0 left-0 right-0 h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center px-6 z-50 font-mono text-[10px] tracking-[0.4em] text-slate-500 uppercase">
          CONNECTING TO BACKEND...
      </header>
    );
  }

  return (
    <header className={`
      fixed top-0 left-0 right-0 h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 z-40
      transition-all duration-600 flex items-center justify-between px-6
      ${isCollapsed ? 'lg:pl-20' : 'lg:pl-52'} 
    `}>
      <div className="flex items-center gap-4 px-8">
        
        <h1 className="text-sm font-bold text-slate-100 uppercase tracking-tight">
          {import.meta.env.VITE_APP_NAME || "WLED CONTROLLER"}
        </h1>

        <div className="flex items-center gap-2">
          
          <div className={`flex items-baseline gap-1.5 px-2 py-0.5 rounded-md border transition-colors ${
            apiOnline ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/5 border-rose-500/10'
          }`}>
            <div className={`h-1.5 w-1.5 rounded-full ${
              apiOnline 
                ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse' 
                : 'bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-pulse'
            }`} />
            <span className={`text-[11px] font-black uppercase tracking-wider font-mono ${
              apiOnline ? 'text-emerald-500/80' : 'text-rose-500/80'
            }`}>
              API
            </span>
          </div>

          <div className={`flex items-baseline gap-1.5 px-2 py-0.5 rounded-md border transition-colors ${
            dbOnline ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/5 border-rose-500/10'
          }`}>
            <div className={`h-1.5 w-1.5 rounded-full ${
              dbOnline 
                ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse' 
                : 'bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-pulse'
            }`} />
            <span className={`text-[11px] font-black uppercase tracking-wider font-mono ${
              dbOnline ? 'text-emerald-500/80' : 'text-rose-500/80'
            }`}>
              DB
            </span>
          </div>

        </div>
      </div>
      
      <div className="grid auto-col-min items-center gap-1 text-[11px] font-mono">
        <div className="text-slate-500 uppercase hidden md:block">
          Frontend: 
          <a
            href={appAddress}
            onClick={appNavigation}
            className="cursor-pointer hover:text-white hover:bg-indigo-800 hover:font-bold hover:underline hover:rounded transition-all ml-1"
          >
            <span className="text-slate-300">{appHost}:{appPort}</span>
          </a>
        </div>
        <div className="text-slate-500 uppercase hidden md:block">
          Backend: 
          <a 
            href={apiAddress}
            onClick={apiNavigation}
            className="cursor-pointer hover:text-white hover:bg-indigo-800 hover:font-bold hover:underline hover:rounded transition-all ml-1"
          >
            <span className="text-slate-300">{apiHost}:{apiPort}</span>
          </a>
        </div>
      </div>
    </header>
  );
}
