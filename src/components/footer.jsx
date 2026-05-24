import { useAppConfig } from '../hooks/useAppConfig';

export default function Footer({ isCollapsed }) {
  const { config, loading } = useAppConfig();

  const layoutClasses = `
    fixed bottom-0 left-0 right-0 h-12 
    bg-slate-900/80 backdrop-blur-md border-t border-slate-800 
    transition-all duration-300 z-50 flex items-center px-6
    ${isCollapsed ? 'lg:pl-20' : 'lg:pl-52'}
  `;

  if (loading && !config) {
    return (
      <footer className={layoutClasses}>
        <div className="text-[10px] text-slate-400 font-mono animate-pulse">
          INITIALIZING SYSTEM...
        </div>
      </footer>
    );
  }

  return (
    <footer className={`${layoutClasses} justify-between`}>
      <div className="flex items-center gap-4 px-4">
        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">
          Copyright &copy; {new Date().getFullYear()} {config?.copyright_name}. All rights reserved.
        </span>
      </div>
      
      <div className="text-[10px] text-slate-500 font-medium hidden sm:block">
        VERSION: BETA 26.5.001
      </div>
    </footer>
  );
}