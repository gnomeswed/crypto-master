'use client';

import { 
  LayoutDashboard, 
  History, 
  Settings, 
  LineChart, 
  Bell 
} from 'lucide-react';

import DashboardView from '@/components/Views/DashboardView';
import HistoryView from '@/components/Views/HistoryView';
import SettingsView from '@/components/Views/SettingsView';
import { useSignals } from '@/lib/SignalContext';

export default function SaaSLayout() {
  const { activeView, setActiveView } = useSignals();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900 text-slate-200">
      
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800/60 bg-slate-900/80 backdrop-blur-3xl flex flex-col relative z-20">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-saas-glow">
            <LineChart className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">NextTrade</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          <button 
            onClick={() => setActiveView('DASHBOARD')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${activeView === 'DASHBOARD' ? 'bg-brand-500/10 text-brand-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Painel Live
          </button>
          
          <button 
            onClick={() => setActiveView('HISTORY')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${activeView === 'HISTORY' ? 'bg-brand-500/10 text-brand-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <History className="w-4 h-4" />
            Oportunidades Elite
          </button>

          <button 
            onClick={() => setActiveView('SETTINGS')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${activeView === 'SETTINGS' ? 'bg-brand-500/10 text-brand-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <Settings className="w-4 h-4" />
            Cálculo de Banca
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800/60">
          <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            Bybit API Online
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative h-full">
        <header className="h-16 border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-8 z-10">
          <h2 className="text-sm font-semibold text-slate-300">
            {activeView === 'DASHBOARD' && 'Rainel Live de Liquidez'}
            {activeView === 'HISTORY' && 'Oportunidades de Elite'}
            {activeView === 'SETTINGS' && 'Ajustes de Risco'}
          </h2>
          <div className="flex items-center gap-4">
            <button className="relative text-slate-400 hover:text-slate-200 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-brand-500 rounded-full border-2 border-slate-900"></span>
            </button>
            <div className="h-4 w-px bg-slate-800"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">
                SW
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-600/10 blur-[120px] rounded-full pointer-events-none"></div>
          <div className="relative z-10 max-w-7xl mx-auto h-full">
            {activeView === 'DASHBOARD' && <DashboardView />}
            {activeView === 'HISTORY' && <HistoryView />}
            {activeView === 'SETTINGS' && <SettingsView />}
          </div>
        </div>
      </main>
    </div>
  );
}
