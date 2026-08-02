'use client';

import { useTenant } from '@/lib/TenantProvider';
import Paywall from '@/components/Paywall';
import { ChatbotWidget } from '@/components/ChatbotWidget';

export default function IAPage() {
  const { isPro } = useTenant();

  if (!isPro) {
    return (
      <div className="p-8 max-w-4xl mx-auto mt-10">
        <Paywall 
          title="Inteligência Artificial Exclusiva Pro" 
          description="Receba análises automáticas do seu negócio, precificação sugerida e converse com a sua própria assistente financeira de IA."
        />
      </div>
    );
  }

  // Se for Pro
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-black text-foreground mb-2">Assistente IA</h1>
      <p className="text-slate-500 font-medium mb-8">
        Converse com a sua assistente financeira e receba conselhos estratégicos para o seu ateliê.
      </p>
      
      {/* Versão de página inteira do Chatbot */}
      <div className="h-[600px] w-full bg-surface rounded-3xl shadow-sm border border-border">
        <ChatbotWidget fullScreenMode={true} /> 
      </div>
    </div>
  );
}
