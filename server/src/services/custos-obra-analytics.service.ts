// Custos por obra a partir dos Insumos da Obra do Sienge — funções puras.
// Orçado (itens do orçamento) × pendente (saldos de pedidos e contratos) × atendido (NFs de compra e medições),
// abertos por tipo de insumo, por serviço (item do orçamento na EDT) e por insumo.
import type {
  ApropriacaoInsumo, CustoCategoria, CustoInsumo, CustoObra, CustoServico, Filtros, InsumoObra, TotaisCusto,
} from '../types';

const r2 = (n: number) => Math.round(n * 100) / 100;
const soma = <T>(l: T[], f: (x: T) => number) => l.reduce((a, x) => a + f(x), 0);

/** Tipos de insumo do Sienge (campo `category`), com os nomes usados no Sienge. */
export const CATEGORIAS: Record<string, string> = {
  MATERIAL: 'Material',
  LABOR: 'Mão de obra',
  EQUIPMENT: 'Equipamento',
  OTHER: 'Outros',
  OFFICE_SUPPLY: 'Material de escritório',
  FUELS_AND_LUBRICANTS: 'Combustíveis e lubrificantes',
  MAINTENANCE_MATERIAL: 'Material de manutenção',
};
export const nomeCategoria = (c: string) => CATEGORIAS[c] ?? (c || 'Sem tipo');

interface Acumulado { orcado: number; pendente: number; atendido: number; atendidoPeriodo: number }
const zero = (): Acumulado => ({ orcado: 0, pendente: 0, atendido: 0, atendidoPeriodo: 0 });

const fechar = (a: Acumulado): TotaisCusto => ({
  orcado: r2(a.orcado), pendente: r2(a.pendente), atendido: r2(a.atendido), atendidoPeriodo: r2(a.atendidoPeriodo),
  saldo: r2(a.orcado - a.atendido - a.pendente),
});

const peso = (t: TotaisCusto) => t.atendido + t.pendente || t.orcado;

function agrupar<T>(l: T[], k: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of l) { const c = k(x); const g = m.get(c); if (g) g.push(x); else m.set(c, [x]); }
  return m;
}

export const CustosObraAnalytics = {
  custos(insumos: InsumoObra[], { from, to }: Filtros, atualizados = new Map<string, string>()): CustoObra[] {
    const noPeriodo = (a: ApropriacaoInsumo) => a.data >= from && a.data <= to;
    const somar = (acc: Acumulado, i: InsumoObra) => {
      acc.orcado += soma(i.orcamento, o => o.valor);
      acc.pendente += soma(i.pendentes, a => a.valor);
      acc.atendido += soma(i.atendidas, a => a.valor);
      acc.atendidoPeriodo += soma(i.atendidas.filter(noPeriodo), a => a.valor);
      return acc;
    };

    return [...agrupar(insumos, i => i.obraId)].map(([obraId, l]): CustoObra => {
      const categorias: CustoCategoria[] = [...agrupar(l, i => i.categoria)]
        .map(([categoria, g]) => ({ categoria, nome: nomeCategoria(categoria), ...fechar(g.reduce(somar, zero())) }))
        .sort((a, b) => peso(b) - peso(a));

      // serviço = item do orçamento (código na EDT); apropriação sem item fica em "Sem item de orçamento"
      const servicos = new Map<string, { servico: string; acc: Acumulado }>();
      const servico = (edt: string, nome: string) => {
        let s = servicos.get(edt);
        if (!s) servicos.set(edt, s = { servico: nome || (edt ? edt : 'Sem item de orçamento'), acc: zero() });
        else if (!s.servico && nome) s.servico = nome;
        return s.acc;
      };
      for (const i of l) {
        for (const o of i.orcamento) servico(o.edt, o.servico).orcado += o.valor;
        for (const a of i.pendentes) servico(a.edt, a.servico).pendente += a.valor;
        for (const a of i.atendidas) {
          const acc = servico(a.edt, a.servico);
          acc.atendido += a.valor;
          if (noPeriodo(a)) acc.atendidoPeriodo += a.valor;
        }
      }
      const listaServicos: CustoServico[] = [...servicos]
        .map(([edt, s]) => ({ edt, servico: s.servico, ...fechar(s.acc) }))
        .sort((a, b) => peso(b) - peso(a) || a.edt.localeCompare(b.edt));

      const listaInsumos: CustoInsumo[] = [...agrupar(l, i => i.insumoId)].map(([insumoId, g]) => ({
        insumoId, insumo: g[0].insumo, un: g[0].un, categoria: g[0].categoria,
        qtdOrcada: r2(soma(g, i => soma(i.orcamento, o => o.qtd))),
        qtdPendente: r2(soma(g, i => soma(i.pendentes, a => a.qtd))),
        qtdAtendida: r2(soma(g, i => soma(i.atendidas, a => a.qtd))),
        ...fechar(g.reduce(somar, zero())),
      })).sort((a, b) => peso(b) - peso(a));

      return {
        obraId, obra: l[0].obra || `Obra ${obraId}`,
        ...fechar(l.reduce(somar, zero())),
        categorias, servicos: listaServicos, insumos: listaInsumos,
        atualizado: atualizados.get(obraId) ?? null,
      };
    }).sort((a, b) => peso(b) - peso(a));
  },
};
