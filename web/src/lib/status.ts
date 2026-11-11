// Cores com significado: cada indicador que tem "bom ou ruim" vira um destes 4 níveis.
// O que é só informação (total comprado, nº de pedidos...) fica neutro, para os alertas se destacarem.
// Os limites de cada indicador estão em LIMITES: ajuste aqui para deixar mais rígido ou mais tolerante.
import type { TotaisCusto } from '@server/types';

export type Nivel = 'bom' | 'melhorar' | 'atencao' | 'ruim';
export interface Status { nivel: Nivel; motivo: string }

export const NIVEIS: { nivel: Nivel; nome: string; icone: string }[] = [
  { nivel: 'bom', nome: 'Bom', icone: '✓' },
  { nivel: 'melhorar', nome: 'Pode melhorar', icone: '~' },
  { nivel: 'atencao', nome: 'Perto de dar problema', icone: '!' },
  { nivel: 'ruim', nome: 'Ruim', icone: '✕' },
];
export const infoNivel = (n: Nivel) => NIVEIS.find(x => x.nivel === n)!;

/**
 * Limites [bom até, pode melhorar até, perto de dar problema até]; passou do último = ruim.
 * `margem` é ao contrário (quanto maior, melhor): [bom a partir de, pode melhorar a partir de, perto de dar problema a partir de].
 */
export const LIMITES = {
  orcamento: [85, 95, 100],     // % do orçado já comprometido (atendido + pendente)
  margem: [15, 5, 0],           // margem % = resultado ÷ receitas
  vencido: [0, 5, 15],          // % do valor que está vencido e não foi baixado
  atraso: [0, 5, 15],           // % dos pedidos com entrega em atraso
  concentracao: [20, 35, 50],   // % das compras com um único fornecedor
  variacaoPreco: [10, 25, 50],  // % do menor ao maior preço pago no mesmo material
  cota: [50, 70, 90],           // % da cota diária da API já usada
  // gráficos por mês/semana: cada período comparado com a média dos períodos completos
  acimaDaMedia: [0, 25, 50],    // % acima da média (na média ou abaixo = bom)
  precoAcimaDaMedia: [0, 10, 25], // preço de uma compra × preço médio do material (abaixo da média = bom)
} as const;

const fmt = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString('pt-BR')}%`;

/** Quanto maior, pior (orçamento, vencidos, atrasos...). */
function subindoPiora(v: number, [a, b, c]: readonly number[]): Nivel {
  return v <= a ? 'bom' : v <= b ? 'melhorar' : v <= c ? 'atencao' : 'ruim';
}

/**
 * Orçamento da obra/serviço/insumo: quanto do orçado já está comprometido (atendido + pendente).
 * Sem orçado: se a obra inteira não tem orçamento no Sienge, "pode melhorar" (cadastrar o orçamento para acompanhar);
 * se a obra tem orçamento e só este item está sem, é gasto fora do previsto (`obraTemOrcamento`).
 */
export function statusOrcamento(t: TotaisCusto, obraTemOrcamento = t.orcado > 0): Status | null {
  if (t.orcado <= 0) {
    if (t.atendido + t.pendente <= 0) return null;
    return obraTemOrcamento
      ? { nivel: 'atencao', motivo: 'Gasto em item que não está no orçamento' }
      : { nivel: 'melhorar', motivo: 'Obra sem orçamento no Sienge: cadastre o orçamento para acompanhar o estouro' };
  }
  const p = ((t.atendido + t.pendente) / t.orcado) * 100;
  const nivel = subindoPiora(p, LIMITES.orcamento);
  return { nivel, motivo: p > 100 ? `Passou do orçamento: ${fmt(p)} do orçado comprometido` : `${fmt(p)} do orçado já comprometido (atendido + pendente)` };
}

/** Margem: resultado ÷ receitas. Sem receita e com despesa = ruim. */
export function statusMargem(resultado: number, receitas: number): Status | null {
  if (receitas <= 0) return resultado < 0 ? { nivel: 'ruim', motivo: 'Despesas sem receita no período' } : null;
  const m = (resultado / receitas) * 100;
  const [a, b, c] = LIMITES.margem;
  const nivel: Nivel = m >= a ? 'bom' : m >= b ? 'melhorar' : m >= c ? 'atencao' : 'ruim';
  return { nivel, motivo: m < 0 ? `Prejuízo: margem de ${fmt(m)}` : `Margem de ${fmt(m)}` };
}

/** Parte do valor que já venceu e não foi baixada (a receber = inadimplência; a pagar = contas atrasadas). */
export function statusVencido(vencido: number, total: number, oQue: 'a receber' | 'a pagar'): Status | null {
  if (total <= 0) return null;
  const p = (vencido / total) * 100;
  return { nivel: subindoPiora(p, LIMITES.vencido), motivo: vencido > 0 ? `${fmt(p)} do valor ${oQue} está vencido` : `Nada ${oQue} vencido` };
}

/** Pedidos com entrega em atraso. */
export function statusAtraso(atrasados: number, pedidos: number): Status | null {
  if (pedidos <= 0) return null;
  const p = (atrasados / pedidos) * 100;
  return { nivel: subindoPiora(p, LIMITES.atraso), motivo: atrasados ? `${fmt(p)} dos pedidos com entrega em atraso` : 'Nenhuma entrega em atraso' };
}

/** Dependência de um fornecedor só. */
export function statusConcentracao(participacao: number): Status | null {
  if (participacao <= 0) return null;
  return { nivel: subindoPiora(participacao, LIMITES.concentracao), motivo: `${fmt(participacao)} das compras com um único fornecedor` };
}

/** Diferença entre o menor e o maior preço pago no mesmo material (alta = dá para negociar melhor). */
export function statusVariacaoPreco(variacao: number): Status | null {
  return { nivel: subindoPiora(variacao, LIMITES.variacaoPreco), motivo: `O maior preço pago foi ${fmt(variacao)} acima do menor` };
}

/** Cota diária da API do Sienge. */
export function statusCota(pctUsado: number, limite: number): Status | null {
  if (!limite) return null;
  return { nivel: subindoPiora(pctUsado, LIMITES.cota), motivo: `${fmt(pctUsado)} da cota de hoje já usada` };
}

/** Um valor (ex.: compras do mês) comparado com a média: na média ou abaixo = bom; quanto mais acima, pior. */
export function statusVsMedia(valor: number, media: number): Status | null {
  if (media <= 0) return null;
  const p = (valor / media - 1) * 100;
  return { nivel: subindoPiora(p, LIMITES.acimaDaMedia), motivo: p <= 0 ? `${fmt(-p)} abaixo da média` : `${fmt(p)} acima da média` };
}

/** Preço pago numa compra × preço médio do material. */
export function statusPreco(preco: number, medio: number): Status | null {
  if (medio <= 0 || preco <= 0) return null;
  const p = (preco / medio - 1) * 100;
  return { nivel: subindoPiora(p, LIMITES.precoAcimaDaMedia), motivo: p <= 0 ? `${fmt(-p)} abaixo do preço médio` : `${fmt(p)} acima do preço médio` };
}

/**
 * Status de cada período de uma série (mês, semana...) contra a média dos períodos completos que tiveram movimento
 * (meses zerados costumam ser "sem dados", e puxariam a média para baixo, deixando tudo vermelho).
 * O período em andamento (`emAndamento`) fica sem cor: incompleto, ele pareceria "barato".
 */
export function statusPorPeriodo(serie: { periodo: string; valor: number }[], emAndamento?: string) {
  const completos = serie.filter(p => p.periodo !== emAndamento && p.valor > 0);
  const media = completos.length ? completos.reduce((t, p) => t + p.valor, 0) / completos.length : 0;
  return { media, status: serie.map(p => (p.periodo === emAndamento || p.valor <= 0 ? null : statusVsMedia(p.valor, media))) };
}

/** Mês atual (AAAA-MM), para marcar o mês em andamento nos gráficos mensais. */
export const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

/** Texto do status para o tooltip do gráfico ("✓ Bom: 12% abaixo da média"). */
export const textoStatus = (s: Status | null | undefined, semStatus = '') => (s ? `${infoNivel(s.nivel).icone} ${infoNivel(s.nivel).nome}: ${s.motivo}` : semStatus);
