'use client';

import { X, Crown, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface LimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
}

export default function LimitModal({ isOpen, onClose, itemName }: LimitModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Banner do topo */}
        <div className="bg-secondary p-6 relative text-center">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
          
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Crown size={32} className="text-primary" />
          </div>
          <h2 className="text-2xl font-black text-white">Limite Atingido!</h2>
        </div>

        {/* Corpo do modal */}
        <div className="p-8 text-center space-y-6">
          <p className="text-slate-600 text-lg font-medium leading-relaxed">
            Você atingiu o limite do plano Gratuito para <strong className="text-slate-900">{itemName}</strong>. 
            Assine o plano Pro para ter cadastros ilimitados e escalar seu ateliê!
          </p>

          <Link 
            href="/perfil" // Rota correta de conta/upgrade
            className="w-full bg-secondary hover:bg-[#132A4A] text-white font-black text-lg py-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            Assinar Plano Pro
            <ArrowRight size={20} />
          </Link>
          
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors"
          >
            Talvez mais tarde
          </button>
        </div>

      </div>
    </div>
  );
}
