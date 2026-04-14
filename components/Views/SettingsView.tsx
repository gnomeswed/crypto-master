'use client';

import { useState, useEffect } from 'react';
import { Shield, Wallet, Percent, Save } from 'lucide-react';

export default function SettingsView() {
  const [banca, setBanca] = useState('1000');
  const [risco, setRisco] = useState('1');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sBanca = localStorage.getItem('trade_banca') || '1000';
    const sRisco = localStorage.getItem('trade_risco') || '1';
    setBanca(sBanca);
    setRisco(sRisco);
  }, []);

  const handleSave = () => {
    localStorage.setItem('trade_banca', banca);
    localStorage.setItem('trade_risco', risco);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">
      
      <div className="saas-card p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-brand-500/10 rounded-2xl border border-brand-500/20 text-brand-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Gestão de Risco & Banca</h2>
            <p className="text-sm text-slate-500">Configure seus limites para que o robô calcule o tamanho das ordens automaticamente.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Wallet className="w-3 h-3" /> Saldo da Banca (USDT)
            </label>
            <input 
              type="number" 
              value={banca}
              onChange={(e) => setBanca(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono focus:border-brand-500 outline-none transition-all"
              placeholder="Ex: 1000"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Percent className="w-3 h-3" /> Risco por Operação (%)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['0.5', '1', '2', '3'].map((r) => (
                <button 
                  key={r}
                  onClick={() => setRisco(r)}
                  className={`py-2 rounded-lg border text-sm font-bold transition-all ${risco === r ? 'bg-brand-500 border-brand-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                >
                  {r}%
                </button>
              ))}
            </div>
            <input 
              type="number" 
              value={risco}
              onChange={(e) => setRisco(e.target.value)}
              className="mt-2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono focus:border-brand-500 outline-none transition-all"
            />
          </div>

          <button 
            onClick={handleSave}
            className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-500 text-white hover:bg-brand-400 shadow-saas-glow'}`}
          >
            {saved ? 'Configurações Salvas!' : <><Save className="w-4 h-4" /> Salvar Configurações</>}
          </button>
        </div>
      </div>

      <div className="saas-card p-6 bg-blue-500/5 border-blue-500/20">
        <h3 className="text-sm font-bold text-blue-400 mb-2 flex items-center gap-2">
           💡 Dica do Especialista SMC
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Para iniciantes, o risco recomendado é de **1%**. Isso permite que você sobreviva a sequências de perda e continue operando enquanto o algoritmo busca as grandes capturas de liquidez. O robô usará esses valores para sugerir o tamanho da sua entrada em cada sinal.
        </p>
      </div>

    </div>
  );
}
