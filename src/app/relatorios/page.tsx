'use client';

import { useState } from 'react';
import { useTenant } from '@/lib/TenantProvider';
import { fetchReportData, type ReportData, type ReportType } from '@/app/actions/reports';
import { FileText, Download, Calendar, Filter, Loader2, TrendingUp, TrendingDown, DollarSign, Hash } from 'lucide-react';

export default function RelatoriosPage() {
  const { userId } = useTenant();

  const [reportType, setReportType] = useState<ReportType>('vendas');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const handleGenerate = async () => {
    if (!userId || !startDate || !endDate) return;
    setLoading(true);
    try {
      const result = await fetchReportData(userId, { type: reportType, startDate, endDate });
      setData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const reportTypeLabels: Record<ReportType, string> = {
    vendas: 'Histórico de Vendas',
    pedidos: 'Histórico de Pedidos',
    catalogo: 'Catálogo e Precificações',
  };

  const statusLabels: Record<string, string> = {
    pago: 'Pago',
    pendente: 'Pendente',
    sinal: 'Sinal',
    fila: 'Na Fila',
    producao: 'Em Produção',
    finalizado: 'Finalizado',
    entregue: 'Entregue',
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 font-sans animate-in fade-in duration-500 pb-20">
      {/* HEADER — oculto na impressão */}
      <header className="mb-8 print:hidden">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center">
            <FileText size={28} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-foreground">Central de Relatórios</h1>
            <p className="text-slate-500 font-medium">Exporte e analise os dados do seu ateliê.</p>
          </div>
        </div>
      </header>

      {/* FILTROS — oculto na impressão */}
      <div className="bg-surface rounded-3xl border-2 border-border shadow-sm p-6 md:p-8 mb-8 print:hidden">
        <h2 className="text-lg font-black text-foreground mb-6 flex items-center gap-2">
          <Filter size={20} className="text-slate-400" />
          Filtros do Relatório
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Tipo de Relatório</label>
            <select
              value={reportType}
              onChange={(e) => { setReportType(e.target.value as ReportType); setData(null); }}
              className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl font-bold text-slate-700 outline-none focus:border-secondary"
            >
              <option value="vendas">Histórico de Vendas</option>
              <option value="pedidos">Histórico de Pedidos</option>
              <option value="catalogo">Catálogo e Precificações</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1">
              <Calendar size={14} /> Data Inicial
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl font-bold text-slate-700 outline-none focus:border-secondary"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1">
              <Calendar size={14} /> Data Final
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl font-bold text-slate-700 outline-none focus:border-secondary"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading || !startDate || !endDate}
            className="bg-secondary hover:bg-secondary-hover text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <FileText size={20} />}
            Gerar Relatório
          </button>
        </div>
      </div>

      {/* RESULTADOS */}
      {data && (
        <div id="report-content">
          {/* Cabeçalho do relatório (visível na impressão) */}
          <div className="hidden print:block mb-8 text-center border-b-2 border-slate-200 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <img src="/icon.png" alt="AtelIA" className="w-8 h-8" />
              <h1 className="text-2xl font-black text-slate-900">AtelIA — {reportTypeLabels[data.type]}</h1>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              Período: {formatDate(data.period.start)} até {formatDate(data.period.end)}
            </p>
          </div>

          {/* Totalizadores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-surface rounded-2xl p-5 border-2 border-border shadow-sm print:border print:shadow-none">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                <Hash size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">Registros</span>
              </div>
              <p className="text-2xl font-black text-slate-800">{data.totals.count}</p>
            </div>
            <div className="bg-surface rounded-2xl p-5 border-2 border-emerald-100 shadow-sm print:border print:shadow-none">
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <TrendingUp size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">
                  {data.type === 'catalogo' ? 'Total Preços' : 'Total Receitas'}
                </span>
              </div>
              <p className="text-2xl font-black text-emerald-700">{formatCurrency(data.totals.totalReceitas)}</p>
            </div>
            <div className="bg-surface rounded-2xl p-5 border-2 border-amber-100 shadow-sm print:border print:shadow-none">
              <div className="flex items-center gap-2 text-amber-600 mb-2">
                <TrendingDown size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">
                  {data.type === 'catalogo' ? 'Total Custos' : 'Total Despesas'}
                </span>
              </div>
              <p className="text-2xl font-black text-amber-700">{formatCurrency(data.totals.totalDespesas)}</p>
            </div>
            <div className="bg-secondary rounded-2xl p-5 shadow-lg print:bg-white print:border print:shadow-none">
              <div className="flex items-center gap-2 text-blue-200 print:text-slate-500 mb-2">
                <DollarSign size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">Lucro / Margem</span>
              </div>
              <p className="text-2xl font-black text-white print:text-slate-800">{formatCurrency(data.totals.totalLucro)}</p>
            </div>
          </div>

          {/* Botão Exportar PDF (impressão) */}
          <div className="flex justify-end mb-4 print:hidden">
            <button
              onClick={handlePrint}
              className="bg-primary hover:bg-primary-hover text-slate-900 font-bold py-3 px-6 rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              <Download size={18} />
              Exportar PDF / Imprimir
            </button>
          </div>

          {/* TABELA VENDAS */}
          {data.type === 'vendas' && data.vendas && (
            <div className="bg-surface rounded-3xl border-2 border-border shadow-sm overflow-hidden print:rounded-none print:border print:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-background border-b-2 border-border">
                      <th className="text-left px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Data</th>
                      <th className="text-left px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Descrição</th>
                      <th className="text-left px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Tipo</th>
                      <th className="text-left px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Categoria</th>
                      <th className="text-right px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.vendas.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-slate-400 font-bold">
                          Nenhuma transação encontrada neste período.
                        </td>
                      </tr>
                    ) : (
                      data.vendas.map((row) => (
                        <tr key={row.id} className="border-b border-border/50 hover:bg-background/50 transition-colors print:hover:bg-transparent">
                          <td className="px-6 py-3.5 font-medium text-slate-700">{formatDate(row.data)}</td>
                          <td className="px-6 py-3.5 font-medium text-slate-800 max-w-[200px] truncate">{row.descricao}</td>
                          <td className="px-6 py-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${row.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {row.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 font-medium text-slate-600">{row.categoria}</td>
                          <td className={`px-6 py-3.5 text-right font-bold tabular-nums ${row.tipo === 'entrada' ? 'text-emerald-700' : 'text-red-600'}`}>
                            {row.tipo === 'entrada' ? '+' : '-'}{formatCurrency(row.valor)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {data.vendas.length > 0 && (
                    <tfoot>
                      <tr className="bg-background border-t-2 border-border">
                        <td colSpan={4} className="px-6 py-4 font-black text-slate-700 text-right">Totais:</td>
                        <td className="px-6 py-4 text-right font-black text-slate-800 tabular-nums">
                          {formatCurrency(data.totals.totalReceitas - data.totals.totalDespesas)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* TABELA PEDIDOS */}
          {data.type === 'pedidos' && data.pedidos && (
            <div className="bg-surface rounded-3xl border-2 border-border shadow-sm overflow-hidden print:rounded-none print:border print:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-background border-b-2 border-border">
                      <th className="text-left px-5 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Data</th>
                      <th className="text-left px-5 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Cliente</th>
                      <th className="text-left px-5 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Produto</th>
                      <th className="text-left px-5 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Pagamento</th>
                      <th className="text-left px-5 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Produção</th>
                      <th className="text-right px-5 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Valor</th>
                      <th className="text-right px-5 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Custo</th>
                      <th className="text-right px-5 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Lucro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pedidos.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-slate-400 font-bold">
                          Nenhum pedido encontrado neste período.
                        </td>
                      </tr>
                    ) : (
                      data.pedidos.map((row) => (
                        <tr key={row.id} className="border-b border-border/50 hover:bg-background/50 transition-colors print:hover:bg-transparent">
                          <td className="px-5 py-3.5 font-medium text-slate-700">{formatDate(row.data)}</td>
                          <td className="px-5 py-3.5 font-medium text-slate-800 max-w-[120px] truncate">{row.cliente}</td>
                          <td className="px-5 py-3.5 font-medium text-slate-700 max-w-[120px] truncate">{row.produto}</td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              row.statusPagamento === 'pago' ? 'bg-emerald-100 text-emerald-700' :
                              row.statusPagamento === 'sinal' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {statusLabels[row.statusPagamento] || row.statusPagamento}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                              {statusLabels[row.statusProducao] || row.statusProducao}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-slate-800 tabular-nums">{formatCurrency(row.valorFinal)}</td>
                          <td className="px-5 py-3.5 text-right font-medium text-slate-500 tabular-nums">{formatCurrency(row.custo)}</td>
                          <td className={`px-5 py-3.5 text-right font-bold tabular-nums ${row.lucro >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {formatCurrency(row.lucro)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {data.pedidos.length > 0 && (
                    <tfoot>
                      <tr className="bg-background border-t-2 border-border">
                        <td colSpan={5} className="px-5 py-4 font-black text-slate-700 text-right">Totais:</td>
                        <td className="px-5 py-4 text-right font-black text-slate-800 tabular-nums">{formatCurrency(data.totals.totalReceitas)}</td>
                        <td className="px-5 py-4 text-right font-bold text-slate-500 tabular-nums">{formatCurrency(data.totals.totalDespesas)}</td>
                        <td className={`px-5 py-4 text-right font-black tabular-nums ${data.totals.totalLucro >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {formatCurrency(data.totals.totalLucro)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* TABELA CATÁLOGO */}
          {data.type === 'catalogo' && data.catalogo && (
            <div className="bg-surface rounded-3xl border-2 border-border shadow-sm overflow-hidden print:rounded-none print:border print:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-background border-b-2 border-border">
                      <th className="text-left px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Produto</th>
                      <th className="text-right px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Preço Venda</th>
                      <th className="text-right px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Custo Base</th>
                      <th className="text-right px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Margem</th>
                      <th className="text-left px-6 py-4 font-bold text-slate-600 uppercase tracking-wider text-xs">Criado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.catalogo.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-slate-400 font-bold">
                          Nenhum produto no catálogo.
                        </td>
                      </tr>
                    ) : (
                      data.catalogo.map((row) => (
                        <tr key={row.id} className="border-b border-border/50 hover:bg-background/50 transition-colors print:hover:bg-transparent">
                          <td className="px-6 py-3.5 font-bold text-slate-800">{row.nome}</td>
                          <td className="px-6 py-3.5 text-right font-bold text-emerald-700 tabular-nums">{formatCurrency(row.precoFinal)}</td>
                          <td className="px-6 py-3.5 text-right font-medium text-slate-500 tabular-nums">{formatCurrency(row.custoBase)}</td>
                          <td className="px-6 py-3.5 text-right font-bold text-blue-600 tabular-nums">{row.margemLucro.toFixed(1)}%</td>
                          <td className="px-6 py-3.5 font-medium text-slate-600">{formatDate(row.criadoEm)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {data.catalogo.length > 0 && (
                    <tfoot>
                      <tr className="bg-background border-t-2 border-border">
                        <td className="px-6 py-4 font-black text-slate-700">Totais ({data.totals.count} produtos)</td>
                        <td className="px-6 py-4 text-right font-black text-emerald-700 tabular-nums">{formatCurrency(data.totals.totalReceitas)}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-500 tabular-nums">{formatCurrency(data.totals.totalDespesas)}</td>
                        <td className="px-6 py-4 text-right font-black text-blue-600 tabular-nums">
                          {data.totals.totalDespesas > 0 ? (((data.totals.totalReceitas - data.totals.totalDespesas) / data.totals.totalDespesas) * 100).toFixed(1) : '0.0'}%
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Rodapé do relatório (visível na impressão) */}
          <div className="hidden print:block mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-400">
            Relatório gerado por AtelIA — {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}

      {/* Estado vazio quando nenhum relatório foi gerado */}
      {!data && !loading && (
        <div className="bg-surface rounded-3xl border-4 border-dashed border-border p-12 text-center flex flex-col items-center justify-center min-h-[300px] print:hidden">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-400 rounded-full flex items-center justify-center mb-6">
            <FileText size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Selecione os filtros acima</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            Escolha o tipo de relatório, defina o período e clique em &quot;Gerar Relatório&quot; para visualizar seus dados.
          </p>
        </div>
      )}

      {/* CSS para impressão — esconde a navegação lateral e cabeçalho mobile */}
      <style jsx global>{`
        @media print {
          aside, header.print\\:hidden, .print\\:hidden, nav {
            display: none !important;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .min-h-screen {
            min-height: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
