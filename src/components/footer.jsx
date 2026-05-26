import { useAppConfig } from '../hooks/useAppConfig';

export default function Footer({ isCollapsed, systemStatus }) {
  const { config, loading } = useAppConfig();

  const apiStatus = systemStatus?.api || 'checking';
  const dbStatus = systemStatus?.database || 'checking';

  const layoutClasses = `
    fixed bottom-0 left-0 right-0 h-12 
    bg-slate-900/40 backdrop-blur-xl border-t border-slate-800/60 
    transition-all duration-600 z-30 flex items-center px-6
    ${isCollapsed ? 'lg:pl-20' : 'lg:pl-52'}
  `;

  if (loading && !config) {
    return (
      <footer className={layoutClasses}>
        <div className="text-[10px] text-slate-500 font-mono tracking-[0.2em] animate-pulse uppercase">
          Initializing Footer...
        </div>
      </footer>
    );
  }

  return (
    <footer className={`${layoutClasses} justify-between`}>
      <div className="flex items-center gap-4 px-4">
        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.15em]">
          Copyright &copy; {new Date().getFullYear()} {config?.copyright_name || "WLED CONTROLLER"}. ALL RIGHTS RESERVED.
        </span>
      </div>

      <div className="flex items-center gap-6 font-mono text-[9px] tracking-wider text-slate-500">
        <div className="hidden md:flex items-center gap-1.5 uppercase">
          <span>LOG:</span>
          <span className={apiStatus === 'up' && dbStatus === 'up' ? 'text-indigo-400 font-bold' : 'text-rose-400 font-bold'}>
            {apiStatus === 'up' && dbStatus === 'up' ? 'STACK_NOMINAL' : 'DEGRADED_STATE'}
          </span>
        </div>

        <div className="hidden sm:block uppercase">
          VERSION: <span className="text-slate-400">{__APP_VERSION__}</span>
        </div>
      </div>
    </footer>
  );
}