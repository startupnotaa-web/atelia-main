// Tipos compartilhados do fluxo Catálogo → Prateleira (estoque_pronto) → Venda de Balcão.
// A mesma forma de documento é lida/escrita por /pronta-entrega e /venda-balcao;
// manter o tipo único evita que os módulos divirjam sobre o schema do Firestore.

/** Documento da coleção `estoque_pronto` (peças prontas na prateleira). */
export interface EstoqueProntoItem {
  id: string;
  /** Referência ao documento do `catalogo` que originou a peça. */
  produtoId: string;
  nome: string;
  precoVenda: number;
  /** Custo de produção unitário, herdado da Calculadora (catalogo.custoBase). */
  custoUnitario: number;
  quantidadeDisponivel: number;
  /** Marcado como true pela Venda de Balcão quando a quantidade zera. */
  esgotado?: boolean;
  userId?: string;
}

/**
 * Documento da coleção `estoque` (matéria-prima / insumos), dono canônico:
 * `src/components/StockGrid.tsx` (tela `/estoque`).
 *
 * Ver INTEGRATION_BLUEPRINT.md §2.2 — antes desta correção, quatro escritores
 * diferentes (Calculadora, `actions/erp.ts`, webhook Fenix3D, `/pedidos`)
 * gravavam o saldo em campos diferentes, e o alerta de estoque crítico da
 * Dashboard não enxergava boa parte deles.
 */
export interface EstoqueItem {
  id: string;
  nome: string;
  unidadeMedida: string;
  /** Custo total pago pelo lote atual (usado para calcular custo médio por unidade). */
  custoTotal: number;
  /**
   * Saldo atualmente disponível — campo OFICIAL de saldo. Toda baixa de
   * estoque (venda, produção, "Transformar em Pedido") deve decrementar
   * este campo, e somente ele.
   *
   * Aliases legados, ainda presentes em documentos antigos e mantidos como
   * fallback só na LEITURA (nunca escrever neles): `quantidadeTotal`,
   * `quantidade`, `quantity`, `purchasedQuantity`.
   */
  currentStock: number;
  /** Quantidade originalmente comprada no lote (histórico) — não é saldo disponível. */
  quantidadeTotal: number;
  /** Abaixo deste valor, `StockGrid` marca o item como "A Acabar!". */
  lowStockAlert?: number;
  /** Id do lançamento espelhado em `finance_entries` (compra/reabastecimento), para cascade-delete. */
  linkedFinanceEntryId?: string;
  userId: string;
}

/** Status de pagamento de um Pedido — oficial, valores em português (dono: `/pedidos`). */
export type PaymentStatus = 'pendente' | 'sinal' | 'pago';

/**
 * Status de produção de um Pedido — oficial. É o campo que o Kanban de
 * `/pedidos` usa para agrupar os cartões em colunas.
 */
export type ProductionStatus = 'fila' | 'producao' | 'finalizado' | 'entregue';

/**
 * Documento da coleção `pedidos`. Campos oficiais de status: `statusProducao`
 * (dono do Kanban) e `statusPagamento`.
 *
 * @deprecated campo legado `status` (ex.: `'pendente'|'em_producao'|'concluido'`),
 * gravado historicamente pela Calculadora (ver INTEGRATION_BLUEPRINT.md §2.3).
 * O Kanban de `/pedidos` agrupa exclusivamente por `statusProducao` e nunca lê
 * `status` — por isso ele NÃO é um campo desta interface: qualquer código que
 * tentar gravar `status` aqui deve falhar no `tsc`, não silenciosamente cair
 * na coluna errada do Kanban.
 */
export interface Pedido {
  id: string;
  userId: string;
  cliente: string;
  clienteNome?: string;
  produtoId?: string;
  produtoNome: string;
  valorFinal: number;
  /** Custo de produção total do pedido (soma dos `custoUnitario`/`custoBase` dos itens). */
  custo?: number;
  /** Lucro líquido do pedido — é o que a Dashboard soma em `lucroLiquido`. */
  lucro?: number;
  statusPagamento: PaymentStatus;
  statusProducao: ProductionStatus;
  dataEntrega?: string;
  data?: string;
  origem?: string;
  items?: unknown[];
  detalhesCalculo?: unknown;
  createdAt: unknown;
}

// --- Motor de Vendas (src/app/actions/sales.ts) ---
// Fluxo Transacional Único: todo ponto de entrada de venda (PDV, WhatsApp,
// Consignação, e futuramente a Calculadora) monta um payload deste formato e
// chama `registrarVenda()`, em vez de reimplementar seu próprio writeBatch
// com nomes de campo ligeiramente diferentes (a causa raiz dos gargalos
// documentados em INTEGRATION_BLUEPRINT.md §2.2/§2.3).

export type OrigemVenda = 'pdv' | 'whatsapp' | 'consignacao' | 'calculadora';
export type FormaPagamentoVenda = 'dinheiro' | 'pix' | 'cartao' | 'outro';

export interface ItemVenda {
  /**
   * Id do documento a decrementar. Omitir quando a venda não referencia
   * estoque controlado (ex: venda solta registrada por texto no WhatsApp).
   */
  estoqueId?: string;
  /**
   * Qual coleção o `estoqueId` referencia — decide se o motor decrementa
   * `currentStock` (coleção `estoque`, insumo) ou `quantidadeDisponivel`
   * (coleção `estoque_pronto`, peça pronta). Default: `'pronta_entrega'`.
   */
  tipoEstoque?: 'insumo' | 'pronta_entrega';
  nome: string;
  quantidade: number;
  precoUnitario: number;
  /** Custo de produção unitário. Já resolvido pelo chamador — ver nota em `registrarVenda`. */
  custoUnitario?: number;
}

export interface RegistrarVendaPayload {
  userId: string;
  itens: ItemVenda[];
  /** Valor final cobrado do cliente (já líquido de desconto). */
  valorTotal: number;
  /** Custo total do pedido (produção + qualquer comissão/taxa de canal). */
  custoTotal: number;
  formaPagamento: FormaPagamentoVenda;
  origem: OrigemVenda;
  clienteNome?: string;
  /** Nome exibido no pedido; default: nome do item único ou "N itens". */
  produtoNome?: string;
  /** Default: 'pago' — o motor assume venda já concluída (PDV/WhatsApp/Consignação). */
  statusPagamento?: PaymentStatus;
  /** Default: 'entregue'. */
  statusProducao?: ProductionStatus;
  descricaoFinanceira?: string;
  /** Campos extras específicos da origem (ex: desconto, troco) — mesclados no documento do pedido, fora do contrato canônico. */
  metadados?: Record<string, unknown>;
}

export interface RegistrarVendaResult {
  success: boolean;
  pedidoId?: string;
  error?: string;
}
