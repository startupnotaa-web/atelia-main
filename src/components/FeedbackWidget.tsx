'use client';

import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { submitFeedback } from '@/app/actions/feedback';
import { toast } from 'react-hot-toast';

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState('Dúvida');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Por favor, digite sua mensagem.');
      return;
    }

    setLoading(true);
    try {
      const result = await submitFeedback(type, message);
      if (result.success) {
        toast.success('Mensagem enviada com sucesso! Obrigado pelo feedback.');
        setIsOpen(false);
        setMessage('');
        setType('Dúvida');
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar mensagem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 hover:scale-105 transition-all flex items-center justify-center z-40 focus:outline-none focus:ring-4 focus:ring-primary/30"
        title="Ajuda e Feedback"
      >
        <HelpCircle size={28} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <X size={24} />
            </button>
            
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Ajuda e Feedback</h2>
              <p className="text-gray-600 mb-6 text-sm">
                Encontrou um erro ou tem uma sugestão legal? Deixe sua mensagem abaixo!
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Mensagem</label>
                  <select
                    id="type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full border-gray-300 rounded-xl shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2 px-3 border"
                  >
                    <option value="Dúvida">Dúvida</option>
                    <option value="Sugestão">Sugestão de Melhoria</option>
                    <option value="Bug">Reportar um Erro (Bug)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Sua Mensagem</label>
                  <textarea
                    id="message"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escreva aqui..."
                    className="w-full border-gray-300 rounded-xl shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2 px-3 border resize-none"
                    maxLength={2000}
                  ></textarea>
                  <div className="text-right text-xs text-gray-500 mt-1">
                    {message.length}/2000
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Enviar Mensagem'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
