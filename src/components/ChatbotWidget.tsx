'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, MinusCircle } from 'lucide-react';
// Removed chatWithAssistant import
import { auth } from '@/lib/firebase';
export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export function ChatbotWidget({ fullScreenMode = false }: { fullScreenMode?: boolean }) {
  const [isOpen, setIsOpen] = useState(fullScreenMode ? true : false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: 'Olá! Sou o seu Assistente Empreendedor. Como posso te ajudar hoje com precificação, redução de custos ou dúvidas sobre as finanças do seu ateliê?'
      }]);
    }
  }, [isOpen, messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'assistente', message: userMessage, history: messages, userId: auth.currentUser?.uid })
      });
      const data = await response.json();
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.result || 'Assistente indisponível no momento.',
      };
      setMessages([...newMessages, assistantMessage]);
    } catch (error) {
      setMessages([...newMessages, { role: 'assistant', content: 'Desculpe, tive um problema de conexão. Poderia repetir?' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {!isOpen && !fullScreenMode && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-secondary text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-secondary-hover hover:scale-105 transition-all z-50 animate-in fade-in slide-in-from-bottom-4 duration-500 border border-white/10"
        >
          <MessageSquare size={24} />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-primary border-2 border-secondary"></span>
          </span>
        </button>
      )}

      {isOpen && (
        <div className={
          fullScreenMode 
            ? "w-full h-full bg-surface rounded-3xl shadow-lg flex flex-col overflow-hidden border border-border"
            : "fixed bottom-6 right-6 w-[350px] sm:w-[400px] h-[500px] max-h-[80vh] bg-surface rounded-3xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-8 duration-300 border border-border"
        }>
          <div className="bg-secondary text-white p-4 flex items-center justify-between shadow-md z-10 relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface/10 flex items-center justify-center">
                <MessageSquare size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-black text-sm">Assistente Empreendedor</h3>
                <p className="text-[10px] text-blue-200 font-bold uppercase tracking-wider">Online e pronto para ajudar</p>
              </div>
            </div>
            {!fullScreenMode && (
              <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white transition-colors">
                <MinusCircle size={20} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-background space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[14px] ${
                  msg.role === 'user' 
                    ? 'bg-secondary text-white rounded-br-sm' 
                    : 'bg-surface border border-border text-slate-800 rounded-bl-sm shadow-sm prose prose-sm prose-p:my-1 prose-strong:text-foreground'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-surface border border-border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="p-3 bg-surface border-t border-border flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Digite sua dúvida..."
              className="flex-1 bg-background border-2 border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors font-medium text-slate-700"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="w-12 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-md shadow-[#FFAA00]/20"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
