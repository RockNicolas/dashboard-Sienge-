// Distribuição do consumo de um relatório (total do período) pelos meses do período. Funções puras.
import type { Consumo, ItemApropriacao, Obra } from '../types';

export interface ParteMes { mes: string; dias: number; ultimo: string }

const r = (n: number, casas: number) => Math.round(n * 10 ** casas) / 10 ** casas;

/** Dias do período por mês: [{ mes: 'AAAA-MM', dias, ultimo: 'AAAA-MM-DD' }] */
export function mesesDoPeriodo(de: string, ate: string): ParteMes[] {
  const out: ParteMes[] = [];
  const fim = new Date(`${ate}T12:00:00Z`);
  for (const d = new Date(`${de}T12:00:00Z`); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const mes = iso.slice(0, 7);
    const ult = out[out.length - 1];
    if (ult && ult.mes === mes) { ult.dias++; ult.ultimo = iso; } else out.push({ mes, dias: 1, ultimo: iso });
  }
  return out;
}

/**
 * Converte os itens do relatório em lançamentos de consumo. Com `distribuir`, reparte quantidade e valor
 * pelos meses (proporcional aos dias; a sobra de arredondamento vai para o último mês, então a soma é exata).
 * Sem `distribuir`, lança tudo no último dia do período.
 */
export function distribuirConsumo(itens: ItemApropriacao[], de: string, ate: string, obra: Obra, distribuir: boolean): Consumo[] {
  const partes = distribuir ? mesesDoPeriodo(de, ate) : [{ mes: ate.slice(0, 7), dias: 1, ultimo: ate }];
  const totalDias = partes.reduce((a, m) => a + m.dias, 0);
  const linhas: Consumo[] = [];
  for (const it of itens) {
    let qRest = it.qtd, vRest = it.total;
    partes.forEach((m, i) => {
      const ultimo = i === partes.length - 1;
      const q = ultimo ? r(qRest, 4) : r((it.qtd * m.dias) / totalDias, 4);
      const v = ultimo ? r(vRest, 2) : r((it.total * m.dias) / totalDias, 2);
      qRest -= q; vRest -= v;
      if (q || v) linhas.push({
        data: m.ultimo, obraId: obra.id, obra: obra.nome,
        insumoId: it.insumoId, insumo: it.insumo, un: it.un, qtd: q, valor: v,
      });
    });
  }
  return linhas;
}
