// Exportação do relatório de suprimentos para Excel: uma aba por seção (Tabelas do Excel com filtro em cada coluna)
// e, opcionalmente, uma aba "Dashboard" com indicadores e gráficos nativos do Excel ligados aos dados.
// Usa os mesmos cálculos das telas, então os números batem com o painel.
import ExcelJS from 'exceljs';
import type { Compra, CustosObraResponse, FinanceiroData, JanelaSync, Obra } from '../types';
import { DadosModel } from '../models/DadosModel';
import { AnalyticsService } from './analytics.service';
import { CustosObraService } from './custos-obra.service';
import { nomeCategoria } from './custos-obra-analytics.service';
import { inserirGraficos, PALETA, type Grafico } from './excel-graficos';
import { FinanceiroAnalytics } from './financeiro-analytics.service';
import { ConfigService } from './config.service';
import { SyncConfigService } from './sync-config.service';
import { SyncService } from './sync.service';

export const SECOES = ['geral', 'compras', 'fornecedores', 'custos', 'resultado'] as const;
export type Secao = (typeof SECOES)[number];

export interface OpcoesExportacao {
  from?: string; to?: string;     // vazio = padrão do painel (últimos 12 meses)
  obraId?: string;
  secoes: Secao[];
  graficos: boolean;              // aba Dashboard com gráficos nativos
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;
const dataBR = (s: string) => s.split('-').reverse().join('/');
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
const SITUACAO: Record<string, string> = {
  PENDING: 'Pendente', PARTIALLY_DELIVERED: 'Parcialmente entregue', FULLY_DELIVERED: 'Totalmente atendido', CANCELED: 'Cancelado',
};
/** Data AAAA-MM-DD como data do Excel (meia-noite UTC: não muda de dia com o fuso). */
const data = (s: string) => (s ? new Date(`${s}T00:00:00Z`) : null);

// formatos do Excel (o separador de milhar/decimal segue o idioma do Excel de quem abre)
const F_BRL = '"R$" #,##0.00';
const F_BRL0 = '"R$" #,##0';
const F_PCT = '0.0%';
const F_NUM = '#,##0.##';
const F_INT = '#,##0';
const F_DATA = 'dd/mm/yyyy';
/** Número do insumo no Sienge: vai como número (ordena e filtra certo; formato geral, sem separador de milhar). */
const codInsumo = (id: string) => (/^\d+$/.test(id) ? Number(id) : id);

const COR = { titulo: 'FF111827', texto: 'FF374151', suave: 'FF6B7280', fundo: 'FFF3F6FB', marca: 'FF2A78D6' };

/**
 * Período padrão igual ao das telas: o escolhido em Configurações (`janela`) ou os últimos 12 meses; compras até hoje,
 * financeiro até 2 meses à frente (vencimentos futuros).
 */
export function periodos(op: Pick<OpcoesExportacao, 'from' | 'to'>, hoje = new Date(), janela: JanelaSync | null = null) {
  const de = op.from || janela?.de || iso(new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1));
  return {
    compras: { from: de, to: op.to || janela?.ate || iso(hoje) },
    financeiro: { from: de, to: op.to || iso(new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() + 3, 0))) },
  };
}

interface Relatorio {
  periodo: { from: string; to: string };
  obra: Obra | null;
  mock: boolean;
  painel: ReturnType<typeof AnalyticsService.dashboard>;
  compras: Compra[];
  custos: CustosObraResponse | null;
  financeiro: FinanceiroData | null;
}

async function montar(op: OpcoesExportacao): Promise<Relatorio> {
  const p = periodos(op, new Date(), ConfigService.mock() ? null : SyncConfigService.janela());
  const { dados } = await SyncService.obterDados(p.compras.from, p.compras.to);
  const filtros = { ...p.compras, obraId: op.obraId };
  const quer = (s: Secao) => op.secoes.includes(s);
  const custos = quer('custos') || (op.graficos && quer('geral')) ? await CustosObraService.obter(filtros) : null;
  let financeiro: FinanceiroData | null = null;
  if (quer('resultado') || (op.graficos && quer('geral'))) {
    const fin = await SyncService.obterFinanceiro(p.financeiro.from, p.financeiro.to);
    financeiro = FinanceiroAnalytics.dashboard(fin.dados, { ...p.financeiro, obraId: op.obraId, agrupar: 'mes' });
  }
  const obras = [...dados.obras, ...DadosModel.obras()];
  return {
    periodo: p.compras,
    obra: op.obraId ? obras.find(o => o.id === op.obraId) ?? { id: op.obraId, nome: `Obra ${op.obraId}` } : null,
    mock: ConfigService.mock(),
    painel: AnalyticsService.dashboard(dados, filtros),
    compras: AnalyticsService.compras(dados, filtros),
    custos,
    financeiro,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// planilhas

interface Coluna { nome: string; largura?: number; formato?: string }

function cabecalho(ws: ExcelJS.Worksheet, titulo: string, info: string, colunas: number) {
  const ate = String.fromCharCode(64 + Math.max(2, Math.min(colunas, 26)));
  ws.mergeCells(`A1:${ate}1`);
  ws.mergeCells(`A2:${ate}2`);
  Object.assign(ws.getCell('A1'), { value: titulo, font: { name: 'Calibri', size: 15, bold: true, color: { argb: COR.titulo } } });
  Object.assign(ws.getCell('A2'), { value: info, font: { name: 'Calibri', size: 10, color: { argb: COR.suave } } });
  ws.getRow(1).height = 24;
}

let tabelas = 0;
/** Aba com título e uma Tabela do Excel (filtro em cada coluna, linhas zebradas, cabeçalho congelado). */
function aba(wb: ExcelJS.Workbook, nome: string, titulo: string, info: string, colunas: Coluna[], linhas: unknown[][], cor = COR.marca) {
  const ws = wb.addWorksheet(nome, {
    properties: { tabColor: { argb: cor } },
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  cabecalho(ws, titulo, info, colunas.length);
  const vazio = !linhas.length;
  ws.addTable({
    name: `Tabela${++tabelas}`,
    ref: 'A4',
    headerRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: colunas.map(c => ({ name: c.nome, filterButton: true })),
    rows: vazio ? [colunas.map((_, i) => (i === 0 ? 'Sem dados no período' : null))] : linhas,
  });
  colunas.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.largura ?? Math.max(12, Math.min(40, c.nome.length + 4));
    if (c.formato) col.eachCell({ includeEmpty: false }, (cel, lin) => { if (lin > 4) cel.numFmt = c.formato!; });
  });
  ws.getRow(4).height = 20;
  return ws;
}

/** Linha "Período · Obra · Gerado em" que vai no topo de cada aba. */
const linhaInfo = (r: Relatorio) =>
  `Período: ${dataBR(r.periodo.from)} a ${dataBR(r.periodo.to)} · Obra: ${r.obra?.nome ?? 'todas as obras'} · `
  + `Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · Fonte: ${r.mock ? 'dados de demonstração' : 'Sienge'}`;

function abasResumo(wb: ExcelJS.Workbook, r: Relatorio, info: string) {
  const s = r.painel.resumo;
  aba(wb, 'Resumo', 'Visão geral', info, [{ nome: 'Indicador', largura: 34 }, { nome: 'Valor', largura: 18 }], [
    ['Total comprado (R$)', s.comprado], ['Pedidos de compra', s.pedidos], ['Ticket médio por pedido (R$)', s.ticketMedio],
    ['Fornecedores', s.fornecedores], ['Materiais diferentes', s.insumos], ['Obras com compra', s.obrasComCompra],
  ]).getColumn(2).eachCell((c, lin) => { if (lin > 4) c.numFmt = lin === 5 || lin === 7 ? F_BRL : F_INT; });
  aba(wb, 'Compras por mês', 'Compras por mês (pedidos de compra)', info,
    [{ nome: 'Mês', largura: 12 }, { nome: 'Comprado', formato: F_BRL, largura: 18 }],
    r.painel.resumo.compradoMensal.map(m => [rotuloMes(m.mes), m.valor]));
}

function abasCompras(wb: ExcelJS.Workbook, r: Relatorio, info: string) {
  aba(wb, 'Itens de pedido', 'Histórico de compras — itens dos pedidos de compra', info, [
    { nome: 'Data', formato: F_DATA, largura: 11 }, { nome: 'Pedido', largura: 10 }, { nome: 'Item', largura: 7 },
    { nome: 'Situação', largura: 20 }, { nome: 'Autorizado', largura: 11 }, { nome: 'Entrega em atraso', largura: 12 },
    { nome: 'Obra', largura: 26 }, { nome: 'Fornecedor', largura: 32 }, { nome: 'Cód. insumo', largura: 11 }, { nome: 'Material', largura: 30 },
    { nome: 'Cód. auxiliar', largura: 12 }, { nome: 'Detalhe', largura: 16 }, { nome: 'Marca', largura: 14 }, { nome: 'Unidade', largura: 9 },
    { nome: 'Quantidade', formato: F_NUM, largura: 12 }, { nome: 'Preço unitário', formato: F_BRL, largura: 14 },
    { nome: 'Preço líquido', formato: F_BRL, largura: 14 }, { nome: 'Valor', formato: F_BRL, largura: 15 },
    { nome: 'Comprador', largura: 16 }, { nome: 'Condição de pagamento', largura: 18 },
  ], r.compras.map(c => [
    data(c.data), c.pedido, c.item || null, SITUACAO[c.situacao] ?? c.situacao, c.autorizado ? 'Sim' : 'Não', c.atrasado ? 'Sim' : 'Não',
    c.obra || 'Sem obra', c.fornecedor, codInsumo(c.insumoId), c.insumo, c.codigo, c.detalhe, c.marca, c.un, c.qtd, c.precoUnitario, c.preco, c.valor,
    c.comprador, c.condicaoPagamento,
  ]));
  aba(wb, 'Materiais', 'Histórico de compras — por material', info, [
    { nome: 'Cód. insumo', largura: 11 }, { nome: 'Material', largura: 32 }, { nome: 'Cód. auxiliar', largura: 12 },
    { nome: 'Unidade', largura: 9 }, { nome: 'Compras', formato: F_INT, largura: 10 },
    { nome: 'Pedidos', formato: F_INT, largura: 10 }, { nome: 'Fornecedores', formato: F_INT, largura: 12 },
    { nome: 'Quantidade', formato: F_NUM, largura: 12 }, { nome: 'Valor', formato: F_BRL, largura: 16 },
    { nome: 'Último preço', formato: F_BRL, largura: 14 }, { nome: 'Data do último', formato: F_DATA, largura: 13 },
    { nome: 'Último fornecedor', largura: 30 }, { nome: 'Menor preço', formato: F_BRL, largura: 13 },
    { nome: 'Preço médio', formato: F_BRL, largura: 13 }, { nome: 'Maior preço', formato: F_BRL, largura: 13 },
    { nome: 'Variação', formato: F_PCT, largura: 10 },
  ], r.painel.historico.map(m => [
    codInsumo(m.insumoId), m.insumo, m.codigo, m.un, m.compras, m.pedidos, m.fornecedores, m.qtd, m.valor, m.ultimoPreco, data(m.ultimaData), m.ultimoFornecedor,
    m.precoMin, m.precoMedio, m.precoMax, m.variacao / 100,
  ]));
}

function abaFornecedores(wb: ExcelJS.Workbook, r: Relatorio, info: string) {
  aba(wb, 'Fornecedores', 'Fornecedores — ranking e identificação', info, [
    { nome: 'Posição', formato: F_INT, largura: 9 }, { nome: 'Fornecedor', largura: 34 }, { nome: 'Nome fantasia', largura: 24 },
    { nome: 'CNPJ/CPF', largura: 20 }, { nome: 'Cidade', largura: 16 }, { nome: 'Telefone', largura: 16 }, { nome: 'E-mail', largura: 26 },
    { nome: 'Valor comprado', formato: F_BRL, largura: 16 }, { nome: 'Participação', formato: F_PCT, largura: 12 },
    { nome: 'Acumulado', formato: F_PCT, largura: 11 }, { nome: 'Classe ABC', largura: 10 }, { nome: 'Pedidos', formato: F_INT, largura: 9 },
    { nome: 'Ticket médio', formato: F_BRL, largura: 14 }, { nome: 'Materiais', formato: F_INT, largura: 10 },
    { nome: 'Obras', formato: F_INT, largura: 8 }, { nome: 'Pedidos em atraso', formato: F_INT, largura: 12 },
    { nome: 'Última compra', formato: F_DATA, largura: 13 }, { nome: 'Principais materiais', largura: 40 },
  ], r.painel.fornecedores.map((f, i) => [
    i + 1, f.fornecedor, f.cadastro?.fantasia ?? '', f.cadastro?.cnpj ?? '', f.cadastro?.cidade ?? '', f.cadastro?.telefone ?? '',
    f.cadastro?.email ?? '', f.valor, f.participacao / 100, f.acumulado / 100, f.classe, f.pedidos, f.ticketMedio, f.itens, f.obras,
    f.atrasados, data(f.ultimaCompra), f.topInsumos.map(t => t.insumo).join(', '),
  ]));
}

function abasCustos(wb: ExcelJS.Workbook, r: Relatorio, info: string) {
  aba(wb, 'Compras por obra', 'Material comprado por obra (pedidos de compra)', info, [
    { nome: 'Obra', largura: 30 }, { nome: 'Comprado', formato: F_BRL, largura: 16 }, { nome: 'Participação', formato: F_PCT, largura: 12 },
    { nome: 'Pedidos', formato: F_INT, largura: 9 }, { nome: 'Fornecedores', formato: F_INT, largura: 12 },
    { nome: 'Materiais', formato: F_INT, largura: 10 }, { nome: 'Principais materiais', largura: 44 },
  ], r.painel.comprasObra.map(o => [o.obra, o.valor, o.participacao / 100, o.pedidos, o.fornecedores, o.insumos,
    o.topInsumos.map(t => t.insumo).join(', ')]));
  const obras = r.custos?.obras ?? [];
  const custo = [
    { nome: 'Orçado', formato: F_BRL, largura: 16 }, { nome: 'Pendente', formato: F_BRL, largura: 16 },
    { nome: 'Atendido', formato: F_BRL, largura: 16 }, { nome: '% do orçado', formato: F_PCT, largura: 11 },
    { nome: 'Atendido no período', formato: F_BRL, largura: 16 }, { nome: 'Saldo', formato: F_BRL, largura: 16 },
  ];
  const valores = (t: { orcado: number; pendente: number; atendido: number; atendidoPeriodo: number; saldo: number }) =>
    [t.orcado, t.pendente, t.atendido, t.orcado ? t.atendido / t.orcado : null, t.atendidoPeriodo, t.saldo];
  aba(wb, 'Custos por obra', 'Orçado × pendente × atendido por obra (Insumos da Obra do Sienge)', info,
    [{ nome: 'Obra', largura: 30 }, ...custo], obras.map(o => [o.obra, ...valores(o)]), 'FF6250D6');
  aba(wb, 'Custos por tipo', 'Custos por obra e tipo de insumo', info,
    [{ nome: 'Obra', largura: 30 }, { nome: 'Tipo de insumo', largura: 22 }, ...custo],
    obras.flatMap(o => o.categorias.map(c => [o.obra, c.nome, ...valores(c)])), 'FF6250D6');
  aba(wb, 'Custos por serviço', 'Custos por obra e serviço (item do orçamento)', info,
    [{ nome: 'Obra', largura: 30 }, { nome: 'Item (EDT)', largura: 16 }, { nome: 'Serviço', largura: 40 }, ...custo],
    obras.flatMap(o => o.servicos.map(s => [o.obra, s.edt, s.servico, ...valores(s)])), 'FF6250D6');
  aba(wb, 'Custos por insumo', 'Custos por obra e insumo', info, [
    { nome: 'Obra', largura: 30 }, { nome: 'Cód. insumo', largura: 11 }, { nome: 'Insumo', largura: 32 }, { nome: 'Cód. auxiliar', largura: 12 },
    { nome: 'Tipo', largura: 16 }, { nome: 'Unidade', largura: 9 },
    { nome: 'Qtd. orçada', formato: F_NUM, largura: 12 }, { nome: 'Qtd. pendente', formato: F_NUM, largura: 12 },
    { nome: 'Qtd. atendida', formato: F_NUM, largura: 12 }, ...custo,
  ], obras.flatMap(o => o.insumos.map(i => [o.obra, codInsumo(i.insumoId), i.insumo, i.codigo, nomeCategoria(i.categoria), i.un, i.qtdOrcada, i.qtdPendente,
    i.qtdAtendida, ...valores(i)])), 'FF6250D6');
}

function abasResultado(wb: ExcelJS.Workbook, r: Relatorio, info: string) {
  const f = r.financeiro;
  aba(wb, 'Resultado por obra', 'Resultado da obra — receitas (contas a receber) − despesas (contas a pagar)', info, [
    { nome: 'Obra', largura: 30 }, { nome: 'Receitas', formato: F_BRL, largura: 16 }, { nome: 'Despesas', formato: F_BRL, largura: 16 },
    { nome: 'Resultado', formato: F_BRL, largura: 16 }, { nome: 'Margem', formato: F_PCT, largura: 10 },
    { nome: 'Recebido', formato: F_BRL, largura: 16 }, { nome: 'Pago', formato: F_BRL, largura: 16 },
    { nome: 'Resultado realizado', formato: F_BRL, largura: 17 }, { nome: 'A receber vencido', formato: F_BRL, largura: 16 },
    { nome: 'A pagar vencido', formato: F_BRL, largura: 16 },
  ], (f?.porObra ?? []).map(o => {
    const res = o.aReceber - o.aPagar;
    return [o.obra || 'Sem obra', o.aReceber, o.aPagar, r2(res), o.aReceber ? res / o.aReceber : null, o.recebido, o.pago,
      r2(o.recebido - o.pago), o.receberVencido, o.pagarVencido];
  }), 'FF1BAF7A');
  aba(wb, 'Despesas por plano', 'Despesas por obra e plano financeiro', info, [
    { nome: 'Obra', largura: 30 }, { nome: 'Plano financeiro', largura: 34 }, { nome: 'Valor', formato: F_BRL, largura: 16 },
    { nome: '% da obra', formato: F_PCT, largura: 11 },
  ], (f?.despesasObra ?? []).flatMap(o => o.planos.map(p => [o.obra || 'Sem obra', p.plano, p.valor, o.total ? p.valor / o.total : null])),
  'FF1BAF7A');
}

// ---------------------------------------------------------------------------------------------------------------
// dashboard: indicadores + gráficos nativos (dados na aba "Dados dos gráficos")

const ABA_DADOS = 'Dados dos gráficos';
const refAba = (col: string, de: number, ate: number) => `'${ABA_DADOS}'!$${col}$${de}:$${col}$${ate}`;

function dashboard(wb: ExcelJS.Workbook, r: Relatorio, info: string): { graficos: Grafico[]; blocos: Bloco[] } {
  const ws = wb.addWorksheet('Dashboard', {
    properties: { tabColor: { argb: 'FF111827' } },
    views: [{ showGridLines: false }],
    // o dashboard inteiro numa página A4 deitada (sem quebra cortando gráfico ao meio)
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1, horizontalCentered: true },
  });
  for (let c = 1; c <= 12; c++) ws.getColumn(c).width = 13;
  cabecalho(ws, 'Relatório de Suprimentos', info, 12);

  // indicadores: cada um ocupa 2 colunas (rótulo em cima, valor embaixo)
  const kpi = (lin: number, i: number, rotulo: string, valor: number, formato: string, cor: string) => {
    const c1 = String.fromCharCode(65 + i * 2);
    const c2 = String.fromCharCode(66 + i * 2);
    ws.mergeCells(`${c1}${lin}:${c2}${lin}`);
    ws.mergeCells(`${c1}${lin + 1}:${c2}${lin + 1}`);
    const rot = ws.getCell(`${c1}${lin}`);
    const val = ws.getCell(`${c1}${lin + 1}`);
    rot.value = rotulo;
    rot.font = { name: 'Calibri', size: 9, color: { argb: COR.suave } };
    val.value = valor;
    val.numFmt = formato;
    val.font = { name: 'Calibri', size: 16, bold: true, color: { argb: COR.titulo } };
    for (const cel of [rot, val]) {
      cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.fundo } };
      cel.border = { left: { style: 'thick', color: { argb: `FF${cor}` } } };
      cel.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    }
    ws.getRow(lin + 1).height = 26;
  };
  const s = r.painel.resumo;
  [['Total comprado', s.comprado, F_BRL0], ['Pedidos de compra', s.pedidos, F_INT], ['Ticket médio', s.ticketMedio, F_BRL0],
    ['Fornecedores', s.fornecedores, F_INT], ['Materiais diferentes', s.insumos, F_INT], ['Obras com compra', s.obrasComCompra, F_INT],
  ].forEach(([rot, v, f], i) => kpi(4, i, rot as string, v as number, f as string, PALETA[i]));
  const segunda: [string, number, string][] = [];
  if (r.custos?.obras.length) {
    const t = r.custos.obras.reduce((a, o) => ({ orcado: a.orcado + o.orcado, atendido: a.atendido + o.atendido, pendente: a.pendente + o.pendente }),
      { orcado: 0, atendido: 0, pendente: 0 });
    segunda.push(['Orçado (obras)', t.orcado, F_BRL0], ['Atendido (realizado)', t.atendido, F_BRL0], ['Pendente (comprometido)', t.pendente, F_BRL0]);
  }
  if (r.financeiro) {
    const f = r.financeiro.resumo;
    segunda.push(['Receitas', f.aReceber, F_BRL0], ['Despesas', f.aPagar, F_BRL0], ['Resultado', r2(f.aReceber - f.aPagar), F_BRL0]);
  }
  segunda.slice(0, 6).forEach(([rot, v, f], i) => kpi(7, i, rot, v, f, PALETA[(i + 2) % PALETA.length]));

  // dados dos gráficos: cada bloco ocupa algumas colunas da aba ABA_DADOS (escrita no fim, depois das outras abas)
  const blocos: Bloco[] = [];
  const bloco = (col: number, tituloBloco: string, cabecalhos: string[], linhas: (string | number)[][], formatos: (string | undefined)[]) => {
    blocos.push({ col, titulo: tituloBloco, cabecalhos, linhas, formatos });
    const letra = (k: number) => String.fromCharCode(65 + col + k);
    return { letra, ate: Math.max(3, linhas.length + 2) };
  };

  const graficos: Grafico[] = [];
  // grade de 2 gráficos por linha abaixo dos indicadores; gráfico sem dado não entra (e não deixa buraco)
  const adicionar = (g: Omit<Grafico, 'ancora'>, largo = false) => {
    let i = graficos.length;
    if (largo && i % 2) i++;                      // gráfico largo começa numa linha nova
    const linha = 10 + Math.floor(i / 2) * 18;
    graficos.push({
      ...g,
      ancora: largo ? { col: 0, lin: linha, ateCol: 12, ateLin: linha + 17 }
        : { col: (i % 2) * 6, lin: linha, ateCol: (i % 2) * 6 + 6, ateLin: linha + 17 },
    });
  };

  // 1) compras por mês
  const meses = s.compradoMensal;
  if (meses.length) {
    const b1 = bloco(0, 'Compras por mês', ['Mês', 'Comprado'], meses.map(m => [rotuloMes(m.mes), m.valor]), [undefined, F_BRL]);
    adicionar({
      tipo: 'colunas', titulo: 'Compras por mês', formato: F_BRL0,
      categorias: { ref: refAba(b1.letra(0), 3, b1.ate), valores: meses.map(m => rotuloMes(m.mes)) },
      series: [{ nome: 'Comprado', ref: refAba(b1.letra(1), 3, b1.ate), valores: meses.map(m => m.valor), cor: PALETA[0] }],
    });
  }

  // 2) top 10 fornecedores (ordem crescente: no gráfico de barras o maior fica em cima)
  const top = r.painel.fornecedores.slice(0, 10).reverse();
  if (top.length) {
    const b2 = bloco(3, 'Top 10 fornecedores', ['Fornecedor', 'Valor comprado'], top.map(f => [f.fornecedor, f.valor]), [undefined, F_BRL]);
    adicionar({
      tipo: 'barras', titulo: 'Top 10 fornecedores (valor comprado)', formato: F_BRL0,
      categorias: { ref: refAba(b2.letra(0), 3, b2.ate), valores: top.map(f => f.fornecedor) },
      series: [{ nome: 'Valor comprado', ref: refAba(b2.letra(1), 3, b2.ate), valores: top.map(f => f.valor), cor: PALETA[0] }],
    });
  }

  // 3) compras por obra (pizza)
  const co = r.painel.comprasObra;
  if (co.length) {
    const b3 = bloco(6, 'Compras por obra', ['Obra', 'Comprado'], co.map(o => [o.obra, o.valor]), [undefined, F_BRL]);
    adicionar({
      tipo: 'pizza', titulo: 'Compras por obra', rotulos: true,
      categorias: { ref: refAba(b3.letra(0), 3, b3.ate), valores: co.map(o => o.obra) },
      series: [{ nome: 'Comprado', ref: refAba(b3.letra(1), 3, b3.ate), valores: co.map(o => o.valor), cor: PALETA[0] }],
    });
  }

  // 4) orçado × atendido × pendente por obra
  const cobras = r.custos?.obras ?? [];
  if (cobras.length) {
    const b4 = bloco(9, 'Custos por obra', ['Obra', 'Orçado', 'Atendido', 'Pendente'],
      cobras.map(o => [o.obra, o.orcado, o.atendido, o.pendente]), [undefined, F_BRL, F_BRL, F_BRL]);
    adicionar({
      tipo: 'colunas', titulo: 'Orçado × atendido × pendente por obra', formato: F_BRL0,
      categorias: { ref: refAba(b4.letra(0), 3, b4.ate), valores: cobras.map(o => o.obra) },
      series: [
        { nome: 'Orçado', ref: refAba(b4.letra(1), 3, b4.ate), valores: cobras.map(o => o.orcado), cor: PALETA[6] },
        { nome: 'Atendido', ref: refAba(b4.letra(2), 3, b4.ate), valores: cobras.map(o => o.atendido), cor: PALETA[0] },
        { nome: 'Pendente', ref: refAba(b4.letra(3), 3, b4.ate), valores: cobras.map(o => o.pendente), cor: PALETA[3] },
      ],
    });
  }

  // 5) receitas × despesas × resultado por obra
  const fo = (r.financeiro?.porObra ?? []).map(o => ({ obra: o.obra || 'Sem obra', rec: o.aReceber, desp: o.aPagar, res: r2(o.aReceber - o.aPagar) }));
  if (fo.length) {
    const b5 = bloco(14, 'Resultado por obra', ['Obra', 'Receitas', 'Despesas', 'Resultado'],
      fo.map(o => [o.obra, o.rec, o.desp, o.res]), [undefined, F_BRL, F_BRL, F_BRL]);
    adicionar({
      tipo: 'colunas', titulo: 'Receitas × despesas × resultado por obra', formato: F_BRL0,
      categorias: { ref: refAba(b5.letra(0), 3, b5.ate), valores: fo.map(o => o.obra) },
      series: [
        { nome: 'Receitas', ref: refAba(b5.letra(1), 3, b5.ate), valores: fo.map(o => o.rec), cor: PALETA[2] },
        { nome: 'Despesas', ref: refAba(b5.letra(2), 3, b5.ate), valores: fo.map(o => o.desp), cor: PALETA[7] },
        { nome: 'Resultado', ref: refAba(b5.letra(3), 3, b5.ate), valores: fo.map(o => o.res), cor: PALETA[0] },
      ],
    }, true);
  }
  return { graficos, blocos };
}

interface Bloco { col: number; titulo: string; cabecalhos: string[]; linhas: (string | number)[][]; formatos: (string | undefined)[] }

/** Aba com os dados que alimentam os gráficos do Dashboard (o usuário pode editar e o gráfico acompanha). */
function abaDadosGraficos(wb: ExcelJS.Workbook, blocos: Bloco[]) {
  const ws = wb.addWorksheet(ABA_DADOS, { properties: { tabColor: { argb: 'FF9CA3AF' } } });
  for (const b of blocos) {
    const letra = (k: number) => String.fromCharCode(65 + b.col + k);
    Object.assign(ws.getCell(`${letra(0)}1`), { value: b.titulo, font: { bold: true, size: 11, color: { argb: COR.titulo } } });
    b.cabecalhos.forEach((h, k) => Object.assign(ws.getCell(`${letra(k)}2`), {
      value: h, font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.marca } },
    }));
    b.linhas.forEach((l, j) => l.forEach((v, k) => {
      const cel = ws.getCell(`${letra(k)}${j + 3}`);
      cel.value = v;
      if (b.formatos[k]) cel.numFmt = b.formatos[k]!;
    }));
    b.cabecalhos.forEach((_, k) => { ws.getColumn(b.col + k + 1).width = k ? 16 : 30; });
  }
}

// ---------------------------------------------------------------------------------------------------------------

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const ExportacaoService = {
  async excel(op: OpcoesExportacao): Promise<{ buffer: Buffer; nome: string }> {
    const r = await montar(op);
    const info = linhaInfo(r);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Painel Sienge — Suprimentos';
    wb.created = new Date();
    tabelas = 0;

    const quer = (s: Secao) => op.secoes.includes(s);
    const dash = op.graficos ? dashboard(wb, r, info) : null;
    if (quer('geral')) abasResumo(wb, r, info);
    if (quer('compras')) abasCompras(wb, r, info);
    if (quer('fornecedores')) abaFornecedores(wb, r, info);
    if (quer('custos')) abasCustos(wb, r, info);
    if (quer('resultado')) abasResultado(wb, r, info);
    if (dash) abaDadosGraficos(wb, dash.blocos); // por último: a aba de dados dos gráficos fica no fim
    const graficos = dash?.graficos ?? [];

    let buffer: Buffer = Buffer.from(await wb.xlsx.writeBuffer());
    if (graficos.length) buffer = await inserirGraficos(buffer, 'Dashboard', graficos);
    const nome = `relatorio-suprimentos_${r.periodo.from}_a_${r.periodo.to}${r.obra ? `_${slug(r.obra.nome)}` : ''}.xlsx`;
    return { buffer, nome };
  },
};
