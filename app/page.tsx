'use client';

import { useState } from 'react';
import {
  LayoutDashboard,
  History,
  Settings,
  LineChart,
  Bell,
  Briefcase,
  Menu,
  X,
  ChevronRight,
  ClipboardCheck
} from 'lucide-react';

import DashboardView from '@/components/Views/DashboardView';
import HistoryView from '@/components/Views/HistoryView';
import SettingsView from '@/components/Views/SettingsView';
import PortfolioView from '@/components/Views/PortfolioView';
import ValidatorView from '@/components/Views/ValidatorView';
import { useSignals } from '@/lib/SignalContext';

// ─── Itens de navegação ──────────────────────────────────
const NAV_ITEMS = [
  { id: 'DASHBOARD', label: 'Painel',    icon: LayoutDashboard, mobileLabel: 'Live' },
  { id: 'VALIDATOR', label: 'Validador', icon: ClipboardCheck,  mobileLabel: 'Sinais' },
  { id: 'PORTFOLIO', label: 'Portfólio', icon: Briefcase,        mobileLabel: 'Trades' },
  { id: 'HISTORY',   label: 'Oportunidades', icon: History,      mobileLabel: 'Elite' },
  { id: 'SETTINGS',  label: 'Banca',     icon: Settings,         mobileLabel: 'Banca' },
] as const;

type ViewType = 'DASHBOARD' | 'VALIDATOR' | 'PORTFOLIO' | 'HISTORY' | 'SETTINGS';

export default function SaaSLayout() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen]       = useState(false);
  const { activeView, setActiveView, activeTrades } = useSignals();

  const navigate = (view: ViewType) => {
    setActiveView(view);
    setMobileMenuOpen(false);
    setShowNotifications(false);
  };

  const pageTitle = {
    DASHBOARD: 'Painel Live de Liquidez',
    VALIDATOR: 'Laboratório & Validador de Sinais',
    PORTFOLIO: 'Monitoramento de Portfólio',
    HISTORY:   'Oportunidades de Elite',
    SETTINGS:  'Ajustes de Risco',
  }[activeView];

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-900 text-slate-200">

      {/* ══════════════════════════════════════════════════
          SIDEBAR — visível apenas em lg+
      ══════════════════════════════════════════════════ */}
      <aside className="hidden lg:flex w-64 border-r border-slate-800/60 bg-slate-900/80 backdrop-blur-3xl flex-col relative z-20 shrink-0">
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-saas-glow">
            <LineChart className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">NextTrade</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={`w-full flex items-center ${id === 'PORTFOLIO' ? 'justify-between' : 'gap-3'} px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                activeView === id
                  ? 'bg-brand-500/10 text-brand-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4" />
                {label}
              </div>
              {id === 'PORTFOLIO' && activeTrades.length > 0 && (
                <span className="bg-brand-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.3)]">
                  {activeTrades.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800/60">
          <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Bybit API Online
          </div>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════
          MOBILE SIDEBAR SHEET (drawer lg-)
      ══════════════════════════════════════════════════ */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Sheet */}
          <div className="relative w-72 h-full bg-slate-950 border-r border-slate-800 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200 z-10">
            {/* Header sheet */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center">
                  <LineChart className="text-white w-4 h-4" />
                </div>
                <span className="font-bold text-base text-white">NextTrade</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 p-4 space-y-1">
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => navigate(id)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all text-sm font-medium ${
                    activeView === id
                      ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    {label}
                  </div>
                  <div className="flex items-center gap-2">
                    {id === 'PORTFOLIO' && activeTrades.length > 0 && (
                      <span className="bg-brand-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                        {activeTrades.length}
                      </span>
                    )}
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                  </div>
                </button>
              ))}
            </nav>

            <div className="p-4 border-t border-slate-800">
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Bybit API Online
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">

        {/* ── Top Header ── */}
        <header className="h-14 lg:h-16 border-b border-slate-800/60 bg-slate-900/90 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 z-20 shrink-0">
          {/* Hamburger (mobile only) */}
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-xl hover:bg-slate-800 transition-all"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5 text-slate-400" />
            </button>
            <h2 className="text-xs lg:text-sm font-semibold text-slate-300 truncate max-w-[180px] lg:max-w-none">
              {pageTitle}
            </h2>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3 relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative p-2 rounded-full transition-all ${showNotifications ? 'bg-brand-500/20 text-brand-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Bell className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-brand-500 rounded-full border-2 border-slate-900" />
            </button>

            {/* Notification dropdown */}
            {showNotifications && (
              <div className="absolute top-12 right-0 w-64 lg:w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Status do Sistema</span>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                </div>
                <div className="space-y-3">
                  <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
                    <p className="text-[10px] text-slate-300 font-medium">Scanner Cloud Ativo</p>
                    <p className="text-[9px] text-slate-500 mt-1">Monitorando 25 pares em tempo real.</p>
                  </div>
                  <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
                    <p className="text-[10px] text-slate-300 font-medium">Alertas Visuais</p>
                    <p className="text-[9px] text-slate-500 mt-1">Sinais com score ≥ 11 são destacados.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="w-full mt-4 py-2 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded-lg transition-colors uppercase"
                >
                  Fechar
                </button>
              </div>
            )}

            {/* Avatar */}
            <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] lg:text-xs font-bold text-slate-400">
              SW
            </div>
          </div>
        </header>

        {/* ── Conteúdo principal (scrollável) ── */}
        <div className="flex-1 overflow-y-auto p-3 md:p-5 lg:p-8 relative pb-20 lg:pb-8">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-600/10 blur-[120px] rounded-full pointer-events-none" />
          <div className="relative z-10 max-w-7xl mx-auto">
            {activeView === 'DASHBOARD' && <DashboardView />}
            {activeView === 'VALIDATOR' && <ValidatorView />}
            {activeView === 'PORTFOLIO' && <PortfolioView />}
            {activeView === 'HISTORY'   && <HistoryView />}
            {activeView === 'SETTINGS'  && <SettingsView />}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            BOTTOM NAV BAR — mobile only (< lg)
        ══════════════════════════════════════════════════ */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 safe-area-bottom">
          <div className="flex items-center justify-around px-2 py-2">
            {NAV_ITEMS.map(({ id, mobileLabel, icon: Icon }) => {
              const isActive = activeView === id;
              return (
                <button
                  key={id}
                  onClick={() => navigate(id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all relative ${
                    isActive ? 'text-brand-400' : 'text-slate-500'
                  }`}
                >
                  {/* Active indicator dot */}
                  {isActive && (
                    <span className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-400" />
                  )}
                  <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-brand-500/15' : ''}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wide">{mobileLabel}</span>
                  {/* Badge para portfolio */}
                  {id === 'PORTFOLIO' && activeTrades.length > 0 && (
                    <span className="absolute top-1.5 right-2 w-4 h-4 bg-brand-500 rounded-full text-[8px] font-black text-white flex items-center justify-center">
                      {activeTrades.length > 9 ? '9+' : activeTrades.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

      </main>
    </div>
  );
}
