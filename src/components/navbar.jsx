import { useState, useEffect } from 'react';
import { Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';

function DynamicLogo() {
  const [logoSrc, setLogoSrc] = useState(null);

  useEffect(() => {
    const possibleExtensions = ['png', 'svg', 'jpg', 'jpeg'];

    const verifyImageExtensions = async () => {
      for (const ext of possibleExtensions) {
        const testPath = `/logo.${ext}`;
        try {
          const response = await fetch(testPath, { method: 'HEAD' });
          if (response.ok) {
            setLogoSrc(testPath);
            return;
          }
        } catch (err) {
          console.error(`Error checking logo-test.${ext}:`, err);
        }
      }
      setLogoSrc(null);
    };

    verifyImageExtensions();
  }, []);

  if (!logoSrc) {
    return (
      <div className="h-8 w-8 rounded-xl bg-linear-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.4)] border border-indigo-400/20 shrink-0">
        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={logoSrc}
      alt="System Logo"
      className="h-10 w-10 rounded-xl object-contain shadow-[0_0_15px_rgba(255,255,255,0.05)] shrink-0"
      onError={(e) => {
        e.target.style.display = 'none';
      }}
    />
  );
}


export default function Navbar({ menuItems, activeTab, navigateTo, isCollapsed, setIsCollapsed }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isExpanded = !isCollapsed || isHovered;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer lg:hidden fixed top-3 left-4 z-50 p-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl text-indigo-400 hover:text-indigo-300 shadow-lg"
      >
        {isOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <aside
        onMouseEnter={() => isCollapsed && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          /* FIXED SHARED LAYOUT FOUNDATION */
          fixed top-0 bottom-0 left-0 h-screen z-40 p-4 pt-20 transition-all duration-600 ease-out
          
          /* MOBILE ONLY RULES: Safely isolated via max-lg prefix */
          max-lg:fixed max-lg:w-52 max-lg:bg-slate-900/95 max-lg:backdrop-blur-xl max-lg:border-r max-lg:border-slate-800/60 max-lg:pt-15
          ${isOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'} 
          
          /* DESKTOP ONLY DESIGN: Locked into position */
          lg:bg-slate-900/60 lg:backdrop-blur-xl lg:border-r lg:border-slate-800/60 lg:translate-x-0 lg:pt-8
          ${isExpanded ? 'lg:w-52' : 'lg:w-20'}
          
          /* Glowing sidebar aura effect on desktop hover expansion */
          ${isHovered ? 'shadow-[5px_0_30px_rgba(0,0,0,0.8)] ring-1 ring-slate-800/50' : 'shadow-xl'}
        `}
      >

        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
            setIsHovered(false);
          }}
          className={`
            ${isCollapsed && !isHovered ? 'hidden' : 'cursor-pointer lg:flex items-center justify-center absolute -right-3 top-20 bg-slate-950 border border-slate-800/80 rounded-full h-6 w-6 text-slate-500 hover:text-white hover:border-slate-600 transition-all z-50'}
            `}
        >
          {isCollapsed ? <ChevronRight size={12} strokeWidth={3} /> : <ChevronLeft size={12} strokeWidth={3} />}
        </button>

        <div className={`
              flex items-center gap-3 mb-8 px-2 h-10 transition-all duration-600
              ${isExpanded ? 'justify-start' : 'lg:justify-center'}
        `}>

          <DynamicLogo />

          {isExpanded && (
            <div className="flex flex-col animate-in fade-in slide-in-from-left-4 duration-600">
              <span className="text-xs font-black tracking-wider text-slate-100 uppercase font-mono leading-none">
                WLED CONTROLLER
              </span>
              <span className="text-[8px] font-bold text-indigo-400 font-mono tracking-widest mt-1 uppercase leading-none">
                FOSS
              </span>
            </div>
          )}
        </div>

        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  navigateTo(item.id);
                  if (window.innerWidth < 1024) setIsOpen(false);
                }}
                className={`
                  cursor-pointer w-full flex items-center rounded-xl transition-all duration-300 group relative
                  ${isExpanded ? 'px-4 py-2.5 gap-3' : 'justify-center px-0 py-2.5'}
                  ${isActive
                    ? 'bg-indigo-600/10 text-white font-bold border border-indigo-500/30 shadow-[0_0_20px_rgba(79,70,229,0.15)]'
                    : 'hover:bg-slate-850/40 text-slate-400 hover:text-slate-200 border border-transparent'}
                `}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/4 bottom-1/4 w-0.75 bg-indigo-500 rounded-r-full shadow-[0_0_8px_#6366f1]" />
                )}

                <span className={`
                  transition-all duration-300
                  ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-105'}
                `}>
                  {item.icon}
                </span>

                {isExpanded && (
                  <span className={`
                    text-xs font-bold tracking-wide uppercase font-mono transition-colors duration-250
                    ${isActive ? 'text-slate-100' : 'text-slate-400 group-hover:text-slate-200'}
                    whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300
                  `}>
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {isOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-30 lg:hidden" onClick={() => setIsOpen(false)} />
      )}
    </>
  );
}
