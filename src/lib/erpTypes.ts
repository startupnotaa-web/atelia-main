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
