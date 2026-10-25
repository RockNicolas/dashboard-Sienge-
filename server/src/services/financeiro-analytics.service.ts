// Cálculos do módulo financeiro — funções puras sobre os dados normalizados.
// Filtro de obra: cada lançamento entra proporcional ao rateio da obra (ex.: título 60% obra A / 40% obra B).
import type {
  Agrupamento, ContaPagar, ContaReceber, DadosFinanceiros, FinanceiroData, FinanceiroObra, FiltrosFinanceiro,
  MovimentoBancario, ParcelaResumo, PontoFinanceiro, Rateio, TotalParceiro, TotalPlano,
} from '../types';

const r2 = (n: number) => Math.round(n * 100) / 100;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const SEM_OBRA = { id: '', nome: 'Sem obra' };

/** Parte do lançamento que pertence à obra (0–1). Sem filtro = 1. */
export function fatia(obras: Rateio[], obraId?: string): number {
  if (!obraId) return 1;
  const o = obras.filter(x => x.id === obraId);
  if (!o.length) return 0;
  const pct = o.reduce((s, x) => s + x.pct, 0);
  return pct > 0 ? pct / 100 : obras.length === 1 ? 1 : 0;
}

/** Distribui o lançamento entre as obras do rateio (sem rateio = "Sem obra"). */
function partes(obras: Rateio[]): { id: string; nome: string; f: number }[] {
  if (!obras.length) return [{ ...SEM_OBRA, f: 1 }];
  const total = obras.reduce((s, x) => s + x.pct, 0);
  return obras.map(o => ({ id: o.id, nome: o.nome || `Obra ${o.id}`, f: total > 0 ? o.pct / 100 : 1 / obras.length }));
}

/** Chave do período: AAAA-MM (mês) ou a segunda-feira da semana (AAAA-MM-DD). */
export function periodo(data: string, agrupar: Agrupamento): string {
  if (agrupar === 'mes') return data.slice(0, 7);
  const d = new Date(data + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return iso(d);
}

/** Todos os períodos entre de e ate (inclusive), para o gráfico não pular meses/semanas vazios. */
export function periodos(de: string, ate: string, agrupar: Agrupamento): string[] {
  const out: string[] = [];
  const inicio = agrupar === 'mes' ? `${de.slice(0, 7)}-01` : periodo(de, agrupar);
  const d = new Date(inicio + 'T00:00:00Z');
  const fim = periodo(ate, agrupar);
  while (out.length < 400) { // trava de segurança (~7 anos de semanas)
    const k = periodo(iso(d), agrupar);
    if (k > fim) break;
    out.push(k);
    if (agrupar === 'mes') d.setUTCMonth(d.getUTCMonth() + 1); else d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

const vencida = (p: { saldo: number; vencimento: string }, hoje: string) => p.saldo > 0.005 && p.vencimento < hoje;

function parceiros<T extends ContaPagar | ContaReceber>(l: T[], nome: (x: T) => string, obraId: string | undefined, hoje: string): TotalParceiro[] {
  const m = new Map<string, TotalParceiro>();
  for (const p of l) {
    const f = fatia(p.obras, obraId);
    const k = nome(p) || '—';
    const t = m.get(k) ?? { nome: k, total: 0, aberto: 0, vencido: 0, parcelas: 0 };
    t.total += p.valor * f; t.aberto += p.saldo * f; t.parcelas++;
    if (vencida(p, hoje)) t.vencido += p.saldo * f;
    m.set(k, t);
  }
  return [...m.values()].map(t => ({ ...t, total: r2(t.total), aberto: r2(t.aberto), vencido: r2(t.vencido) }))
    .sort((a, b) => b.aberto - a.aberto || b.total - a.total).slice(0, 10);
}

function planos(movs: MovimentoBancario[], obraId?: string): TotalPlano[] {
  const m = new Map<string, TotalPlano>();
  for (const mv of movs) {
    const f = fatia(mv.obras, obraId);
    const ps = mv.planos.length ? mv.planos : [{ id: '', nome: 'Sem plano financeiro', pct: 100 }];
    const total = ps.reduce((s, x) => s + x.pct, 0);
    for (const p of ps) {
      const v = mv.valor * f * (total > 0 ? p.pct / total : 1 / ps.length);
      const t = m.get(p.nome) ?? { plano: p.nome || p.id, entradas: 0, saidas: 0 };
      if (v >= 0) t.entradas += v; else t.saidas -= v;
      m.set(p.nome, t);
    }
  }
  return [...m.values()].map(t => ({ ...t, entradas: r2(t.entradas), saidas: r2(t.saidas) }))
    .sort((a, b) => b.saidas + b.entradas - (a.saidas + a.entradas)).slice(0, 12);
}

function resumoParcela(tipo: ParcelaResumo['tipo'], p: ContaPagar | ContaReceber, f: number): ParcelaResumo {
  return {
    tipo, parceiro: 'credor' in p ? p.credor : p.cliente, documento: p.documento,
    obra: p.obras.map(o => o.nome).filter(Boolean).join(', ') || '—',
    vencimento: p.vencimento, valor: r2(p.valor * f), saldo: r2(p.saldo * f), situacao: p.situacao,
  };
}

export const FinanceiroAnalytics = {
  dashboard(d: DadosFinanceiros, { from, to, obraId, agrupar }: FiltrosFinanceiro, hoje = iso(new Date())): FinanceiroData {
    const noPeriodo = (data: string) => data >= from && data <= to;
    const daObra = <T extends { obras: Rateio[] }>(x: T) => fatia(x.obras, obraId) > 0;
    const pagar = d.pagar.filter(p => noPeriodo(p.vencimento) && daObra(p));
    const receber = d.receber.filter(p => noPeriodo(p.vencimento) && daObra(p));
    const movs = d.movimentos.filter(m => noPeriodo(m.data) && daObra(m));
    const f = (x: { obras: Rateio[] }) => fatia(x.obras, obraId);

    // série por mês/semana
    const ks = periodos(from, to, agrupar);
    const serie = new Map<string, PontoFinanceiro>(ks.map(k => [k, {
      periodo: k, aPagar: 0, pago: 0, aReceber: 0, recebido: 0, entradas: 0, saidas: 0, saldoAcumulado: 0,
    }]));
    const ponto = (data: string) => serie.get(periodo(data, agrupar));
    for (const p of pagar) { const s = ponto(p.vencimento); if (s) { s.aPagar += p.valor * f(p); s.pago += p.pago * f(p); } }
    for (const p of receber) { const s = ponto(p.vencimento); if (s) { s.aReceber += p.valor * f(p); s.recebido += p.recebido * f(p); } }
    for (const m of movs) {
      const s = ponto(m.data);
      if (!s) continue;
      const v = m.valor * f(m);
      if (v >= 0) s.entradas += v; else s.saidas -= v;
    }
    let acum = 0;
    const pontos = [...serie.values()].map(s => {
      acum += s.entradas - s.saidas;
      return {
        periodo: s.periodo, aPagar: r2(s.aPagar), pago: r2(s.pago), aReceber: r2(s.aReceber), recebido: r2(s.recebido),
        entradas: r2(s.entradas), saidas: r2(s.saidas), saldoAcumulado: r2(acum),
      };
    });

    // geral: totais do período
    const soma = <T>(l: T[], fn: (x: T) => number) => r2(l.reduce((a, x) => a + fn(x), 0));
    const entradas = soma(movs, m => Math.max(0, m.valor) * f(m));
    const saidas = soma(movs, m => Math.max(0, -m.valor) * f(m));

    // por obra (todas as obras, mesmo com filtro de período)
    const obras = new Map<string, FinanceiroObra>();
    const linha = (o: { id: string; nome: string }) => {
      let l = obras.get(o.id);
      if (!l) obras.set(o.id, l = {
        obraId: o.id, obra: o.nome, aPagar: 0, pagarAberto: 0, pagarVencido: 0,
        aReceber: 0, receberAberto: 0, receberVencido: 0, entradas: 0, saidas: 0, resultado: 0,
      });
      return l;
    };
    for (const p of pagar) for (const o of partes(p.obras)) {
      const l = linha(o);
      l.aPagar += p.valor * o.f; l.pagarAberto += p.saldo * o.f;
      if (vencida(p, hoje)) l.pagarVencido += p.saldo * o.f;
    }
    for (const p of receber) for (const o of partes(p.obras)) {
      const l = linha(o);
      l.aReceber += p.valor * o.f; l.receberAberto += p.saldo * o.f;
      if (vencida(p, hoje)) l.receberVencido += p.saldo * o.f;
    }
    for (const m of movs) for (const o of partes(m.obras)) {
      const l = linha(o);
      if (m.valor >= 0) l.entradas += m.valor * o.f; else l.saidas -= m.valor * o.f;
    }
    const porObra = [...obras.values()]
      .filter(l => !obraId || l.obraId === obraId)
      .map(l => ({
        ...l, aPagar: r2(l.aPagar), pagarAberto: r2(l.pagarAberto), pagarVencido: r2(l.pagarVencido),
        aReceber: r2(l.aReceber), receberAberto: r2(l.receberAberto), receberVencido: r2(l.receberVencido),
        entradas: r2(l.entradas), saidas: r2(l.saidas), resultado: r2(l.entradas - l.saidas),
      }))
      .sort((a, b) => b.aPagar + b.aReceber - (a.aPagar + a.aReceber));

    // parcelas em destaque: vencidas (do período) e próximos 30 dias (independe do período)
    const em30 = iso(new Date(Date.parse(hoje + 'T00:00:00Z') + 30 * 864e5));
    const todas = [
      ...d.pagar.filter(daObra).map(p => ({ tipo: 'pagar' as const, p })),
      ...d.receber.filter(daObra).map(p => ({ tipo: 'receber' as const, p })),
    ];
    const vencidas = todas.filter(({ p }) => noPeriodo(p.vencimento) && vencida(p, hoje))
      .map(({ tipo, p }) => resumoParcela(tipo, { ...p, situacao: 'vencida' }, f(p)))
      .sort((a, b) => b.saldo - a.saldo).slice(0, 15);
    const proximos = todas.filter(({ p }) => p.saldo > 0.005 && p.vencimento >= hoje && p.vencimento <= em30)
      .map(({ tipo, p }) => resumoParcela(tipo, p, f(p)))
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 20);

    const contas = new Map(d.contas.map(c => [c.conta, c]));
    const saldos = d.saldos.map(s => ({
      ...s, nome: contas.get(s.conta)?.nome ?? s.conta, banco: contas.get(s.conta)?.banco ?? '', empresa: contas.get(s.conta)?.empresa ?? '',
    })).sort((a, b) => b.saldo - a.saldo);

    return {
      resumo: {
        aPagar: soma(pagar, p => p.valor * f(p)), pago: soma(pagar, p => p.pago * f(p)),
        pagarAberto: soma(pagar, p => p.saldo * f(p)), pagarVencido: soma(pagar.filter(p => vencida(p, hoje)), p => p.saldo * f(p)),
        parcelasPagar: pagar.length,
        aReceber: soma(receber, p => p.valor * f(p)), recebido: soma(receber, p => p.recebido * f(p)),
        receberAberto: soma(receber, p => p.saldo * f(p)), receberVencido: soma(receber.filter(p => vencida(p, hoje)), p => p.saldo * f(p)),
        parcelasReceber: receber.length,
        entradas, saidas, resultadoCaixa: r2(entradas - saidas),
        saldoBancos: obraId ? null : soma(d.saldos, s => s.saldo),
      },
      serie: pontos,
      porObra,
      credores: parceiros(pagar, p => p.credor, obraId, hoje),
      clientes: parceiros(receber, p => p.cliente, obraId, hoje),
      planos: planos(movs, obraId),
      vencidas,
      proximos,
      saldos,
      movimentos: [...movs].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 30),
    };
  },
};
