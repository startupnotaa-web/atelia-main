// Motor de cálculo da Calculadora de Precificação.
// Toda soma monetária passa por roundCents() para evitar arrastar erros de
// ponto flutuante (ex: 0.1 + 0.2 !== 0.3) ao longo de várias etapas.

export interface MaterialCusto {
  /** Custo total do item já multiplicado pela quantidade usada (R$). */
  custoTotal: number;
}

export interface FerramentaCusto {
  /** Custo de desgaste já multiplicado pelo tempo de uso na peça (R$). */
  custoTotal: number;
}

export interface PricingEngineInput {
  /** Quanto o artesão quer ganhar por mês (pró-labore), em R$. */
  proLaboreMensal: number;
  /** Horas trabalhadas no mês. */
  horasTrabalhadasMes: number;
  /** Tempo gasto produzindo esta peça, em horas (decimal, ex: 1.5). */
  horasGastasPeca: number;

  /** Itens de material já com custo total calculado (qty * unitário). */
  materiais: MaterialCusto[];
  /** % de perda/desperdício aplicada sobre o custo de materiais. */
  taxaDesperdicioPercent: number;

  /** Ferramentas/equipamentos com custo de desgaste já calculado. */
  ferramentas: FerramentaCusto[];

  /** Soma dos custos fixos mensais do ateliê (aluguel + água/luz + internet etc). */
  custosFixosMensais: number;

  /** Custos variáveis diretos da peça (embalagem, frete). */
  embalagem: number;
  frete: number;

  /** Taxas transacionais, em % sobre o preço final. */
  taxaCartaoPercent: number;
  comissaoPlataformaPercent: number;
  impostoPercent: number;

  /** Margem de lucro desejada, em % sobre o preço final. */
  margemLucroPercent: number;

  /** Se true, arredonda o preço final para cima (R$ cheio). */
  arredondarPrecoFinal?: boolean;
}

export interface PricingBreakdownItem {
  label: string;
  valor: number;
}

export interface PricingEngineResult {
  custoMaoDeObra: number;
  custoMateriais: number;
  custoDesperdicio: number;
  custoFerramentas: number;
  custoFixoRateado: number;
  custoEmbalagemFrete: number;
  custoBaseTotal: number;

  somaPercentuais: number;
  divisorMarkup: number;
  /** true quando a soma de taxas + margem >= 100%, tornando o preço inválido. */
  markupInvalido: boolean;

  valorHora: number;
  precoIdealVenda: number;
  precoFinalVenda: number;
  lucroReal: number;
  valorCartao: number;
  valorPlataforma: number;
  valorImposto: number;

  /** Breakdown pronto para o "Recibo de Custos" visual. */
  breakdown: PricingBreakdownItem[];
}

/** Arredonda para centavos (2 casas), evitando erro de ponto flutuante. */
export function roundCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sumCusto(items: { custoTotal: number }[]): number {
  return roundCents(items.reduce((acc, item) => acc + (item.custoTotal || 0), 0));
}

export function calculatePricing(input: PricingEngineInput): PricingEngineResult {
  const horasMes = input.horasTrabalhadasMes > 0 ? input.horasTrabalhadasMes : 160;
  const proLabore = input.proLaboreMensal || 0;
  const valorHora = roundCents(proLabore / horasMes);

  const custoMaoDeObra = roundCents(valorHora * (input.horasGastasPeca || 0));

  const custoMateriaisBruto = sumCusto(input.materiais);
  const taxaDesperdicio = Math.max(0, input.taxaDesperdicioPercent || 0);
  const custoDesperdicio = roundCents(custoMateriaisBruto * (taxaDesperdicio / 100));
  const custoMateriais = roundCents(custoMateriaisBruto + custoDesperdicio);

  const custoFerramentas = sumCusto(input.ferramentas);

  const horasTotalPeca = input.horasGastasPeca || 0;
  const custoFixoRateado = roundCents(
    (input.custosFixosMensais || 0) / horasMes * horasTotalPeca
  );

  const custoEmbalagemFrete = roundCents((input.embalagem || 0) + (input.frete || 0));

  const custoBaseTotal = roundCents(
    custoMaoDeObra + custoMateriais + custoFerramentas + custoFixoRateado + custoEmbalagemFrete
  );

  const margem = Math.max(0, input.margemLucroPercent || 0);
  const cartao = Math.max(0, input.taxaCartaoPercent || 0);
  const plataforma = Math.max(0, input.comissaoPlataformaPercent || 0);
  const imposto = Math.max(0, input.impostoPercent || 0);
  const somaPercentuais = margem + cartao + plataforma + imposto;

  const divisorMarkup = 1 - somaPercentuais / 100;
  const markupInvalido = divisorMarkup <= 0;

  const precoIdealVenda = markupInvalido ? 0 : roundCents(custoBaseTotal / divisorMarkup);
  const precoFinalVenda = input.arredondarPrecoFinal
    ? Math.ceil(precoIdealVenda)
    : precoIdealVenda;

  const lucroReal = roundCents(precoFinalVenda * (margem / 100));
  const valorCartao = roundCents(precoFinalVenda * (cartao / 100));
  const valorPlataforma = roundCents(precoFinalVenda * (plataforma / 100));
  const valorImposto = roundCents(precoFinalVenda * (imposto / 100));

  const breakdown: PricingBreakdownItem[] = [
    { label: 'Materiais', valor: custoMateriais },
    { label: 'Mão de Obra', valor: custoMaoDeObra },
    { label: 'Ferramentas', valor: custoFerramentas },
    { label: 'Custos Fixos', valor: custoFixoRateado },
    { label: 'Embalagem/Frete', valor: custoEmbalagemFrete },
    { label: 'Taxas (cartão/plataforma/imposto)', valor: roundCents(valorCartao + valorPlataforma + valorImposto) },
    { label: 'Lucro', valor: lucroReal },
  ];

  return {
    custoMaoDeObra,
    custoMateriais,
    custoDesperdicio,
    custoFerramentas,
    custoFixoRateado,
    custoEmbalagemFrete,
    custoBaseTotal,
    somaPercentuais,
    divisorMarkup,
    markupInvalido,
    valorHora,
    precoIdealVenda,
    precoFinalVenda,
    lucroReal,
    valorCartao,
    valorPlataforma,
    valorImposto,
    breakdown,
  };
}

export interface Equipment {
  id: string;
  name: string;
  /** Preço de compra do equipamento (R$). */
  price: number;
  /** Vida útil estimada, em horas de uso. */
  usefulLifeHours: number;
  /** Derivado: price / usefulLifeHours (R$/hora de depreciação). */
  costPerHour: number;
}

/**
 * Deriva o custo de depreciação por hora-máquina: costPerHour = price / usefulLifeHours.
 * Retorna 0 com segurança quando a vida útil não foi preenchida (evita divisão por zero/NaN/Infinity).
 * Não é arredondado para centavos aqui — é uma taxa, não um valor monetário final;
 * arredondar cedo demais perderia precisão em equipamentos de vida útil longa
 * (ex: 1500 / 100000h = R$0,015/h).
 */
export function calculateCostPerHour(price: number, usefulLifeHours: number): number {
  if (!(usefulLifeHours > 0)) return 0;
  return (price || 0) / usefulLifeHours;
}

/**
 * Custo de depreciação gerado por uma ferramenta/equipamento nesta peça:
 * (tempo de uso em horas) * (custo por hora-máquina do equipamento).
 */
export function calculateToolDepreciationCost(costPerHour: number, hoursUsedOnPiece: number): number {
  return roundCents((costPerHour || 0) * (hoursUsedOnPiece || 0));
}

/** Abaixo desta margem, o alerta de "margem perigosa" é exibido na UI. */
export const MARGEM_SEGURA_MINIMA_PERCENT = 10;

export interface ReverseMarginResult {
  /** Margem de lucro implícita no preço digitado pelo usuário, em %. */
  margemPercent: number;
  /** Lucro em R$ (preço digitado - custo total travado). */
  lucroReal: number;
  /** true quando a margem implícita está abaixo do limite seguro. */
  margemPerigosa: boolean;
}

/**
 * Cálculo reverso (goal seek): dado um Preço Final digitado manualmente pelo
 * usuário e o Custo Total já travado (materiais + mão de obra + rateios),
 * deriva a Margem de Lucro implícita. Não usa o divisor de markup do cálculo
 * direto — é uma margem simples sobre o custo, conforme pedido pelo negócio.
 */
export function calculateReverseMargin(
  precoFinalDigitado: number,
  custoTotal: number
): ReverseMarginResult {
  if (!(custoTotal > 0)) {
    return { margemPercent: 0, lucroReal: 0, margemPerigosa: false };
  }
  const lucroReal = roundCents(precoFinalDigitado - custoTotal);
  const margemPercent = roundCents(((precoFinalDigitado - custoTotal) / custoTotal) * 100);
  return {
    margemPercent,
    lucroReal,
    margemPerigosa: margemPercent < MARGEM_SEGURA_MINIMA_PERCENT,
  };
}
