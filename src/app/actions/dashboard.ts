'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import { DashboardData } from '@/lib/dashboard';
import { verifyAuth } from '@/lib/verifyAuth';
import { Order } from './erp';
import { FinanceEntry } from './finance';

export async function fetchDashboardData(userId: string, periodFilter?: { start: string, end: string }): Promise<DashboardData> {
  const isWithinPeriod = (dateString: string | undefined, filter: {start: string, end: string} | undefined) => {
    if (!filter || !filter.start || !filter.end || !dateString) return true;
    const isoDate = dateString.substring(0, 10);
    return isoDate >= filter.start && isoDate <= filter.end;
  };

  const parseNumber = (val: any) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      let str = val;
      if (str.includes(',')) {
        str = str.replace(/\./g, '').replace(',', '.');
      }
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  try {
    const authUserId = await verifyAuth();
    if (authUserId !== userId) throw new Error('Não autorizado');

    const db = getAdminDb();

    // Fetch collections
    const [pedidosSnap, transactionsSnap, financeSnap, settingsDoc, estoqueSnap, prontaEntregaSnap, userDoc, catalogoSnap] = await Promise.all([
      db.collection('pedidos').where('userId', '==', userId).get(),
      db.collection('transactions').where('userId', '==', userId).get(),
      db.collection('finance_entries').where('userId', '==', userId).get(),
      db.collection('settings').doc(userId).get(),
      db.collection('estoque').where('userId', '==', userId).get(),
      db.collection('estoque_pronto').where('userId', '==', userId).get(),
      db.collection('users').doc(userId).get(),
      db.collection('catalogo').where('userId', '==', userId).limit(1).get()
    ]);

    const plan = userDoc.exists ? (userDoc.data()?.plan || 'free') : 'free';
    const monthlyGoal = userDoc.exists ? (userDoc.data()?.monthlyGoal || 0) : 0;

    // 1. Initial Balance
    const initialBalance = settingsDoc.exists ? (settingsDoc.data()?.initialBalance || 0) : 0;

    // 2. Process Finance Entries
    let totalManualIncome = 0;
    let totalManualExpense = 0;
    const allFinanceEntries: FinanceEntry[] = [];
    let currentMonthRevenue = 0;
    const currentMonthStr = new Date().toISOString().substring(0, 7);

    financeSnap.forEach(doc => {
      const data = doc.data() as FinanceEntry;
      data.id = doc.id;
      if (data.createdAt && typeof (data.createdAt as any).toDate === 'function') {
        data.createdAt = (data.createdAt as any).toDate().toISOString();
      }
      allFinanceEntries.push(data);
      const entryDate = data.date || data.createdAt || '';
      
      if (data.type === 'entrada') {
        if (isWithinPeriod(entryDate, periodFilter)) {
          totalManualIncome += data.value;
        }
        const entryMonth = typeof entryDate === 'string' ? entryDate.substring(0, 7) : '';
        if (entryMonth === currentMonthStr) {
          currentMonthRevenue += data.value;
        }
      }
      if (data.type === 'saida') {
        if (isWithinPeriod(entryDate, periodFilter)) {
          totalManualExpense += data.value;
        }
      }
    });

    allFinanceEntries.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const recentExpenses = allFinanceEntries.slice(0, 5); // top 5 recent

    // 3. Initialize Evolution Chart
    let totalReceivedFromOrders = 0;
    const monthlyProfit: Record<string, number> = {};
    const currentYear = new Date().getFullYear();
    for (let i = 1; i <= 12; i++) {
      const monthStr = `${currentYear}-${i.toString().padStart(2, '0')}`;
      monthlyProfit[monthStr] = 0;
    }

    // 4. Process Orders
    let faturamentoBruto = 0;
    let custoProducaoTotal = 0;
    let aReceber = 0;
    let pedidosPendentes = 0;
    let pedidosFila = 0;
    let pedidosProducao = 0;
    const pendingOrders: Order[] = [];
    const produtoMap: Record<string, { quantidadeVendida: number; receitaGerada: number }> = {};

    pedidosSnap.forEach(doc => {
      const data = doc.data() as any;
      data.id = doc.id;
      if (data.createdAt && typeof (data.createdAt as any).toDate === 'function') {
        data.createdAt = (data.createdAt as any).toDate().toISOString();
      }
      
      const v = parseNumber(data.valorFinal) || parseNumber(data.valor) || parseNumber(data.totalValue) || 0;
      const custo = parseNumber(data.custo) || 0;
      
      const orderDate = data.data || data.orderDate || data.createdAt || '';
      const orderDeadline = data.dataEntrega || data.deadline || data.data || data.orderDate || '';
      const orderMonthStr = typeof orderDate === 'string' ? orderDate.substring(0, 7) : '';

      const isFaturamentoInRange = isWithinPeriod(orderDate, periodFilter);
      const isReceberInRange = isWithinPeriod(orderDeadline, periodFilter);

      if (isFaturamentoInRange) {
        faturamentoBruto += v;
        custoProducaoTotal += custo;
      }
      
      if (data.status || data.statusProducao || data.statusPagamento) {
        // Novo Schema
        let pago = 0;
        if (data.statusPagamento === 'pago') pago = v;
        else if (data.statusPagamento === 'sinal') pago = v / 2;
        
        if (isFaturamentoInRange) {
          totalReceivedFromOrders += pago;
        }

        if (orderMonthStr) {
          if (monthlyProfit[orderMonthStr] === undefined) {
            monthlyProfit[orderMonthStr] = 0;
          }
          monthlyProfit[orderMonthStr] += pago;
          
          if (orderMonthStr === currentMonthStr) {
            currentMonthRevenue += pago;
          }
        }

        if (data.statusPagamento !== 'pago') {
          if (isReceberInRange) {
            aReceber += (v - pago);
          }
          pedidosPendentes++;
          pendingOrders.push(data);
        }
        if (data.statusProducao === 'fila') pedidosFila++;
        if (data.statusProducao === 'producao') pedidosProducao++;
      } else {
        // Legacy Schema
        const remaining = data.remainingValue || 0;
        if (isReceberInRange) {
          aReceber += remaining;
        }
        if (remaining > 0) {
          pendingOrders.push(data);
        }
        if (data.productionStatus && data.productionStatus !== 'finished' && data.productionStatus !== 'shipped') {
          pedidosPendentes++;
          if (data.productionStatus === 'queue') pedidosFila++;
          if (data.productionStatus === 'production') pedidosProducao++;
        }
      }
      
      // Top Products Logic
      if (data.produto) {
        if (!produtoMap[data.produto]) produtoMap[data.produto] = { quantidadeVendida: 0, receitaGerada: 0 };
        produtoMap[data.produto].quantidadeVendida += 1;
        produtoMap[data.produto].receitaGerada += v;
      } else if (data.items && Array.isArray(data.items)) {
        data.items.forEach((item: any) => {
          if (!produtoMap[item.name]) {
            produtoMap[item.name] = { quantidadeVendida: 0, receitaGerada: 0 };
          }
          produtoMap[item.name].quantidadeVendida += item.quantity;
          produtoMap[item.name].receitaGerada += (item.price * item.quantity);
        });
      }
    });

    let topProduct = null;
    const sortedProducts = Object.entries(produtoMap).sort((a, b) => b[1].receitaGerada - a[1].receitaGerada);
    if (sortedProducts.length > 0) {
      topProduct = {
        nome: sortedProducts[0][0],
        quantidadeVendida: sortedProducts[0][1].quantidadeVendida,
        receitaGerada: sortedProducts[0][1].receitaGerada
      };
    }

    // 5. Process Transactions (Legacy)
    transactionsSnap.forEach(doc => {
      const data = doc.data();
      const amount = data.amount || 0;
      
      const txDate = data.createdAt ? (typeof data.createdAt === 'string' ? data.createdAt : data.createdAt.toDate?.().toISOString() || '') : '';
      if (isWithinPeriod(txDate, periodFilter)) {
        totalReceivedFromOrders += amount;
      }
      
      if (txDate) {
        const monthStr = txDate.substring(0, 7);
        if (monthStr) {
          if (monthlyProfit[monthStr] !== undefined) {
            monthlyProfit[monthStr] += amount;
          } else {
            monthlyProfit[monthStr] = amount;
          }
          if (monthStr === currentMonthStr) {
            currentMonthRevenue += amount;
          }
        }
      }
    });

    allFinanceEntries.forEach(data => {
      if (data.date) {
        const monthStr = data.date.substring(0, 7);
        if (monthlyProfit[monthStr] === undefined) monthlyProfit[monthStr] = 0;
        
        if (data.type === 'entrada') {
          monthlyProfit[monthStr] += data.value;
          if (monthStr === currentMonthStr) {
            currentMonthRevenue += data.value;
          }
        } else {
          monthlyProfit[monthStr] -= data.value;
        }
      }
    });

    const evolutionChartData = Object.entries(monthlyProfit)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mes, lucro]) => ({ mes, lucro }));

    // 5. Estoque and Pronta-Entrega Calculations
    let estoqueCritico = 0;
    estoqueSnap.forEach(doc => {
      const data = doc.data();
      const stock = data.currentStock ?? data.quantidadeTotal ?? data.quantity ?? data.purchasedQuantity ?? 0;
      const alertQty = data.lowStockAlert ?? 0;
      if (stock <= alertQty) {
        estoqueCritico++;
      }
    });

    let prontaEntregaItems = 0;
    prontaEntregaSnap.forEach(doc => {
      const data = doc.data();
      prontaEntregaItems += (data.quantidadeDisponivel || 0);
    });

    // 6. Calculations
    const recebido = totalReceivedFromOrders + totalManualIncome;
    const saldoCaixa = initialBalance + recebido - totalManualExpense;
    const lucroLiquido = faturamentoBruto - custoProducaoTotal - totalManualExpense;

    return {
      plan,
      metrics: {
        faturamentoBruto,
        recebido,
        aReceber,
        saldoCaixa,
        lucroLiquido,
        pedidosPendentes,
        estoqueCritico,
        prontaEntregaItems,
        pedidosFila,
        pedidosProducao,
        currentMonthRevenue
      },
      recentExpenses,
      pendingOrders: pendingOrders.sort((a, b) => new Date(a.deadline || a.data || 0).getTime() - new Date(b.deadline || b.data || 0).getTime()).slice(0, 5),
      initialBalance,
      topProduct,
      evolutionChartData,
      onboarding: {
        hasEstoque: estoqueSnap.size > 0,
        hasCatalogo: catalogoSnap.size > 0,
        hasPedidos: pedidosSnap.size > 0
      },
      monthlyGoal
    };

  } catch (error) {
    console.error('Erro ao buscar dados da dashboard do Firebase:', error);
    // Fallback vazio
    return {
      plan: 'free',
      metrics: { faturamentoBruto: 0, recebido: 0, aReceber: 0, saldoCaixa: 0, lucroLiquido: 0, pedidosPendentes: 0, estoqueCritico: 0, prontaEntregaItems: 0, pedidosFila: 0, pedidosProducao: 0, currentMonthRevenue: 0 },
      recentExpenses: [],
      pendingOrders: [],
      initialBalance: 0,
      topProduct: null,
      evolutionChartData: [],
      onboarding: { hasEstoque: false, hasCatalogo: false, hasPedidos: false },
      monthlyGoal: 0
    };
  }
}
