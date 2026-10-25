// Cálculos do painel — funções puras sobre os dados normalizados.
import type {
  Compra, Consumo, Dados, DashboardData, Filtros, PontoMensal, Resumo, ConsumoMaterial,
  RankingFornecedor, ConsumoObra, ItemABC, CompradoVsConsumido, VariacaoPreco,
} from '../types';

const soma = <T>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + f(x), 0);
const r2 = (n: number) => Math.round(n * 100) / 100;
const mes = (d: string) => d.slice(0, 7);

function agrupar<T>(arr: T[], chave: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of arr) {
    const k = chave(x);
    const l = m.get(k);
    if (l) l.push(x); else m.set(k, [x]);
  }
  return m;
}

function filtrar(d: Dados, { from, to, obraId }: Filtros): Dados {
  const dentro = (x: { data: string }) => x.data >= from && x.data <= to;
  return {
    obras: d.obras,
    compras: d.compras.filter(dentro),
    consumos: d.consumos.filter(c => dentro(c) && (!obraId || c.obraId === obraId)),
  };
}

function serieMensal(arr: { data: string; valor: number }[]): PontoMensal[] {
  const m = new Map<string, number>();
  for (const x of arr) m.set(mes(x.data), (m.get(mes(x.data)) ?? 0) + x.valor);
  return [...m].sort().map(([k, v]) => ({ mes: k, valor: r2(v) }));
}

function resumo(compras: Compra[], consumos: Consumo[]): Resumo {
  const comprado = soma(compras, c => c.valor);
  const consumido = soma(consumos, c => c.valor);
  return {
    comprado: r2(comprado), consumido: r2(consumido), saldo: r2(comprado - consumido),
    pctConsumido: comprado ? r2((consumido / comprado) * 100) : 0,
    fornecedores: new Set(compras.map(c => c.fornecedorId)).size,
    insumos: new Set(compras.map(c => c.insumoId)).size,
    pedidos: new Set(compras.map(c => c.pedido)).size,
    obras: new Set(consumos.map(c => c.obraId)).size,
    compradoMensal: serieMensal(compras),
    consumidoMensal: serieMensal(consumos),
  };
}

// 1) Consumo de material
function consumoMaterial(consumos: Consumo[]): ConsumoMaterial[] {
  return [...agrupar(consumos, c => c.insumoId)].map(([insumoId, l]) => ({
    insumoId, insumo: l[0].insumo, un: l[0].un,
    qtd: r2(soma(l, x => x.qtd)), valor: r2(soma(l, x => x.valor)), mensal: serieMensal(l),
  })).sort((a, b) => b.valor - a.valor);
}

// 2) Ranking de fornecedores
function rankingFornecedores(compras: Compra[]): RankingFornecedor[] {
  const total = soma(compras, c => c.valor) || 1;
  return [...agrupar(compras, c => c.fornecedorId)].map(([fornecedorId, l]) => {
    const prazos = l.filter(x => x.prazoEntrega != null);
    return {
      fornecedorId, fornecedor: l[0].fornecedor,
      valor: r2(soma(l, x => x.valor)),
      participacao: r2((soma(l, x => x.valor) / total) * 100),
      pedidos: new Set(l.map(x => x.pedido)).size,
      itens: new Set(l.map(x => x.insumoId)).size,
      prazoMedio: prazos.length ? r2(soma(prazos, x => x.prazoEntrega ?? 0) / prazos.length) : null,
    };
  }).sort((a, b) => b.valor - a.valor);
}

// 3) Consumo por obra
function consumoObra(consumos: Consumo[]): ConsumoObra[] {
  const total = soma(consumos, c => c.valor) || 1;
  return [...agrupar(consumos, c => c.obraId)].map(([obraId, l]) => ({
    obraId, obra: l[0].obra,
    valor: r2(soma(l, x => x.valor)),
    participacao: r2((soma(l, x => x.valor) / total) * 100),
    mensal: serieMensal(l),
    topInsumos: [...agrupar(l, x => x.insumoId)]
      .map(([, g]) => ({ insumo: g[0].insumo, valor: r2(soma(g, x => x.valor)) }))
      .sort((a, b) => b.valor - a.valor).slice(0, 5),
  })).sort((a, b) => b.valor - a.valor);
}

// 4) Insumos que mais gastam — Curva ABC pelo valor comprado
function curvaABC(compras: Compra[]): ItemABC[] {
  const total = soma(compras, c => c.valor) || 1;
  let acum = 0;
  return [...agrupar(compras, c => c.insumoId)].map(([insumoId, l]) => ({
    insumoId, insumo: l[0].insumo, un: l[0].un,
    qtd: r2(soma(l, x => x.qtd)), valor: r2(soma(l, x => x.valor)),
  })).sort((a, b) => b.valor - a.valor).map(x => {
    acum += x.valor;
    const pct = (acum / total) * 100;
    return {
      ...x, participacao: r2((x.valor / total) * 100), acumulado: r2(pct),
      classe: (pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C') as ItemABC['classe'],
    };
  });
}

// 5) Comprado x consumido por insumo, aberto por obra
function compradoVsConsumido(compras: Compra[], consumos: Consumo[]): CompradoVsConsumido[] {
  const cons = agrupar(consumos, c => c.insumoId);
  return [...agrupar(compras, c => c.insumoId)].map(([insumoId, l]) => {
    const cl = cons.get(insumoId) ?? [];
    const qCompra = soma(l, x => x.qtd);
    const qCons = soma(cl, x => x.qtd);
    return {
      insumoId, insumo: l[0].insumo, un: l[0].un,
      comprado: r2(qCompra), consumido: r2(qCons), saldo: r2(qCompra - qCons),
      pctUso: qCompra ? r2((qCons / qCompra) * 100) : 0,
      valorComprado: r2(soma(l, x => x.valor)),
      porObra: [...agrupar(cl, x => x.obraId)].map(([obraId, g]) => ({
        obraId, obra: g[0].obra, qtd: r2(soma(g, x => x.qtd)), valor: r2(soma(g, x => x.valor)),
        pctDoComprado: qCompra ? r2((soma(g, x => x.qtd) / qCompra) * 100) : 0,
      })).sort((a, b) => b.qtd - a.qtd),
    };
  }).sort((a, b) => b.valorComprado - a.valorComprado);
}

// Extra: variação de preço unitário e economia potencial
function variacaoPreco(compras: Compra[]): VariacaoPreco[] {
  return [...agrupar(compras, c => c.insumoId)].map(([, l]) => {
    const ps = l.map(x => x.preco).filter(p => p > 0);
    const min = ps.length ? Math.min(...ps) : 0;
    const max = ps.length ? Math.max(...ps) : 0;
    const qtd = soma(l, x => x.qtd);
    return {
      insumo: l[0].insumo, un: l[0].un, min: r2(min), max: r2(max),
      medio: r2(qtd ? soma(l, x => x.valor) / qtd : 0),
      variacao: min ? r2(((max - min) / min) * 100) : 0,
      melhorFornecedor: l.find(x => x.preco === min)?.fornecedor,
      economiaPotencial: r2(soma(l, x => (x.preco > 0 ? (x.preco - min) * x.qtd : 0))),
    };
  }).sort((a, b) => b.economiaPotencial - a.economiaPotencial);
}

export const AnalyticsService = {
  dashboard(dados: Dados, filtros: Filtros): DashboardData {
    const { compras, consumos } = filtrar(dados, filtros);
    return {
      resumo: resumo(compras, consumos),
      consumoMaterial: consumoMaterial(consumos),
      fornecedores: rankingFornecedores(compras),
      obras: consumoObra(consumos),
      abc: curvaABC(compras),
      compradoVsConsumido: compradoVsConsumido(compras, consumos),
      variacaoPreco: variacaoPreco(compras),
    };
  },
};
