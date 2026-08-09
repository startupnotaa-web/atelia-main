'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';
import { verifyAuth } from '@/lib/verifyAuth';

import { checkProductCreation, incrementProductCount } from '@/lib/checkSubscriptionLimits';
// ============================================================

export type PaymentStatus = 'pending' | 'half' | 'paid';
export type ProductionStatus = 'queue' | 'production' | 'finished' | 'shipped';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  isReadyDelivery: boolean;
  price: number;
}

export interface Order {
  id: string;
  // Campos ERP Legado
  clientName?: string;
  clientPhone?: string;
  orderDate?: string;
  deadline?: string;
  paymentStatus?: PaymentStatus;
  productionStatus?: ProductionStatus;
  items?: OrderItem[];
  totalValue?: number;
  isEncomenda?: boolean;
  paidValue?: number;
  remainingValue?: number;
  // Campos Novo Schema (Calculadora Unificada)
  cliente?: string;
  produto?: string;
  valor?: number;
  custo?: number;
  lucro?: number;
  status?: 'pendente' | 'em_producao' | 'concluido';
  data?: string;
  createdAt?: any;
  userId?: string;
  statusProducao?: 'fila' | 'producao' | 'finalizado' | 'entregue';
  valorFinal?: number;
  statusPagamento?: 'pendente' | 'sinal' | 'pago';
}

export interface StockItem {
  id: string;
  name?: string;
  nome?: string;
  imageUrl?: string;
  quantity?: number;
  quantidadeTotal?: number;
  price?: number;
  custoTotal?: number;
  unidadeMedida?: string;
}

export interface Transaction {
  id: string;
  orderId: string;
  amount: number;
  type: 'sinal' | 'integral' | 'restante';
  createdAt: string; // ISO string
}

// ============================================================
// SERVER ACTIONS
// ============================================================

export async function fetchPedidos(userId: string): Promise<Order[]> {
  try {
    const authUserId = await verifyAuth();
    if (authUserId !== userId) throw new Error('Não autorizado');
    
    const db = getAdminDb();
    // Removemos orderBy orderDate porque novos registros podem não ter orderDate, Firebase omitiria esses documentos.
    const snapshot = await db.collection('pedidos').where('userId', '==', userId).get();
    let pedidos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Order[];
    
    // Sort localmente por data de criação ou data do pedido
    pedidos.sort((a, b) => {
      const dateA = a.data || a.orderDate || a.createdAt || '';
      const dateB = b.data || b.orderDate || b.createdAt || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    
    return pedidos;
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    return [];
  }
}

export async function fetchEstoque(userId: string): Promise<StockItem[]> {
  try {
    const authUserId = await verifyAuth();
    if (authUserId !== userId) throw new Error('Não autorizado');
    
    const db = getAdminDb();
    const snapshot = await db.collection('estoque').where('userId', '==', userId).get();
    const estoque = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as StockItem[];
    
    return estoque;
  } catch (error) {
    console.error('Erro ao buscar estoque:', error);
    return [];
  }
}

export async function createPedido(data: Omit<Order, 'id' | 'paidValue' | 'remainingValue'>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const authUserId = await verifyAuth();
    
    // Sanitização de Inputs
    if (data.totalValue !== undefined && typeof data.totalValue !== 'number') throw new Error('Valor inválido');
    if (data.cliente && data.cliente.length > 200) data.cliente = data.cliente.substring(0, 200);
    if (data.produto && data.produto.length > 200) data.produto = data.produto.substring(0, 200);

    const db = getAdminDb();

    if (authUserId) {
      const { getUserLimits } = await import('@/lib/checkSubscriptionLimits');
      const limits = await getUserLimits(authUserId);
      if (!limits.isPro) {
        // Calcula data início e fim do mês atual
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
        
        const pedidosSnap = await db.collection('pedidos')
          .where('userId', '==', authUserId)
          .where('orderDate', '>=', startOfMonth)
          .where('orderDate', '<=', endOfMonth)
          .get();

        if (pedidosSnap.size >= 5) {
          return { success: false, error: 'LIMIT_REACHED_ORDERS' };
        }
      }
    }

    const novoPedido = {
      ...data,
      userId: authUserId,
      paidValue: 0,
      remainingValue: data.totalValue || 0,
    };
    
    const docRef = await db.collection('pedidos').add(novoPedido);
    revalidatePath('/pedidos');
    revalidatePath('/dashboard');
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Erro no servidor:', error);
    return { success: false, error: 'Falha ao registrar pedido.' };
  }
}

export async function updatePaymentStatus(orderId: string, currentStatus: PaymentStatus, newStatus: PaymentStatus, totalValue: number): Promise<{ success: boolean; error?: string }> {
  try {
    const authUserId = await verifyAuth();
    if (typeof totalValue !== 'number' || totalValue < 0 || !isFinite(totalValue)) throw new Error('Valor inválido');

    const db = getAdminDb();
    const batch = db.batch();
    const pedidoRef = db.collection('pedidos').doc(orderId);
    
    const pedidoDoc = await pedidoRef.get();
    if (!pedidoDoc.exists) {
      return { success: false, error: 'Pedido não encontrado.' };
    }
    if (pedidoDoc.data()?.userId !== authUserId) {
      throw new Error('401 Unauthorized');
    }

    let transactionAmount = 0;
    let transactionType: 'sinal' | 'integral' | 'restante' = 'integral';
    let newPaidValue = pedidoDoc.data()?.paidValue || 0;

    // Regras de Negócio Financeiras (Sem duplicidade)
    if (currentStatus === 'pending' && newStatus === 'half') {
      transactionAmount = totalValue / 2;
      transactionType = 'sinal';
      newPaidValue += transactionAmount;
    } else if (currentStatus === 'half' && newStatus === 'paid') {
      transactionAmount = totalValue / 2; // O restante
      transactionType = 'restante';
      newPaidValue += transactionAmount;
    } else if (currentStatus === 'pending' && newStatus === 'paid') {
      transactionAmount = totalValue; // Pagou tudo de uma vez
      transactionType = 'integral';
      newPaidValue += transactionAmount;
    } else {
      // Transição não suportada financeiramente nesta versão simplificada
      return { success: false, error: 'Transição de status financeiro não permitida.' };
    }

    const newRemainingValue = Math.max(0, totalValue - newPaidValue);

    // Criar a transação financeira
    const transRef = db.collection('transactions').doc();
    batch.set(transRef, {
      orderId,
      amount: transactionAmount,
      type: transactionType,
      createdAt: new Date().toISOString()
    });

    // Atualizar o pedido
    batch.update(pedidoRef, {
      paymentStatus: newStatus,
      paidValue: newPaidValue,
      remainingValue: newRemainingValue
    });

    await batch.commit();
    revalidatePath('/pedidos');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar status de pagamento:', error);
    return { success: false, error: 'Erro interno ao processar pagamento.' };
  }
}

export async function updateProductionStatus(orderId: string, newStatus: ProductionStatus, items: OrderItem[]): Promise<{ success: boolean; error?: string }> {
  try {
    const authUserId = await verifyAuth();
    const db = getAdminDb();
    const batch = db.batch();
    const pedidoRef = db.collection('pedidos').doc(orderId);
    
    const pedidoDoc = await pedidoRef.get();
    if (!pedidoDoc.exists || pedidoDoc.data()?.userId !== authUserId) {
      throw new Error('401 Unauthorized');
    }
    
    batch.update(pedidoRef, {
      productionStatus: newStatus
    });

    // Dedução automática de estoque
    if (newStatus === 'finished') {
      for (const item of items) {
        if (item.isReadyDelivery && item.id) {
          // Precisamos encontrar o item no estoque. 
          // O item.id passado pelo cliente pode ser o id real do estoque
          const estoqueRef = db.collection('estoque').doc(item.id);
          const estoqueDoc = await estoqueRef.get();
          
          if (estoqueDoc.exists) {
            const currentQty = estoqueDoc.data()?.quantity || 0;
            const newQty = Math.max(0, currentQty - item.quantity);
            batch.update(estoqueRef, { quantity: newQty });
          }
        }
      }
    }

    await batch.commit();
    revalidatePath('/pedidos');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar status de produção:', error);
    return { success: false, error: 'Erro interno ao atualizar status.' };
  }
}

export async function deletePedido(orderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const authUserId = await verifyAuth();
    const db = getAdminDb();
    const batch = db.batch();
    
    const pedidoRef = db.collection('pedidos').doc(orderId);
    const pedidoDoc = await pedidoRef.get();
    if (!pedidoDoc.exists || pedidoDoc.data()?.userId !== authUserId) {
      throw new Error('401 Unauthorized');
    }

    batch.delete(pedidoRef);
    
    // Deletar as transações financeiras associadas a este pedido para não corromper o financeiro
    const transSnap = await db.collection('transactions').where('orderId', '==', orderId).get();
    transSnap.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    revalidatePath('/pedidos');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Erro ao excluir pedido:', error);
    return { success: false, error: 'Erro ao excluir o pedido.' };
  }
}
export async function addCatalogItem(data: any): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const authUserId = await verifyAuth();
    
    // Sanitização
    if (data.price !== undefined && typeof data.price !== 'number') throw new Error('Preço inválido');
    if (data.name && typeof data.name === 'string' && data.name.length > 200) data.name = data.name.substring(0, 200);

    // Integração do Paywall: Verifica se pode criar produto
    try {
      await checkProductCreation(authUserId);
    } catch (e: any) {
      if (e.message.includes('PLAN_LIMIT_REACHED')) {
        return { success: false, error: 'LIMIT_REACHED_PRODUCTS' };
      }
      throw e;
    }

    const db = getAdminDb();
    const docRef = await db.collection('catalogo').add({
      ...data,
      userId: authUserId,
      createdAt: new Date().toISOString()
    });

    // Incrementa contador de produtos criados se for plano Free
    await incrementProductCount(authUserId);

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Erro ao adicionar produto no catálogo:', error);
    return { success: false, error: 'Falha ao registrar produto.' };
  }
}

export async function addStockItem(data: any): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const authUserId = await verifyAuth();
    
    // Sanitização
    if (data.quantity !== undefined && typeof data.quantity !== 'number') throw new Error('Quantidade inválida');
    if (data.price !== undefined && typeof data.price !== 'number') throw new Error('Preço inválido');

    const db = getAdminDb();
    
    if (authUserId) {
      const { getUserLimits } = await import('@/lib/checkSubscriptionLimits');
      const limits = await getUserLimits(authUserId);
      if (!limits.isPro) {
        const estoqueSnap = await db.collection('estoque').where('userId', '==', authUserId).get();
        
        let totalStockQuantity = 0;
        estoqueSnap.forEach(doc => {
          totalStockQuantity += doc.data().quantity || 0;
        });
        
        // Check if adding the new item exceeds the limit
        if (totalStockQuantity + (data.quantity || 0) > 20) {
          return { success: false, error: 'LIMIT_REACHED_STOCK' };
        }
      }
    }

    const docRef = await db.collection('estoque').add({
      ...data,
      userId: authUserId,
      createdAt: new Date().toISOString()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Erro ao adicionar item no estoque:', error);
    return { success: false, error: 'Falha ao registrar estoque.' };
  }
}

