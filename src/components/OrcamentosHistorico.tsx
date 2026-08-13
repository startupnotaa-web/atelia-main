'use client';

import { useState, useEffect } from 'react';
import { FileText, Loader2, ArrowRightCircle, CheckCircle2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import toast from 'react-hot-toast';
import { fetchOrcamentos, atualizarStatusOrcamento, converterOrcamentoEmPedido } from '@/app/actions/quotes';
import type { Orcamento, OrcamentoStatus } from '@/lib/erpTypes';

const STATUS_LABEL: Record<OrcamentoStatus, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  convertido: 'Convertido em Pedido',
};

const STATUS_STYLE: Record<OrcamentoStatus, string> = {
  rascunho: 'bg-slate-100 text-slate-600 border-slate-200',
  enviado: 'bg-blue-50 text-blue-700 border-blue-200',
  aprovado: 'bg-green-50 text-success border-green-200',
  recusado: 'bg-red-50 text-red-600 border-red-200',
  convertido: 'bg-primary/10 text-slate-900 border-primary/30',
};

// Status que a artesã pode escolher manualmente — 'convertido' só é gravado
// por converterOrcamentoEmPedido, junto com a criação do pedido.
const STATUS_EDITAVEIS: Exclude<OrcamentoStatus, 'convertido'>[] = ['rascunho', 'enviado', 'aprovado', 'recusado'];

export default function OrcamentosHistorico() {
  const [userId, setUserId] = useState<string | null>(null);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const carregar = async (uid: string) => {
    setIsLoading(true);
    const dados = await fetchOrcamentos(uid);
    setOrcamentos(dados);
    setIsLoading(false);
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
        carregar(user.uid);
      } else {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (val: unknown) => {
    const date = new Date(String(val || ''));
    return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
  };

  const handleChangeStatus = async (orcamento: Orcamento, novoStatus: Exclude<OrcamentoStatus, 'convertido'>) => {
    if (!userId || orcamento.status === novoStatus) return;
    setUpdatingId(orcamento.id);
    const resultado = await atualizarStatusOrcamento(orcamento.id, novoStatus);
    if (resultado.success) {
      setOrcamentos(prev => prev.map(o => o.id === orcamento.id ? { ...o, status: novoStatus } : o));
    } else {
      toast.error(resultado.error || 'Erro ao atualizar status.');
    }
    setUpdatingId(null);
  };

  const handleConverter = async (orcamento: Orcamento) => {
    setUpdatingId(orcamento.id);
    const resultado = await converterOrcamentoEmPedido(orcamento.id);
    if (resultado.success) {
      setOrcamentos(prev => prev.map(o => o.id === orcamento.id ? { ...o, status: 'convertido', pedidoId: resultado.pedidoId } : o));
      toast.success('Orçamento convertido em pedido! Já aparece na fila de produção em /pedidos.');
    } else {
      toast.error(resultado.error || 'Erro ao converter orçamento em pedido.');
    }
    setUpdatingId(null);
  };

  if (isLoading) {
    return (
      <div className="w-full flex justify-center py-20">
        <Loader2 className="animate-spin text-secondary" size={40} />
      </div>
    );
  }

  if (orcamentos.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto text-center py-20 border-2 border-dashed border-border rounded-[2rem] bg-background">
        <FileText size={56} className="mx-auto text-slate-300 mb-4" />
        <h3 className="text-2xl font-black text-slate-500 mb-2">Nenhum orçamento salvo ainda</h3>
        <p className="text-slate-500 font-medium max-w-sm mx-auto">
          Gere um orçamento na aba &quot;Novo Orçamento&quot; — ele aparece aqui automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {orcamentos.map(orcamento => (
        <div key={orcamento.id} className="bg-surface border-2 border-border rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-xl font-black text-slate-800">{orcamento.clienteNome}</h3>
              <p className="text-sm font-medium text-slate-500 mt-0.5">
                {orcamento.itens.length} {orcamento.itens.length === 1 ? 'item' : 'itens'} · {formatDate(orcamento.createdAt)}
              </p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
              <span className={`text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-full border-2 ${STATUS_STYLE[orcamento.status]}`}>
                {STATUS_LABEL[orcamento.status]}
              </span>
              <span className="text-2xl font-black text-foreground">{formatCurrency(orcamento.valorFinal)}</span>
            </div>
          </div>

          {orcamento.status === 'convertido' ? (
            <div className="flex items-center gap-2 text-success font-bold text-sm bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle2 size={18} /> Convertido em pedido — acompanhe a produção em /pedidos.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border">
              <div className="flex flex-wrap gap-2">
                {STATUS_EDITAVEIS.map(status => (
                  <button
                    key={status}
                    onClick={() => handleChangeStatus(orcamento, status)}
                    disabled={updatingId === orcamento.id || orcamento.status === status}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border-2 transition-colors disabled:cursor-default ${
                      orcamento.status === status
                        ? `${STATUS_STYLE[status]} cursor-default`
                        : 'bg-background border-border text-slate-500 hover:border-slate-400'
                    }`}
                  >
                    {STATUS_LABEL[status]}
                  </button>
                ))}
              </div>

              {orcamento.status === 'aprovado' && (
                <button
                  onClick={() => handleConverter(orcamento)}
                  disabled={updatingId === orcamento.id}
                  className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-slate-900 font-black px-5 py-3 rounded-xl transition-colors disabled:opacity-50 shrink-0"
                >
                  {updatingId === orcamento.id ? <Loader2 className="animate-spin" size={18} /> : <ArrowRightCircle size={18} />}
                  Converter em Pedido
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
