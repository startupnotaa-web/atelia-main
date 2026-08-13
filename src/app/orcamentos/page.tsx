'use client';

import { useState } from 'react';
import GerarOrcamento from "@/components/GerarOrcamento";
import OrcamentosHistorico from "@/components/OrcamentosHistorico";

export default function GerarOrcamentoPage() {
  const [activeTab, setActiveTab] = useState<'novo' | 'historico'>('novo');

  return (
    <div className="w-full h-full flex flex-col items-center py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Tabs */}
      <div className="flex bg-slate-200/50 p-2 rounded-2xl mb-8 w-full max-w-md">
        <button
          onClick={() => setActiveTab('novo')}
          className={`flex-1 py-4 text-xl font-bold rounded-xl transition-all ${
            activeTab === 'novo'
              ? 'bg-surface text-secondary shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Novo Orçamento
        </button>
        <button
          onClick={() => setActiveTab('historico')}
          className={`flex-1 py-4 text-xl font-bold rounded-xl transition-all ${
            activeTab === 'historico'
              ? 'bg-surface text-secondary shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Histórico
        </button>
      </div>

      {activeTab === 'novo' ? <GerarOrcamento /> : <OrcamentosHistorico />}
    </div>
  );
}
