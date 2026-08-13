import { describe, it, expect } from 'vitest';
import {
  calculatePricing,
  calculateReverseMargin,
  calculateCostPerHour,
  calculateToolDepreciationCost,
  roundCents,
  PricingEngineInput,
} from './pricingEngine';

function baseInput(overrides: Partial<PricingEngineInput> = {}): PricingEngineInput {
  return {
    proLaboreMensal: 3200,
    horasTrabalhadasMes: 160,
    horasGastasPeca: 2,
    materiais: [{ custoTotal: 50 }],
    taxaDesperdicioPercent: 0,
    ferramentas: [],
    custosFixosMensais: 0,
    embalagem: 0,
    frete: 0,
    taxaCartaoPercent: 0,
    comissaoPlataformaPercent: 0,
    impostoPercent: 0,
    margemLucroPercent: 0,
    ...overrides,
  };
}

describe('roundCents', () => {
  it('avoids classic floating point drift', () => {
    expect(roundCents(0.1 + 0.2)).toBe(0.3);
    expect(roundCents(19.999999999998)).toBe(20);
  });
});

describe('calculatePricing - mão de obra', () => {
  it('calcula valor da hora dividindo pró-labore pelas horas do mês', () => {
    const result = calculatePricing(baseInput());
    expect(result.valorHora).toBe(20); // 3200 / 160
    expect(result.custoMaoDeObra).toBe(40); // 20 * 2h
  });

  it('usa fallback de 160h quando horasTrabalhadasMes é zero (evita divisão por zero)', () => {
    const result = calculatePricing(baseInput({ horasTrabalhadasMes: 0 }));
    expect(result.valorHora).toBe(20);
  });
});

describe('calculatePricing - materiais e desperdício', () => {
  it('soma custos de materiais sem desperdício', () => {
    const result = calculatePricing(baseInput({
      materiais: [{ custoTotal: 10 }, { custoTotal: 15.5 }],
    }));
    expect(result.custoMateriais).toBe(25.5);
  });

  it('aplica taxa de desperdício percentual sobre o custo de materiais', () => {
    const result = calculatePricing(baseInput({
      materiais: [{ custoTotal: 100 }],
      taxaDesperdicioPercent: 10,
    }));
    expect(result.custoDesperdicio).toBe(10);
    expect(result.custoMateriais).toBe(110);
  });
});

describe('calculatePricing - custos fixos (rateio)', () => {
  it('rateia custos fixos mensais proporcionalmente às horas gastas na peça', () => {
    const result = calculatePricing(baseInput({
      custosFixosMensais: 800,
      horasTrabalhadasMes: 160,
      horasGastasPeca: 4,
    }));
    expect(result.custoFixoRateado).toBe(20); // (800/160) * 4
  });
});

describe('calculatePricing - markup e preço final', () => {
  it('calcula preço final via divisor de markup (custo / (1 - soma%))', () => {
    const result = calculatePricing(baseInput({
      materiais: [{ custoTotal: 100 }],
      horasGastasPeca: 0,
      margemLucroPercent: 20,
    }));
    // custoBaseTotal = 100, divisor = 1 - 0.2 = 0.8
    expect(result.custoBaseTotal).toBe(100);
    expect(result.precoIdealVenda).toBe(125);
    expect(result.precoFinalVenda).toBe(125);
    expect(result.lucroReal).toBe(25); // 20% de 125
  });

  it('marca markupInvalido quando a soma de taxas e margem é >= 100%', () => {
    const result = calculatePricing(baseInput({
      margemLucroPercent: 60,
      taxaCartaoPercent: 20,
      comissaoPlataformaPercent: 15,
      impostoPercent: 10,
    }));
    expect(result.markupInvalido).toBe(true);
    expect(result.precoFinalVenda).toBe(0);
  });

  it('arredonda o preço final para cima quando solicitado', () => {
    const result = calculatePricing(baseInput({
      materiais: [{ custoTotal: 101 }],
      horasGastasPeca: 0,
      margemLucroPercent: 10,
      arredondarPrecoFinal: true,
    }));
    // 101 / 0.9 = 112.2222...
    expect(result.precoIdealVenda).toBeCloseTo(112.22, 2);
    expect(result.precoFinalVenda).toBe(113);
  });

  it('não deixa a soma dos itens do breakdown divergir do preço final por mais de 1 centavo', () => {
    const input = baseInput({
      materiais: [{ custoTotal: 33.33 }],
      ferramentas: [{ custoTotal: 12.34 }],
      custosFixosMensais: 500,
      horasGastasPeca: 3,
      embalagem: 4.5,
      frete: 7.9,
      taxaCartaoPercent: 3.5,
      comissaoPlataformaPercent: 12,
      impostoPercent: 6,
      margemLucroPercent: 30,
    });
    const result = calculatePricing(input);
    const somaBreakdown = result.breakdown.reduce((acc, item) => acc + item.valor, 0);
    expect(Math.abs(somaBreakdown - result.precoFinalVenda)).toBeLessThanOrEqual(0.01);
  });
});

describe('calculateReverseMargin (goal seek)', () => {
  it('deriva a margem a partir do preço digitado e do custo total travado', () => {
    const result = calculateReverseMargin(150, 100);
    expect(result.margemPercent).toBe(50);
    expect(result.lucroReal).toBe(50);
    expect(result.margemPerigosa).toBe(false);
  });

  it('sinaliza margem perigosa quando abaixo do limite seguro (10%)', () => {
    const result = calculateReverseMargin(105, 100);
    expect(result.margemPercent).toBe(5);
    expect(result.margemPerigosa).toBe(true);
  });

  it('sinaliza margem perigosa (negativa) quando o preço digitado é menor que o custo', () => {
    const result = calculateReverseMargin(80, 100);
    expect(result.margemPercent).toBe(-20);
    expect(result.lucroReal).toBe(-20);
    expect(result.margemPerigosa).toBe(true);
  });

  it('retorna zero com segurança quando o custo total é zero (evita divisão por zero)', () => {
    const result = calculateReverseMargin(150, 0);
    expect(result.margemPercent).toBe(0);
    expect(result.margemPerigosa).toBe(false);
  });

  it('não trava (loop) quando aplicado repetidamente ao mesmo par preço/custo — é uma função pura', () => {
    const a = calculateReverseMargin(133.33, 100);
    const b = calculateReverseMargin(133.33, 100);
    expect(a).toEqual(b);
  });
});

describe('calculateCostPerHour (depreciação de equipamento)', () => {
  it('calcula o exemplo do enunciado: R$1500 / 10000h = R$0,15/h', () => {
    expect(calculateCostPerHour(1500, 10000)).toBeCloseTo(0.15, 5);
  });

  it('retorna 0 com segurança quando a vida útil é zero (evita divisão por zero)', () => {
    expect(calculateCostPerHour(1500, 0)).toBe(0);
  });

  it('retorna 0 com segurança quando a vida útil é negativa', () => {
    expect(calculateCostPerHour(1500, -10)).toBe(0);
  });

  it('retorna 0 com segurança quando a vida útil não é um número (NaN)', () => {
    expect(calculateCostPerHour(1500, NaN)).toBe(0);
  });

  it('mantém precisão para equipamentos de vida útil longa, sem arredondar cedo demais', () => {
    expect(calculateCostPerHour(1500, 100000)).toBeCloseTo(0.015, 5);
  });
});

describe('calculateToolDepreciationCost', () => {
  it('multiplica custo por hora pelo tempo de uso na peça', () => {
    expect(calculateToolDepreciationCost(0.15, 2)).toBe(0.3);
  });

  it('arredonda o resultado final em centavos', () => {
    expect(calculateToolDepreciationCost(0.015, 3)).toBe(0.05); // 0.045 -> 0.05
  });

  it('retorna 0 quando o tempo de uso é zero', () => {
    expect(calculateToolDepreciationCost(0.15, 0)).toBe(0);
  });
});

describe('calculatePricing - ferramentas via depreciação por hora-máquina', () => {
  it('soma a depreciação de múltiplas ferramentas ao custo total, alimentando o cálculo reverso', () => {
    const custoMaquinaCostura = calculateToolDepreciationCost(calculateCostPerHour(1500, 10000), 2); // 0.30
    const custoFuradeira = calculateToolDepreciationCost(calculateCostPerHour(300, 5000), 0.5); // 0.03

    const input: PricingEngineInput = {
      proLaboreMensal: 0,
      horasTrabalhadasMes: 160,
      horasGastasPeca: 0,
      materiais: [{ custoTotal: 50 }],
      taxaDesperdicioPercent: 0,
      ferramentas: [{ custoTotal: custoMaquinaCostura }, { custoTotal: custoFuradeira }],
      custosFixosMensais: 0,
      embalagem: 0,
      frete: 0,
      taxaCartaoPercent: 0,
      comissaoPlataformaPercent: 0,
      impostoPercent: 0,
      margemLucroPercent: 0,
    };

    const result = calculatePricing(input);
    expect(result.custoFerramentas).toBeCloseTo(0.33, 5);
    expect(result.custoBaseTotal).toBeCloseTo(50.33, 5);

    // O cálculo reverso deve enxergar o custo total já incluindo a depreciação.
    const reverso = calculateReverseMargin(70, result.custoBaseTotal);
    expect(reverso.margemPercent).toBeCloseTo(((70 - 50.33) / 50.33) * 100, 2);
  });
});
