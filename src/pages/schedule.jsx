import React from 'react';
import { Hammer, RefreshCcw, Database, HardHat, CodeXml, FileStack } from 'lucide-react';

const MaintenancePage = () => {
  return (
    <div className="bg-slate-950 flex items-center justify-center font-sans selection:bg-amber-500/30">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-2xl w-full">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-2 md:p-12 shadow-2xl overflow-hidden">
          
          {/* Header Icon */}
          <div className="flex items-center justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full animate-pulse" />
              <div className="relative bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-inner">
                <Hammer className="w-12 h-12 text-amber-400" />
              </div>
            </div>
          </div>

          <div className="text-center space-y-4 mb-10">
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
              WORK IN <span className="text-amber-500">PROGRESS</span>
            </h1>
            <p className="text-slate-400 text-lg md:text-xl max-w-md mx-auto leading-relaxed">
              Go away! Shoo! 
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            <div className="flex items-start gap-4 p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50">
              <CodeXml className="w-6 h-6 text-blue-400 shrink-0 mt-1" />
              <div>
                <h4 className="text-sm font-bold text-slate-200">DIV Issues</h4>
                <p className="text-xs text-slate-500 mt-1">Trying to figure out why this div is not centering 🥲</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50">
              <FileStack className="w-6 h-6 text-green-400 shrink-0 mt-1" />
              <div>
                <h4 className="text-sm font-bold text-slate-200">PEBKAC Errors</h4>
                <p className="text-xs text-slate-500 mt-1">Problem Exist Between Keyboard and Chair. ID10T</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            <div className="flex justify-between items-end">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Progress</span>
              <span className="text-sm font-bold text-amber-500">45%</span>
            </div>
            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700">
              <div className="bg-linear-to-r from-amber-600 to-amber-400 h-full rounded-full transition-all duration-1000 w-[45%]" />
            </div>
            <p className="text-[14px] text-center text-slate-400 italic">
              Estimated time of completion: 👀🤷‍♂️
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <button 
              onClick={() => window.location.reload()}
              className="group flex items-center gap-2 px-8 py-3 bg-white text-slate-950 font-bold rounded-full hover:bg-amber-400 transition-all active:scale-95"
            >
              <RefreshCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              Refresh System
            </button>
            <div className="flex items-center gap-2 text-slate-600 text-[10px] uppercase font-bold tracking-widest">
              <HardHat className="w-3 h-3" />
              Coffee Needed 🍵
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MaintenancePage;