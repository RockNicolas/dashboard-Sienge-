// Comparativos semanal / mensal / anual — funções puras sobre os dados já salvos (não chamam o Sienge).
// O período atual é a semana/mês/ano que contém a data de referência. Se ele ainda está em andamento,
// o anterior e o do ano passado são cortados no mesmo ponto (1–10/nov × 1–10/out), para a comparação ser justa.
import { fatia, partes } from './financeiro-analytics.service';
import type {
  Compra, ComparativoResponse, ContaPagar, ContaReceber, Dados, DadosFinanceiros, FornecedorComparado,
  GrupoComparativo, JanelaSync, MaterialComparado, Metrica, ObraComparada, PeriodoComparado, PontoComparativo, ResumoAnterior,
} from '../types';

const r2 = (n: number) => Math.round(n * 100) / 100;
const dt = (s: string) => new Date(s + 'T00:00:00Z');
const iso = (d: Date) => d.toISOString().slice(0, 10);
const somarDias = (s: string, n: number) => iso(new Date(dt(s).getTime() + n * 864e5));
const diasEntre = (de: string, ate: string) => Math.round((dt(ate).getTime() - dt(de).getTime()) / 864e5);
const menor = (a: string, b: string) => (a < b ? a : b);

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

/** Primeiro dia do período que contém a data (semana começa na segunda-feira). */
export function inicioPeriodo(data: string, g: GrupoComparativo): string {
  if (g === 'ano') return `${data.slice(0, 4)}-01-01`;
  if (g === 'mes') return `${data.slice(0, 7)}-01`;
  return somarDias(data, -((dt(data).getUTCDay() + 6) % 7));
}

/** Último dia do período que começa em `de`. */
export function fimPeriodo(de: string, g: GrupoComparativo): string {
  if (g === 'ano') return `${de.slice(0, 4)}-12-31`;
  if (g === 'semana') return somarDias(de, 6);
  const d = dt(de);
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

/** Início do período `n` períodos antes (n negativo = depois). */
export function deslocar(de: string, g: GrupoComparativo, n: number): string {
  if (g === 'semana') return somarDias(de, -7 * n);
  const d = dt(de);
  return g === 'ano'
    ? `${d.getUTCFullYear() - n}-01-01`
    : iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1)));
}

/** Mesmo período do ano anterior: semana 52 semanas antes (mantém a segunda-feira); mês 12 meses antes. */
const anoAntes = (de: string, g: GrupoComparativo) => (g === 'semana' ? somarDias(de, -364) : deslocar(de, 'mes', 12));

export function chavePeriodo(de: string, g: GrupoComparativo): string {
  return g === 'ano' ? de.slice(0, 4) : g === 'mes' ? de.slice(0, 7) : de;
}

/** "nov/26", "2026", "03/11 a 09/11/26"; cortado no meio: "nov/26 (até 10/11)". */
export function rotulo(de: string, ate: string, g: GrupoComparativo): string {
  const inteiro = ate === fimPeriodo(de, g);
  if (g === 'semana') return `${ddmm(de)} a ${ddmm(ate)}/${ate.slice(2, 4)}`;
  const base = g === 'ano' ? de.slice(0, 4) : `${MESES[Number(de.slice(5, 7)) - 1]}/${de.slice(2, 4)}`;
  return inteiro ? base : `${base} (até ${ddmm(ate)})`;
}

export interface Cobertura { compras: JanelaSync | null; financeiro: JanelaSync | null }

function periodoComparado(de: string, ate: string, g: GrupoComparativo, cob: Cobertura): PeriodoComparado {
  // só o começo importa: o período atual vai até hoje, que pode passar da data da última sincronização
  // pelas compras: o financeiro pode ter "sincronizado" sem trazer nada (ex.: usuário de API sem permissão)
  return { de, ate, rotulo: rotulo(de, ate, g), semDados: !cob.compras || de < cob.compras.de };
}

const dentro = (data: string, p: { de: string; ate: string }) => data >= p.de && data <= p.ate;

function totaisCompras(l: Compra[]) {
  const comprado = l.reduce((s, c) => s + c.valor, 0);
  const pedidos = new Set(l.map(c => c.pedido)).size;
  return {
    comprado: r2(comprado), pedidos, ticketMedio: pedidos ? r2(comprado / pedidos) : 0, itens: l.length,
    fornecedores: new Set(l.map(c => c.fornecedorId)).size, materiais: new Set(l.map(c => c.insumoId)).size,
  };
}

function totaisResultado(pagar: ContaPagar[], receber: ContaReceber[], obraId?: string) {
  const s = <T extends { obras: ContaPagar['obras'] }>(l: T[], v: (x: T) => number) => r2(l.reduce((a, x) => a + v(x) * fatia(x.obras, obraId), 0));
  const receitas = s(receber, p => p.valor);
  const despesas = s(pagar, p => p.valor);
  return { receitas, despesas, resultado: r2(receitas - despesas), recebido: s(receber, p => p.recebido), pago: s(pagar, p => p.pago) };
}

function metricas<K extends string>(chaves: K[], a: Record<K, number>, b: Record<K, number>, c: Record<K, number> | null) {
  return Object.fromEntries(chaves.map(k => [k, { atual: a[k], anterior: b[k], anoAnterior: c ? c[k] : null } satisfies Metrica])) as Record<K, Metrica>;
}

function porFornecedor(atual: Compra[], anterior: Compra[]): FornecedorComparado[] {
  const m = new Map<string, FornecedorComparado>();
  const linha = (c: Compra) => {
    let l = m.get(c.fornecedorId);
    if (!l) m.set(c.fornecedorId, l = { id: c.fornecedorId, nome: c.fornecedor, atual: 0, anterior: 0, diferenca: 0 });
    return l;
  };
  for (const c of atual) linha(c).atual += c.valor;
  for (const c of anterior) linha(c).anterior += c.valor;
  return [...m.values()]
    .map(l => ({ ...l, atual: r2(l.atual), anterior: r2(l.anterior), diferenca: r2(l.atual - l.anterior) }))
    .sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca));
}

function porMaterial(atual: Compra[], anterior: Compra[]): MaterialComparado[] {
  const m = new Map<string, { insumo: string; un: string; q: [number, number]; v: [number, number] }>();
  const somar = (l: Compra[], i: 0 | 1) => {
    for (const c of l) {
      let x = m.get(c.insumoId);
      if (!x) m.set(c.insumoId, x = { insumo: c.insumo, un: c.un, q: [0, 0], v: [0, 0] });
      x.q[i] += c.qtd; x.v[i] += c.valor;
    }
  };
  somar(atual, 0); somar(anterior, 1);
  return [...m].map(([insumoId, x]): MaterialComparado => {
    const precoAtual = x.q[0] > 0 ? r2(x.v[0] / x.q[0]) : null;
    const precoAnterior = x.q[1] > 0 ? r2(x.v[1] / x.q[1]) : null;
    return {
      insumoId, insumo: x.insumo, un: x.un,
      qtdAtual: r2(x.q[0]), qtdAnterior: r2(x.q[1]), precoAtual, precoAnterior,
      valorAtual: r2(x.v[0]), valorAnterior: r2(x.v[1]),
      impactoPreco: precoAtual != null && precoAnterior != null ? r2((precoAtual - precoAnterior) * x.q[0]) : null,
    };
  }).sort((a, b) => Math.abs(b.impactoPreco ?? 0) - Math.abs(a.impactoPreco ?? 0) || b.valorAtual - a.valorAtual);
}

function porObra(
  comprasAtual: Compra[], comprasAnterior: Compra[],
  fin: { pagar: [ContaPagar[], ContaPagar[]]; receber: [ContaReceber[], ContaReceber[]] }, obraId?: string,
): ObraComparada[] {
  const m = new Map<string, ObraComparada>();
  const linha = (id: string, nome: string) => {
    let l = m.get(id);
    if (!l) m.set(id, l = {
      obraId: id, obra: nome || 'Sem obra', compradoAtual: 0, compradoAnterior: 0,
      receitasAtual: 0, receitasAnterior: 0, despesasAtual: 0, despesasAnterior: 0,
    });
    return l;
  };
  for (const c of comprasAtual) linha(c.obraId, c.obra).compradoAtual += c.valor;
  for (const c of comprasAnterior) linha(c.obraId, c.obra).compradoAnterior += c.valor;
  const distribuir = <T extends ContaPagar | ContaReceber>(l: T[], campo: 'receitasAtual' | 'receitasAnterior' | 'despesasAtual' | 'despesasAnterior') => {
    for (const p of l) for (const o of partes(p.obras)) if (!obraId || o.id === obraId) linha(o.id, o.nome)[campo] += p.valor * o.f;
  };
  distribuir(fin.receber[0], 'receitasAtual'); distribuir(fin.receber[1], 'receitasAnterior');
  distribuir(fin.pagar[0], 'despesasAtual'); distribuir(fin.pagar[1], 'despesasAnterior');
  return [...m.values()].map(l => ({
    ...l, compradoAtual: r2(l.compradoAtual), compradoAnterior: r2(l.compradoAnterior),
    receitasAtual: r2(l.receitasAtual), receitasAnterior: r2(l.receitasAnterior),
    despesasAtual: r2(l.despesasAtual), despesasAnterior: r2(l.despesasAnterior),
  })).sort((a, b) => b.compradoAtual + b.despesasAtual + b.receitasAtual - (a.compradoAtual + a.despesasAtual + a.receitasAtual));
}

/** Quantos períodos aparecem no gráfico de evolução. */
const NA_SERIE: Record<GrupoComparativo, number> = { semana: 12, mes: 12, ano: 5 };

export interface OpcoesComparativo { agrupar: GrupoComparativo; ref: string; hoje: string; obraId?: string; cobertura: Cobertura }

export const ComparativoService = {
  calcular(dados: Dados, fin: DadosFinanceiros, o: OpcoesComparativo): Omit<ComparativoResponse, 'mock'> {
    const g = o.agrupar;
    const ref = menor(o.ref, o.hoje);
    const daObra = (c: Compra) => !o.obraId || c.obraId === o.obraId;
    const compras = dados.compras.filter(daObra);
    const pagar = fin.pagar.filter(p => fatia(p.obras, o.obraId) > 0);
    const receber = fin.receber.filter(p => fatia(p.obras, o.obraId) > 0);

    // períodos: atual (até hoje se em andamento), anterior e mesmo período do ano passado, cortados no mesmo ponto
    const deA = inicioPeriodo(ref, g);
    const fimA = fimPeriodo(deA, g);
    const parcial = fimA > o.hoje;
    const ateA = parcial ? o.hoje : fimA;
    const corte = (de: string) => (parcial ? menor(somarDias(de, diasEntre(deA, ateA)), fimPeriodo(de, g)) : fimPeriodo(de, g));
    const deP = deslocar(deA, g, 1);
    const deY = g === 'ano' ? null : anoAntes(deA, g);
    const atual = periodoComparado(deA, ateA, g, o.cobertura);
    const anterior = periodoComparado(deP, corte(deP), g, o.cobertura);
    const anoAnterior = deY ? periodoComparado(deY, corte(deY), g, o.cobertura) : null;

    const naJanela = <T>(l: T[], data: (x: T) => string, p: { de: string; ate: string }) => l.filter(x => dentro(data(x), p));
    const cA = naJanela(compras, c => c.data, atual);
    const cP = naJanela(compras, c => c.data, anterior);
    const cY = anoAnterior ? naJanela(compras, c => c.data, anoAnterior) : null;
    const venc = (p: { vencimento: string }) => p.vencimento;
    const fA = totaisResultado(naJanela(pagar, venc, atual), naJanela(receber, venc, atual), o.obraId);
    const fP = totaisResultado(naJanela(pagar, venc, anterior), naJanela(receber, venc, anterior), o.obraId);
    const fY = anoAnterior ? totaisResultado(naJanela(pagar, venc, anoAnterior), naJanela(receber, venc, anoAnterior), o.obraId) : null;

    // evolução: últimos N períodos inteiros (o atual até hoje), com o mesmo período do ano anterior.
    // Períodos de antes do começo dos dados sincronizados ficam de fora (apareceriam zerados, como se não tivesse havido compra).
    const inicioDados = o.cobertura.compras?.de ?? o.cobertura.financeiro?.de ?? null;
    const antesDosDados = (de: string) => !!inicioDados && de < inicioDados;
    const serie: PontoComparativo[] = [];
    for (let i = NA_SERIE[g] - 1; i >= 0; i--) {
      const de = deslocar(deA, g, i);
      if (i > 0 && antesDosDados(de)) continue;
      const p = { de, ate: menor(fimPeriodo(de, g), o.hoje) };
      const ano = g === 'ano' ? null : (() => { const d = anoAntes(de, g); return { de: d, ate: menor(fimPeriodo(d, g), somarDias(d, diasEntre(de, p.ate))) }; })();
      const soma = (l: Compra[]) => r2(l.reduce((s, c) => s + c.valor, 0));
      const r = totaisResultado(naJanela(pagar, venc, p), naJanela(receber, venc, p), o.obraId);
      serie.push({
        periodo: chavePeriodo(de, g), rotulo: rotulo(de, fimPeriodo(de, g), g),
        comprado: soma(naJanela(compras, c => c.data, p)),
        compradoAnoAnterior: ano && !antesDosDados(ano.de) ? soma(naJanela(compras, c => c.data, ano)) : null,
        receitas: r.receitas, despesas: r.despesas,
      });
    }

    const avisos: string[] = [];
    const semDados = [anterior, anoAnterior].filter((p): p is PeriodoComparado => !!p && p.semDados);
    if (atual.semDados) avisos.push(`O período ${atual.rotulo} não foi sincronizado do Sienge: os números podem estar incompletos.`);
    if (semDados.length) {
      avisos.push(`Sem dados sincronizados para ${semDados.map(p => p.rotulo).join(' e ')}: a comparação com ${semDados.length > 1 ? 'esses períodos' : 'esse período'} `
        + 'aparece zerada. Para comparar, amplie o período em Configurações → O que puxar do Sienge.');
    }

    const chavesCompras = ['comprado', 'pedidos', 'ticketMedio', 'itens', 'fornecedores', 'materiais'] as const;
    const chavesResultado = ['receitas', 'despesas', 'resultado', 'recebido', 'pago'] as const;
    return {
      agrupar: g, ref, parcial,
      periodos: { atual, anterior, anoAnterior },
      compras: metricas([...chavesCompras], totaisCompras(cA), totaisCompras(cP), cY ? totaisCompras(cY) : null),
      resultado: metricas([...chavesResultado], fA, fP, fY),
      serie,
      fornecedores: porFornecedor(cA, cP).slice(0, 30),
      materiais: porMaterial(cA, cP).slice(0, 50),
      obras: porObra(cA, cP, {
        pagar: [naJanela(pagar, venc, atual), naJanela(pagar, venc, anterior)],
        receber: [naJanela(receber, venc, atual), naJanela(receber, venc, anterior)],
      }, o.obraId),
      avisos,
    };
  },

  /** Período de mesmo tamanho logo antes de [de, ate] (para as setas ▲▼ dos cards da Visão geral). */
  periodoAnterior(de: string, ate: string): { de: string; ate: string } {
    return { de: somarDias(de, -(diasEntre(de, ate) + 1)), ate: somarDias(de, -1) };
  },

  /** Totais de compras do período anterior ao filtro (cards da Visão geral). */
  resumoAnterior(dados: Dados, p: { de: string; ate: string }, obraId: string | undefined, cobertura: JanelaSync | null): ResumoAnterior {
    const l = dados.compras.filter(c => dentro(c.data, p) && (!obraId || c.obraId === obraId));
    const t = totaisCompras(l);
    return {
      ...p, comprado: t.comprado, pedidos: t.pedidos, ticketMedio: t.ticketMedio,
      fornecedores: t.fornecedores, insumos: t.materiais, obrasComCompra: new Set(l.map(c => c.obraId).filter(Boolean)).size,
      semDados: !cobertura || p.de < cobertura.de,
    };
  },
};
