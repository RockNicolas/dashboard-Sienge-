// Relatório em PDF gerado no navegador: A4 deitado, cabeçalho e rodapé em todas as páginas, uma seção por página
// (indicadores, gráficos e tabelas). Carregado só na hora de exportar (import dinâmico) para não pesar o painel.
import { jsPDF } from 'jspdf';
import { autoTable, type UserOptions } from 'jspdf-autotable';
import { Chart, type ChartConfiguration } from 'chart.js';
import type { CustosObraResponse, DashboardResponse, FinanceiroResponse } from '@server/types';
import { api, type FiltrosUI } from '../api/client';
import { statusMargem } from './status';

export type SecaoRelatorio = 'geral' | 'compras' | 'fornecedores' | 'custos' | 'resultado';
export interface OpcoesPdf { filtros: FiltrosUI; secoes: SecaoRelatorio[]; obraNome: string }

// página A4 deitada, em mm
const L = 297;
const A = 210;
const M = 12;
const TOPO = 17;
const RODAPE = 13;
const UTIL = L - 2 * M;
type Rgb = [number, number, number];
const COR: Record<'marca' | 'texto' | 'suave' | 'linha' | 'fundo' | 'neg' | 'pos', Rgb> = {
  marca: [42, 120, 214], texto: [17, 24, 39], suave: [107, 114, 128], linha: [229, 231, 235],
  fundo: [243, 246, 251], neg: [196, 51, 47], pos: [11, 122, 83],
};
// gráficos e cartões: cores de série vivas (sem as de status) e cor de status onde há bom/ruim — mesma regra da tela
const PRINCIPAL = '#4f46e5', SECUNDARIA = '#9333ea', TERCIARIA = '#0284c7', REFERENCIA = '#c7d2fe';
const COR_STATUS = { bom: '#16a34a', melhorar: '#eab308', atencao: '#ea580c', ruim: '#dc2626' } as const;
const corMargem = (resultado: number, receitas: number) => { const st = statusMargem(resultado, receitas); return st ? COR_STATUS[st.nivel] : PRINCIPAL; };
const LIMITE_ITENS = 300;

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brl2 = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brlCurto = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const dataBR = (s: string) => (s ? s.split('-').reverse().join('/') : '—');
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
const SITUACAO: Record<string, string> = {
  PENDING: 'Pendente', PARTIALLY_DELIVERED: 'Parc. entregue', FULLY_DELIVERED: 'Atendido', CANCELED: 'Cancelado',
};
const TIPOS: Record<string, string> = {
  MATERIAL: 'Material', LABOR: 'Mão de obra', EQUIPMENT: 'Equipamento', OTHER: 'Outros', OFFICE_SUPPLY: 'Material de escritório',
  FUELS_AND_LUBRICANTS: 'Combustíveis e lubrificantes', MAINTENANCE_MATERIAL: 'Material de manutenção',
};

const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
// sinais comuns que a fonte padrão não tem, trocados por equivalentes que ela tem
const EQUIVALENTES: Record<string, string> = {
  '−': '-', '→': '->', '←': '<-', '≤': '<=', '≥': '>=', '≈': '~', '≠': '<>',
  '‑': '-', '‐': '-', ' ': ' ', ' ': ' ', '​': '',
};
/** As fontes padrão do PDF (Helvetica, codificação WinAnsi) não têm todos os caracteres: troca os que faltam. */
export function textoPdf(s: string): string {
  return [...s].map(ch => {
    const c = ch.codePointAt(0)!;
    if (ch in EQUIVALENTES) return EQUIVALENTES[ch];
    if (c < 256 || WINANSI_EXTRA.includes(ch)) return ch;
    const sem = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return [...sem].every(x => x.codePointAt(0)! < 256) ? sem : '?';
  }).join('');
}

/** Desenha um gráfico do Chart.js numa tela invisível e devolve a imagem (PNG). */
function grafico(config: ChartConfiguration, largura: number, altura: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const chart = new Chart(canvas, config);
  const url = canvas.toDataURL('image/png');
  chart.destroy();
  return url;
}

const FONTE = { family: 'Helvetica, Arial, sans-serif', size: 22 };
/** Opções comuns dos gráficos do relatório (cores fixas do tema claro, fontes para impressão). */
function opcoes(horizontal: boolean, legenda: boolean, eixoMoeda = true): ChartConfiguration['options'] {
  const eixoValor = { ticks: { font: FONTE, color: '#4b5563', callback: (v: string | number) => (eixoMoeda ? brlCurto(Number(v)) : String(v)), maxTicksLimit: 7 }, grid: { color: '#e5e7eb' }, border: { display: false } };
  const eixoCat = { ticks: { font: FONTE, color: '#374151', autoSkip: false, maxRotation: 0 }, grid: { display: false } };
  return {
    responsive: false, animation: false, devicePixelRatio: 1, indexAxis: horizontal ? 'y' : 'x',
    plugins: {
      legend: { display: legenda, position: 'bottom', labels: { font: FONTE, color: '#374151', boxWidth: 18, padding: 18 } },
      tooltip: { enabled: false },
    },
    scales: horizontal ? { x: eixoValor, y: eixoCat } : { x: eixoCat, y: eixoValor },
  };
}

const encurtar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
/** Número do insumo no Sienge (quando há) antes do nome: "103 – Brita 1". */
const ehCod = (id: string) => /^\d+$/.test(id);
const comCod = (id: string, nome: string) => (ehCod(id) ? `${id} – ${nome}` : nome);
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

class Documento {
  doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  y = TOPO;
  private secoes = 0;

  private get fim() { return A - RODAPE; }
  /** Espaço que ainda cabe na página atual (mm). */
  livre() { return this.fim - this.y; }
  espaco(h: number) { if (this.y + h > this.fim) this.novaPagina(); }
  novaPagina() { this.doc.addPage(); this.y = TOPO; }

  /** Título de seção: cada seção começa numa página nova (a primeira divide a página com a capa). */
  secao(titulo: string, subtitulo?: string) {
    if (this.secoes++ > 0) this.novaPagina();
    const d = this.doc;
    d.setFillColor(...COR.marca);
    d.rect(M, this.y + 1, 1.4, subtitulo ? 11 : 7, 'F');
    d.setFont('helvetica', 'bold'); d.setFontSize(14); d.setTextColor(...COR.texto);
    d.text(textoPdf(titulo), M + 4, this.y + 6);
    if (subtitulo) {
      d.setFont('helvetica', 'normal'); d.setFontSize(8.5); d.setTextColor(...COR.suave);
      d.text(textoPdf(subtitulo), M + 4, this.y + 11);
    }
    this.y += subtitulo ? 17 : 12;
  }

  /** Título de tabela/bloco: reserva espaço para o título não ficar sozinho no pé da página. */
  subtitulo(t: string) {
    this.espaco(30);
    this.doc.setFont('helvetica', 'bold'); this.doc.setFontSize(10); this.doc.setTextColor(...COR.texto);
    this.doc.text(textoPdf(t), M, this.y + 4);
    this.y += 6.5;
  }

  nota(t: string) {
    const d = this.doc;
    d.setFont('helvetica', 'normal'); d.setFontSize(7.5); d.setTextColor(...COR.suave);
    const linhas = d.splitTextToSize(textoPdf(t), UTIL) as string[];
    this.espaco(linhas.length * 3.4 + 2);
    d.text(linhas, M, this.y + 3);
    this.y += linhas.length * 3.4 + 3;
  }

  /** Indicadores em blocos (até 6 por linha). */
  kpis(itens: { rotulo: string; valor: string; cor: string; neg?: boolean }[]) {
    const d = this.doc;
    const porLinha = 6;
    const gap = 3.5;
    const w = (UTIL - gap * (porLinha - 1)) / porLinha;
    const h = 16;
    itens.forEach((k, i) => {
      if (i % porLinha === 0) { if (i) this.y += h + gap; this.espaco(h); }
      const x = M + (i % porLinha) * (w + gap);
      d.setFillColor(...COR.fundo); d.roundedRect(x, this.y, w, h, 1.6, 1.6, 'F');
      d.setFillColor(...hex(k.cor)); d.rect(x, this.y, 1.1, h, 'F');
      d.setFont('helvetica', 'normal'); d.setFontSize(7); d.setTextColor(...COR.suave);
      d.text(textoPdf(k.rotulo), x + 3.6, this.y + 5.2, { maxWidth: w - 5 });
      d.setFont('helvetica', 'bold'); d.setFontSize(12.5); d.setTextColor(...(k.neg ? COR.neg : COR.texto));
      d.text(textoPdf(k.valor), x + 3.6, this.y + 12, { maxWidth: w - 5 });
    });
    this.y += h + 6;
  }

  imagem(url: string, w: number, h: number) {
    this.espaco(h);
    this.doc.addImage(url, 'PNG', M, this.y, w, h, undefined, 'FAST');
    this.y += h + 5;
  }

  private estilo(colunas: { t: string; dir?: boolean; largura?: number }[]): Partial<UserOptions> {
    return {
      theme: 'striped',
      margin: { left: M, right: M, top: TOPO, bottom: RODAPE + 2 },
      styles: { font: 'helvetica', fontSize: 7.4, cellPadding: 1.3, textColor: COR.texto, lineColor: COR.linha, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: COR.marca, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.4 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: Object.fromEntries(colunas.map((c, i) => [i, { halign: c.dir ? 'right' : 'left', ...(c.largura ? { cellWidth: c.largura } : {}) }])),
      didParseCell: data => {
        // título de coluna numérica alinhado com os números; valores negativos em vermelho
        if (data.section === 'head' && colunas[data.column.index]?.dir) data.cell.styles.halign = 'right';
        if (data.section === 'body' && /^-R\$/.test(String(data.cell.raw))) data.cell.styles.textColor = COR.neg;
      },
    };
  }

  /** Tabela com cabeçalho repetido a cada página. Números alinhados à direita (`dir`). */
  tabela(colunas: { t: string; dir?: boolean; largura?: number }[], linhas: (string | number)[][], extra: Partial<UserOptions> = {}) {
    this.espaco(14);
    autoTable(this.doc, {
      ...this.estilo(colunas),
      startY: this.y,
      head: [colunas.map(c => textoPdf(c.t))],
      body: linhas.length ? linhas.map(l => l.map(v => textoPdf(String(v ?? '')))) : [[{ content: 'Sem dados no período', colSpan: colunas.length }]],
      ...extra,
    });
    this.y = this.ultimoY() + 6;
  }

  /** Tabelas pequenas lado a lado (ex.: top fornecedores, top materiais e compras por obra). */
  ladoALado(...tabelas: Parameters<Documento['tabela']>[]) {
    this.espaco(32);
    const inicio = this.y;
    const gap = 5;
    const largura = (UTIL - gap * (tabelas.length - 1)) / tabelas.length;
    const finais: number[] = [];
    for (const [i, [colunas, linhas]] of tabelas.entries()) {
      autoTable(this.doc, {
        ...this.estilo(colunas),
        startY: inicio,
        margin: { left: M + i * (largura + gap), right: L - M - (i * (largura + gap) + largura), top: TOPO, bottom: RODAPE + 2 },
        head: [colunas.map(c => textoPdf(c.t))],
        body: linhas.length ? linhas.map(l => l.map(v => textoPdf(String(v ?? '')))) : [[{ content: 'Sem dados', colSpan: colunas.length }]],
      });
      finais.push(this.ultimoY());
    }
    this.y = Math.max(...finais) + 6;
  }

  private ultimoY(): number {
    return (this.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  }

  /** Cabeçalho e rodapé em todas as páginas (feitos no fim, quando já se sabe o total de páginas). */
  molduras(info: string) {
    const d = this.doc;
    const n = d.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      d.setPage(i);
      d.setFillColor(...COR.marca); d.rect(0, 0, L, 1.6, 'F');
      d.setFont('helvetica', 'bold'); d.setFontSize(8); d.setTextColor(...COR.texto);
      d.text('Relatório de Suprimentos', M, 8.5);
      d.setFont('helvetica', 'normal'); d.setTextColor(...COR.suave);
      d.text(textoPdf(info), L - M, 8.5, { align: 'right' });
      d.setDrawColor(...COR.linha); d.setLineWidth(0.2); d.line(M, 11, L - M, 11);
      d.setFontSize(7.2);
      d.text('Painel Sienge · Suprimentos', M, A - 6);
      d.text(`Página ${i} de ${n}`, L - M, A - 6, { align: 'right' });
    }
  }
}

/** Gera o PDF com as seções pedidas e devolve o arquivo (o diálogo baixa). */
export async function gerarPdf(op: OpcoesPdf): Promise<{ blob: Blob; nome: string }> {
  const quer = (s: SecaoRelatorio) => op.secoes.includes(s);
  const [d, c, f] = await Promise.all([
    api.dashboard(op.filtros),
    quer('custos') ? api.custosObra(op.filtros) : Promise.resolve(null as CustosObraResponse | null),
    quer('resultado') ? api.financeiro(op.filtros, 'mes') : Promise.resolve(null as FinanceiroResponse | null),
  ]);
  const info = `${dataBR(d.de)} a ${dataBR(d.ate)} · ${op.obraNome}`;
  const pdf = new Documento();
  const doc = pdf.doc;
  doc.setProperties({ title: 'Relatório de Suprimentos', subject: info, creator: 'Painel Sienge' });

  // capa: título e filtros
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...COR.texto);
  doc.text('Relatório de Suprimentos', M, pdf.y + 8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...COR.suave);
  doc.text(textoPdf(`Período: ${dataBR(d.de)} a ${dataBR(d.ate)} · Obra: ${op.obraNome} · Gerado em ${new Date().toLocaleString('pt-BR')} · `
    + `Fonte: ${d.mock ? 'dados de demonstração' : 'Sienge'}`), M, pdf.y + 14);
  pdf.y += 21;

  if (quer('geral')) secaoGeral(pdf, d, c, f);
  if (quer('compras')) secaoCompras(pdf, d);
  if (quer('fornecedores')) secaoFornecedores(pdf, d);
  if (quer('custos') && c) secaoCustos(pdf, d, c);
  if (quer('resultado') && f) secaoResultado(pdf, f);

  pdf.molduras(info);
  const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const nome = `relatorio-suprimentos_${d.de}_a_${d.ate}${op.filtros.obra ? `_${slug(op.obraNome)}` : ''}.pdf`;
  return { blob: doc.output('blob'), nome };
}

// ---------------------------------------------------------------------------------------------------------------
// seções

function secaoGeral(pdf: Documento, d: DashboardResponse, c: CustosObraResponse | null, f: FinanceiroResponse | null) {
  const r = d.resumo;
  pdf.secao('Visão geral', 'Pedidos de compra do período');
  pdf.kpis([
    { rotulo: 'Total comprado', valor: brl(r.comprado), cor: PRINCIPAL },
    { rotulo: 'Pedidos de compra', valor: num(r.pedidos), cor: PRINCIPAL },
    { rotulo: 'Ticket médio por pedido', valor: brl(r.ticketMedio), cor: PRINCIPAL },
    { rotulo: 'Fornecedores', valor: num(r.fornecedores), cor: PRINCIPAL },
    { rotulo: 'Materiais diferentes', valor: num(r.insumos), cor: PRINCIPAL },
    { rotulo: 'Obras com compra', valor: num(r.obrasComCompra), cor: PRINCIPAL },
  ]);
  const extra: { rotulo: string; valor: string; cor: string; neg?: boolean }[] = [];
  if (c?.obras.length) {
    const t = c.obras.reduce((a, o) => ({ orcado: a.orcado + o.orcado, atendido: a.atendido + o.atendido, pendente: a.pendente + o.pendente }), { orcado: 0, atendido: 0, pendente: 0 });
    extra.push({ rotulo: 'Orçado (obras)', valor: brl(t.orcado), cor: PRINCIPAL }, { rotulo: 'Atendido (realizado)', valor: brl(t.atendido), cor: PRINCIPAL },
      { rotulo: 'Pendente (comprometido)', valor: brl(t.pendente), cor: PRINCIPAL });
  }
  if (f) {
    const res = f.resumo.aReceber - f.resumo.aPagar;
    extra.push({ rotulo: 'Receitas', valor: brl(f.resumo.aReceber), cor: PRINCIPAL }, { rotulo: 'Despesas', valor: brl(f.resumo.aPagar), cor: PRINCIPAL },
      { rotulo: 'Resultado', valor: brl(res), cor: PRINCIPAL, neg: res < 0 });
  }
  if (extra.length) pdf.kpis(extra.slice(0, 6));

  const meses = r.compradoMensal;
  if (meses.length) {
    // o gráfico usa o espaço que sobra, deixando lugar para as 3 tabelas: a Visão geral cabe numa página
    const h = Math.max(42, Math.min(72, pdf.livre() - 46));
    pdf.imagem(grafico({
      type: 'bar',
      data: { labels: meses.map(m => rotuloMes(m.mes)), datasets: [{ label: 'Comprado', data: meses.map(m => m.valor), backgroundColor: PRINCIPAL, borderRadius: 6 }] },
      options: opcoes(false, false),
    }, 2000, Math.round((2000 * h) / UTIL)), UTIL, h);
  }
  pdf.ladoALado(
    [[{ t: 'Top 5 fornecedores' }, { t: 'Valor', dir: true }, { t: 'Part.', dir: true }],
      d.fornecedores.slice(0, 5).map(x => [encurtar(x.fornecedor, 30), brl(x.valor), pct(x.participacao)])],
    [[{ t: 'Top 5 materiais' }, { t: 'Valor', dir: true }, { t: 'Compras', dir: true }],
      d.historico.slice(0, 5).map(x => [encurtar(comCod(x.insumoId, x.insumo), 30), brl(x.valor), x.compras])],
    [[{ t: 'Compras por obra' }, { t: 'Comprado', dir: true }, { t: '%', dir: true }],
      d.comprasObra.slice(0, 5).map(o => [encurtar(o.obra, 30), brl(o.valor), pct(o.participacao)])],
  );
}

function secaoCompras(pdf: Documento, d: DashboardResponse) {
  pdf.secao('Histórico de compras', 'Itens dos pedidos de compra do Sienge (cancelados e reprovados ficam de fora) · preço = preço unitário líquido');
  pdf.subtitulo('Materiais comprados');
  pdf.tabela([
    { t: 'Cód.', dir: true, largura: 14 }, { t: 'Material' }, { t: 'Un.' }, { t: 'Compras', dir: true }, { t: 'Quantidade', dir: true },
    { t: 'Valor', dir: true }, { t: 'Último preço', dir: true }, { t: 'Data', dir: true }, { t: 'Menor', dir: true }, { t: 'Médio', dir: true },
    { t: 'Maior', dir: true }, { t: 'Variação', dir: true },
  ], d.historico.map(m => [ehCod(m.insumoId) ? m.insumoId : '—', m.insumo, m.un, m.compras, num(m.qtd), brl(m.valor), brl2(m.ultimoPreco), dataBR(m.ultimaData),
    brl2(m.precoMin), brl2(m.precoMedio), brl2(m.precoMax), pct(m.variacao)]));
  pdf.subtitulo('Itens dos pedidos de compra');
  const itens = d.compras.slice(0, LIMITE_ITENS);
  pdf.tabela([
    { t: 'Data', largura: 16 }, { t: 'Pedido', largura: 13 }, { t: 'Situação', largura: 20 }, { t: 'Obra' }, { t: 'Fornecedor' },
    { t: 'Material' }, { t: 'Quantidade', dir: true }, { t: 'Preço líquido', dir: true }, { t: 'Valor', dir: true }, { t: 'Comprador' },
  ], itens.map(x => [dataBR(x.data), x.pedido, SITUACAO[x.situacao] ?? x.situacao, x.obra || 'Sem obra', x.fornecedor,
    comCod(x.insumoId, x.insumo), `${num(x.qtd)} ${x.un}`, brl2(x.preco), brl2(x.valor), x.comprador || '—']));
  if (d.comprasTotal > itens.length)
    pdf.nota(`Mostrando os ${itens.length} itens mais recentes de ${d.comprasTotal.toLocaleString('pt-BR')}. A lista completa sai na exportação em Excel.`);
}

function secaoFornecedores(pdf: Documento, d: DashboardResponse) {
  const l = d.fornecedores;
  pdf.secao('Fornecedores', 'Ranking por valor comprado · identificação pelo cadastro de credores do Sienge');
  const top = l.slice(0, 10);
  if (top.length) {
    pdf.imagem(grafico({
      type: 'bar',
      data: { labels: top.map(x => encurtar(x.fornecedor, 34)), datasets: [{ label: 'Valor comprado', data: top.map(x => x.valor), backgroundColor: PRINCIPAL, borderRadius: 6 }] },
      options: opcoes(true, false),
    }, 2000, 640), UTIL, UTIL * 640 / 2000);
  }
  pdf.tabela([
    { t: '#', dir: true, largura: 8 }, { t: 'Fornecedor' }, { t: 'CNPJ/CPF', largura: 32 }, { t: 'Cidade', largura: 26 },
    { t: 'Valor comprado', dir: true }, { t: 'Part.', dir: true }, { t: 'Acum.', dir: true }, { t: 'Classe', largura: 13 },
    { t: 'Pedidos', dir: true }, { t: 'Ticket médio', dir: true }, { t: 'Em atraso', dir: true }, { t: 'Última compra', dir: true },
  ], l.map((x, i) => [i + 1, x.fornecedor, x.cadastro?.cnpj || '—', x.cadastro?.cidade || '—', brl(x.valor), pct(x.participacao),
    pct(x.acumulado), x.classe, x.pedidos, brl(x.ticketMedio), x.atrasados, dataBR(x.ultimaCompra)]));
}

function secaoCustos(pdf: Documento, d: DashboardResponse, c: CustosObraResponse) {
  pdf.secao('Custos por obra', 'Material comprado (pedidos) e orçado × pendente × atendido (Insumos da Obra do Sienge)');
  pdf.subtitulo('Material comprado por obra');
  pdf.tabela([{ t: 'Obra' }, { t: 'Comprado', dir: true }, { t: '%', dir: true }, { t: 'Pedidos', dir: true },
    { t: 'Fornecedores', dir: true }, { t: 'Materiais', dir: true }, { t: 'Principais materiais' }],
  d.comprasObra.map(o => [o.obra, brl(o.valor), pct(o.participacao), o.pedidos, o.fornecedores, o.insumos, o.topInsumos.slice(0, 3).map(t => t.insumo).join(', ')]));

  const custo = (t: { orcado: number; pendente: number; atendido: number; atendidoPeriodo: number; saldo: number }) =>
    [brl(t.orcado), brl(t.pendente), brl(t.atendido), t.orcado ? pct((t.atendido / t.orcado) * 100) : '—', brl(t.atendidoPeriodo), brl(t.saldo)];
  const colCusto = [{ t: 'Orçado', dir: true }, { t: 'Pendente', dir: true }, { t: 'Atendido', dir: true }, { t: '% do orçado', dir: true },
    { t: 'No período', dir: true }, { t: 'Saldo', dir: true }];
  if (c.aviso) pdf.nota(c.aviso);
  if (!c.obras.length) { pdf.nota('Os insumos das obras ainda não vieram do Sienge para este filtro.'); return; }

  pdf.imagem(grafico({
    type: 'bar',
    data: {
      labels: c.obras.map(o => encurtar(o.obra, 26)),
      datasets: [
        { label: 'Orçado', data: c.obras.map(o => o.orcado), backgroundColor: REFERENCIA, borderRadius: 4 },
        { label: 'Atendido', data: c.obras.map(o => o.atendido), backgroundColor: PRINCIPAL, borderRadius: 4 },
        { label: 'Pendente', data: c.obras.map(o => o.pendente), backgroundColor: SECUNDARIA, borderRadius: 4 },
      ],
    },
    options: opcoes(false, true),
  }, 2000, 600), UTIL, UTIL * 600 / 2000);
  pdf.subtitulo('Orçado × pendente × atendido por obra');
  pdf.tabela([{ t: 'Obra' }, ...colCusto], c.obras.map(o => [o.obra, ...custo(o)]));
  for (const o of c.obras) {
    pdf.subtitulo(`${o.obra} — por tipo de insumo`);
    pdf.tabela([{ t: 'Tipo' }, ...colCusto], o.categorias.map(x => [x.nome, ...custo(x)]));
    pdf.subtitulo(`${o.obra} — principais serviços (item do orçamento)`);
    pdf.tabela([{ t: 'Item (EDT)', largura: 24 }, { t: 'Serviço' }, ...colCusto], o.servicos.slice(0, 12).map(x => [x.edt || '—', x.servico, ...custo(x)]));
  }
  pdf.nota('Orçado = itens do orçamento (sem BDI e encargos) · Pendente = saldos de pedidos e contratos · Atendido = notas fiscais e medições '
    + '(acumulado) · No período = atendido com data no filtro · Saldo negativo = passou do orçamento.');
}

function secaoResultado(pdf: Documento, f: FinanceiroResponse) {
  const r = f.resumo;
  const res = r.aReceber - r.aPagar;
  const real = r.recebido - r.pago;
  pdf.secao('Resultado da obra', `Receitas (contas a receber) − despesas (contas a pagar) com vencimento de ${dataBR(f.de)} a ${dataBR(f.ate)}`);
  pdf.kpis([
    { rotulo: 'Receitas', valor: brl(r.aReceber), cor: PRINCIPAL },
    { rotulo: 'Despesas', valor: brl(r.aPagar), cor: PRINCIPAL },
    { rotulo: 'Resultado', valor: brl(res), cor: PRINCIPAL, neg: res < 0 },
    { rotulo: 'Margem', valor: r.aReceber ? pct((res / r.aReceber) * 100) : '—', cor: PRINCIPAL, neg: res < 0 },
    { rotulo: 'Recebido', valor: brl(r.recebido), cor: PRINCIPAL },
    { rotulo: 'Pago', valor: brl(r.pago), cor: PRINCIPAL },
  ]);
  const obras = [...f.porObra].sort((a, b) => b.aReceber + b.aPagar - (a.aReceber + a.aPagar));
  if (obras.length) {
    pdf.imagem(grafico({
      type: 'bar',
      data: {
        labels: obras.map(o => encurtar(o.obra || 'Sem obra', 26)),
        datasets: [
          { label: 'Receitas', data: obras.map(o => o.aReceber), backgroundColor: TERCIARIA, borderRadius: 4 },
          { label: 'Despesas', data: obras.map(o => o.aPagar), backgroundColor: SECUNDARIA, borderRadius: 4 },
          { label: 'Resultado', data: obras.map(o => o.aReceber - o.aPagar), backgroundColor: obras.map(o => corMargem(o.aReceber - o.aPagar, o.aReceber)), borderRadius: 4 },
        ],
      },
      options: opcoes(false, true),
    }, 2000, 560), UTIL, UTIL * 560 / 2000);
  }
  pdf.subtitulo('Resultado por obra');
  pdf.tabela([{ t: 'Obra' }, { t: 'Receitas', dir: true }, { t: 'Despesas', dir: true }, { t: 'Resultado', dir: true }, { t: 'Margem', dir: true },
    { t: 'Recebido', dir: true }, { t: 'Pago', dir: true }, { t: 'Realizado', dir: true }],
  obras.map(o => {
    const v = o.aReceber - o.aPagar;
    return [o.obra || 'Sem obra', brl(o.aReceber), brl(o.aPagar), brl(v), o.aReceber ? pct((v / o.aReceber) * 100) : '—', brl(o.recebido), brl(o.pago), brl(o.recebido - o.pago)];
  }));
  const planos = new Map<string, number>();
  f.despesasObra.forEach(o => o.planos.forEach(p => planos.set(p.plano, (planos.get(p.plano) ?? 0) + p.valor)));
  if (planos.size) {
    pdf.subtitulo('Despesas por plano financeiro');
    pdf.tabela([{ t: 'Plano financeiro' }, { t: 'Valor', dir: true }, { t: '% das despesas', dir: true }],
      [...planos].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([p, v]) => [p, brl(v), r.aPagar ? pct((v / r.aPagar) * 100) : '—']));
  }
  pdf.nota('Títulos rateados entre obras entram proporcionais ao rateio. O contas a receber do Sienge não traz a obra: usa o centro de custo do título.');
}
