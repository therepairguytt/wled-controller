import { useState } from 'react';
import { Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Navbar({ menuItems, activeTab, navigateTo, isCollapsed, setIsCollapsed }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isExpanded = !isCollapsed || isHovered;

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer lg:hidden fixed top-3 left-4 z-70 p-2 bg-indigo-600 rounded-lg text-white"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        onMouseEnter={() => isCollapsed && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          fixed inset-y-0 left-0 z-60 bg-slate-900 border-r border-slate-800 p-4 pt-4
          transform transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
          
          /* Desktop behavior */
          lg:translate-x-0 lg:h-full lg:shrink-0 lg:relative lg:pt-0
          /* Use isExpanded for visual width */
          ${isExpanded ? 'lg:w-52' : 'lg:w-20'}
          /* Add shadow when hovering over a collapsed bar to show depth */
          ${isHovered ? 'shadow-2xl shadow-black ring-1 ring-slate-700' : ''}
        `}
      >
        
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
            setIsHovered(false);
          }}
          className="cursor-pointer hidden lg:flex absolute -right-5 top-2 bg-slate-800 border border-slate-700 rounded-full p-3 text-slate-400 hover:text-white z-70"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={`mt-8 mb-8 px-2 transition-all duration-300 ${isExpanded ? 'opacity-100' : 'lg:opacity-0 lg:invisible'}`}>
          
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                navigateTo(item.id);
                if (window.innerWidth < 1024) setIsOpen(false);
              }}
              className={`
                cursor-pointer w-full flex items-center rounded-xl transition-all duration-200 group
                ${isExpanded ? 'px-4 py-3 gap-3' : 'justify-center px-0 py-3'}
                ${activeTab === item.id 
                  ? 'bg-indigo-600 text-white' 
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}
              `}
            >
              <span className={activeTab === item.id ? 'text-white' : 'group-hover:scale-110 transition-transform'}>
                {item.icon}
              </span>
              
              {isExpanded && (
                <span className="font-medium text-sm whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300">
                  {item.label}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden" onClick={() => setIsOpen(false)} />
      )}
    </>
  );
}