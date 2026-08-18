'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/verifyAuth';

export type ReportType = 'vendas' | 'pedidos' | 'catalogo';

export interface ReportFilters {
  type: ReportType;
  startDate: string;
  endDate: string;
}

export interface SalesReportRow {
  id: string;
  data: string;
  descricao: string;
  tipo: 'entrada' | 'saida';
  categoria: string;
  valor: number;
}

export interface OrderReportRow {
  id: string;
  data: string;
  cliente: string;
  produto: string;
  valorFinal: number;
  custo: number;
  lucro: number;
  statusPagamento: string;
  statusProducao: string;
}

export interface CatalogoReportRow {
  id: string;
  nome: string;
  precoFinal: number;
  custoBase: number;
  margemLucro: number;
  criadoEm: string;
}

export interface ReportData {
  type: ReportType;
  period: { start: string; end: string };
  vendas?: SalesReportRow[];
  pedidos?: OrderReportRow[];
  catalogo?: CatalogoReportRow[];
  totals: {
    totalReceitas: number;
    totalDespesas: number;
    totalLucro: number;
    count: number;
  };
}

export async function fetchReportData(
  userId: string,
  filters: ReportFilters
): Promise<ReportData> {
  const authUserId = await verifyAuth();
  if (authUserId !== userId) throw new Error('Não autorizado');

  const db = getAdminDb();
  const { type, startDate, endDate } = filters;

  const isWithinPeriod = (dateString: string | undefined) => {
    if (!dateString || !startDate || !endDate) return true;
    const isoDate = dateString.substring(0, 10);
    return isoDate >= startDate && isoDate <= endDate;
  };

  const result: ReportData = {
    type,
    period: { start: startDate, end: endDate },
    totals: { totalReceitas: 0, totalDespesas: 0, totalLucro: 0, count: 0 },
  };

  if (type === 'vendas') {
    const snap = await db.collection('finance_entries').where('userId', '==', userId).get();
    const rows: SalesReportRow[] = [];
    let totalReceitas = 0;
    let totalDespesas = 0;

    snap.forEach(doc => {
      const d = doc.data();
      const entryDate = d.date || (d.createdAt && typeof d.createdAt === 'string' ? d.createdAt : d.createdAt?.toDate?.()?.toISOString?.() || '');
      if (!isWithinPeriod(entryDate)) return;

      rows.push({
        id: doc.id,
        data: entryDate?.substring(0, 10) || '',
        descricao: d.description || d.descricao || '-',
        tipo: d.type || 'saida',
        categoria: d.category || '-',
        valor: d.value || 0,
      });

      if (d.type === 'entrada') totalReceitas += d.value || 0;
      else totalDespesas += d.value || 0;
    });

    rows.sort((a, b) => a.data.localeCompare(b.data));
    result.vendas = rows;
    result.totals = {
      totalReceitas,
      totalDespesas,
      totalLucro: totalReceitas - totalDespesas,
      count: rows.length,
    };
  }

  if (type === 'pedidos') {
    const snap = await db.collection('pedidos').where('userId', '==', userId).get();
    const rows: OrderReportRow[] = [];
    let totalReceitas = 0;
    let totalCustos = 0;

    snap.forEach(doc => {
      const d = doc.data();
      const orderDate = d.data || d.orderDate || (d.createdAt && typeof d.createdAt === 'string' ? d.createdAt : d.createdAt?.toDate?.()?.toISOString?.() || '');
      if (!isWithinPeriod(orderDate)) return;

      const valorFinal = d.valorFinal || d.valor || d.totalValue || 0;
      const custo = d.custo || 0;
      const lucro = d.lucro || (valorFinal - custo);

      rows.push({
        id: doc.id,
        data: orderDate?.substring(0, 10) || '',
        cliente: d.cliente || d.clientName || d.clienteNome || '-',
        produto: d.produtoNome || d.produto || d.items?.[0]?.name || '-',
        valorFinal,
        custo,
        lucro,
        statusPagamento: d.statusPagamento || d.paymentStatus || '-',
        statusProducao: d.statusProducao || d.productionStatus || '-',
      });

      totalReceitas += valorFinal;
      totalCustos += custo;
    });

    rows.sort((a, b) => a.data.localeCompare(b.data));
    result.pedidos = rows;
    result.totals = {
      totalReceitas,
      totalDespesas: totalCustos,
      totalLucro: totalReceitas - totalCustos,
      count: rows.length,
    };
  }

  if (type === 'catalogo') {
    const snap = await db.collection('catalogo').where('userId', '==', userId).get();
    const rows: CatalogoReportRow[] = [];
    let totalPrecos = 0;
    let totalCustos = 0;

    snap.forEach(doc => {
      const d = doc.data();
      const precoFinal = d.precoFinal || 0;
      const custoBase = d.custoBase || 0;
      const margem = d.detalhesCalculo?.taxas?.margem || d.margemLucro || 0;

      rows.push({
        id: doc.id,
        nome: d.nome || '-',
        precoFinal,
        custoBase,
        margemLucro: margem,
        criadoEm: (d.createdAt || '').substring(0, 10),
      });

      totalPrecos += precoFinal;
      totalCustos += custoBase;
    });

    rows.sort((a, b) => a.nome.localeCompare(b.nome));
    result.catalogo = rows;
    result.totals = {
      totalReceitas: totalPrecos,
      totalDespesas: totalCustos,
      totalLucro: totalPrecos - totalCustos,
      count: rows.length,
    };
  }

  return result;
}
