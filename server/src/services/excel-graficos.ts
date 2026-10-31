// Gráficos nativos do Excel (DrawingML) injetados no .xlsx gerado pelo ExcelJS, que não sabe criar gráficos.
// Os gráficos apontam para intervalos de células (o usuário pode mudar os dados no Excel e o gráfico acompanha)
// e levam os valores em cache, para aparecerem também em visualizadores que não recalculam.
// A ordem dos elementos segue o schema do Office Open XML (ECMA-376): o Excel recusa a parte se a ordem mudar.
import JSZip from 'jszip';

export type TipoGrafico = 'colunas' | 'barras' | 'linhas' | 'pizza';

export interface SerieGrafico {
  nome: string;
  ref: string;               // ex.: 'Dados dos gráficos'!$B$3:$B$14
  valores: number[];         // cache
  cor: string;               // RRGGBB
}

export interface Grafico {
  tipo: TipoGrafico;
  titulo: string;
  categorias: { ref: string; valores: string[] };
  series: SerieGrafico[];
  formato?: string;          // formato dos números (eixo e rótulos), ex.: '"R$" #,##0'
  empilhado?: boolean;
  rotulos?: boolean;         // valores nas barras / % nas fatias
  /** Posição na planilha (linhas e colunas começam em 0): do canto (col, lin) até (ateCol, ateLin). */
  ancora: { col: number; lin: number; ateCol: number; ateLin: number };
}

const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const REL_DRAWING = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing';
const REL_CHART = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';
const CT_DRAWING = 'application/vnd.openxmlformats-officedocument.drawing+xml';
const CT_CHART = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';

const TEXTO = '374151';
const GRADE = 'E5E7EB';

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fonte = (sz: number, cor = TEXTO, negrito = false) =>
  `<a:defRPr sz="${sz}"${negrito ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${cor}"/></a:solidFill><a:latin typeface="Calibri"/></a:defRPr>`;
const txPr = (sz: number, cor = TEXTO) =>
  `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr>${fonte(sz, cor)}</a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr>`;
const preenchimento = (cor: string) => `<a:solidFill><a:srgbClr val="${cor}"/></a:solidFill>`;

const strRef = (ref: string, valores: string[]) =>
  `<c:strRef><c:f>${esc(ref)}</c:f><c:strCache><c:ptCount val="${valores.length}"/>`
  + valores.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join('')
  + '</c:strCache></c:strRef>';

const numRef = (ref: string, valores: number[], formato: string) =>
  `<c:numRef><c:f>${esc(ref)}</c:f><c:numCache><c:formatCode>${esc(formato)}</c:formatCode><c:ptCount val="${valores.length}"/>`
  + valores.map((v, i) => (Number.isFinite(v) ? `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>` : '')).join('')
  + '</c:numCache></c:numRef>';

const titulo = (t: string) =>
  `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr>${fonte(1200, '111827', true)}</a:pPr>`
  + `<a:r><a:rPr lang="pt-BR" sz="1200" b="1"><a:solidFill><a:srgbClr val="111827"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${esc(t)}</a:t></a:r>`
  + '</a:p></c:rich></c:tx><c:overlay val="0"/></c:title>';

/** Rótulos de dados (CT_DLbls): valor nas barras ou % nas fatias. */
function rotulos(g: Grafico): string {
  if (!g.rotulos) return '';
  const pizza = g.tipo === 'pizza';
  return `<c:dLbls><c:numFmt formatCode="${esc(pizza ? '0%' : g.formato ?? 'General')}" sourceLinked="0"/>`
    + `<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr(pizza ? 900 : 800, pizza ? 'FFFFFF' : TEXTO)}`
    + `${pizza ? '' : `<c:dLblPos val="${g.tipo === 'linhas' ? 't' : g.empilhado ? 'ctr' : 'outEnd'}"/>`}`
    + `<c:showLegendKey val="0"/><c:showVal val="${pizza ? 0 : 1}"/><c:showCatName val="0"/><c:showSerName val="0"/>`
    + `<c:showPercent val="${pizza ? 1 : 0}"/><c:showBubbleSize val="0"/>${pizza ? '<c:showLeaderLines val="1"/>' : ''}</c:dLbls>`;
}

function serie(g: Grafico, s: SerieGrafico, i: number): string {
  const formato = g.formato ?? 'General';
  const inicio = `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${esc(s.nome)}</c:v></c:tx>`;
  const dados = `<c:cat>${strRef(g.categorias.ref, g.categorias.valores)}</c:cat><c:val>${numRef(s.ref, s.valores, formato)}</c:val>`;
  if (g.tipo === 'pizza') {
    // uma cor por fatia (dPt), na ordem da paleta
    const fatias = g.categorias.valores.map((_, k) =>
      `<c:dPt><c:idx val="${k}"/><c:bubble3D val="0"/><c:spPr>${preenchimento(PALETA[k % PALETA.length])}<a:ln w="12700">${preenchimento('FFFFFF')}</a:ln></c:spPr></c:dPt>`).join('');
    return `${inicio}${fatias}${rotulos(g)}${dados}</c:ser>`;
  }
  if (g.tipo === 'linhas') {
    return `${inicio}<c:spPr><a:ln w="28575" cap="rnd">${preenchimento(s.cor)}<a:round/></a:ln></c:spPr>`
      + `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr>${preenchimento(s.cor)}<a:ln>${preenchimento(s.cor)}</a:ln></c:spPr></c:marker>`
      + `${rotulos(g)}${dados}<c:smooth val="0"/></c:ser>`;
  }
  return `${inicio}<c:spPr>${preenchimento(s.cor)}</c:spPr><c:invertIfNegative val="0"/>${rotulos(g)}${dados}</c:ser>`;
}

function eixos(g: Grafico): string {
  const horizontal = g.tipo === 'barras';
  const linha = `<c:spPr><a:ln w="9525">${preenchimento('D1D5DB')}</a:ln></c:spPr>`;
  // "low": os nomes ficam no pé do gráfico mesmo com valores negativos (senão encavalam nas barras abaixo do zero)
  const cat = `<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/>`
    + `<c:axPos val="${horizontal ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="1"/>`
    + `<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/>${linha}${txPr(900)}`
    + '<c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>';
  const val = `<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/>`
    + `<c:axPos val="${horizontal ? 'b' : 'l'}"/><c:majorGridlines><c:spPr><a:ln w="6350">${preenchimento(GRADE)}</a:ln></c:spPr></c:majorGridlines>`
    + `<c:numFmt formatCode="${esc(g.formato ?? 'General')}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/>`
    + `<c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txPr(900)}`
    + '<c:crossAx val="5001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>';
  return cat + val;
}

/** XML de um gráfico (parte xl/charts/chartN.xml). */
export function xmlGrafico(g: Grafico): string {
  const series = g.series.map((s, i) => serie(g, s, i)).join('');
  let plot: string;
  if (g.tipo === 'pizza') {
    plot = `<c:pieChart><c:varyColors val="1"/>${series}<c:firstSliceAng val="0"/></c:pieChart>`;
  } else if (g.tipo === 'linhas') {
    plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="1"/>`
      + `<c:axId val="5001"/><c:axId val="5002"/></c:lineChart>${eixos(g)}`;
  } else {
    plot = `<c:barChart><c:barDir val="${g.tipo === 'barras' ? 'bar' : 'col'}"/><c:grouping val="${g.empilhado ? 'stacked' : 'clustered'}"/>`
      + `<c:varyColors val="0"/>${series}<c:gapWidth val="${g.series.length > 1 ? 60 : 50}"/>${g.empilhado ? '<c:overlap val="100"/>' : ''}`
      + `<c:axId val="5001"/><c:axId val="5002"/></c:barChart>${eixos(g)}`;
  }
  const legenda = g.tipo === 'pizza' || g.series.length > 1
    ? `<c:legend><c:legendPos val="${g.tipo === 'pizza' ? 'r' : 'b'}"/><c:overlay val="0"/>${txPr(900)}</c:legend>` : '';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">`
    + '<c:date1904 val="0"/><c:lang val="pt-BR"/><c:roundedCorners val="0"/>'
    + `<c:chart>${titulo(g.titulo)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot}</c:plotArea>`
    + `${legenda}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>`
    + `<c:spPr>${preenchimento('FFFFFF')}<a:ln w="9525">${preenchimento(GRADE)}</a:ln></c:spPr>`
    + `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr>${fonte(900)}</a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr>`
    + '<c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings>'
    + '</c:chartSpace>';
}

/** XML do desenho (xl/drawings/drawingN.xml) que posiciona os gráficos na planilha. */
export function xmlDesenho(graficos: Grafico[]): string {
  const ancoras = graficos.map((g, i) => {
    const a = g.ancora;
    return '<xdr:twoCellAnchor editAs="oneCell">'
      + `<xdr:from><xdr:col>${a.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.lin}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`
      + `<xdr:to><xdr:col>${a.ateCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.ateLin}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
      + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="${esc(g.titulo)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>`
      + '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>'
      + `<a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="rId${i + 1}"/></a:graphicData></a:graphic>`
      + '</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>';
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}">${ancoras}</xdr:wsDr>`;
}

const relacoes = (itens: { id: string; tipo: string; alvo: string }[]) =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + itens.map(r => `<Relationship Id="${r.id}" Type="${r.tipo}" Target="${r.alvo}"/>`).join('') + '</Relationships>';

// elementos que vêm depois de <drawing> no CT_Worksheet: o <drawing> entra antes do primeiro que existir
const DEPOIS_DO_DESENHO = ['<legacyDrawing', '<legacyDrawingHF', '<drawingHF', '<picture', '<oleObjects', '<controls',
  '<webPublishItems', '<tableParts', '<extLst', '</worksheet>'];

/** Caminho do XML da planilha `aba` (pelo nome), lendo workbook.xml e suas relações. */
async function caminhoDaAba(zip: JSZip, aba: string): Promise<string> {
  const wb = await zip.file('xl/workbook.xml')!.async('string');
  const m = [...wb.matchAll(/<sheet\b[^>]*>/g)].map(x => x[0]).find(t => t.includes(`name="${esc(aba)}"`));
  const rid = m?.match(/r:id="([^"]+)"/)?.[1];
  if (!rid) throw new Error(`Planilha "${aba}" não encontrada no arquivo`);
  const rels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string');
  const alvo = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map(x => x[0]).find(t => t.includes(`Id="${rid}"`))?.match(/Target="([^"]+)"/)?.[1];
  if (!alvo) throw new Error(`Relação ${rid} da planilha "${aba}" não encontrada`);
  return alvo.startsWith('/') ? alvo.slice(1) : `xl/${alvo}`;
}

/** Insere os gráficos na planilha `aba` do .xlsx e devolve o arquivo novo. */
export async function inserirGraficos(xlsx: Buffer | ArrayBuffer, aba: string, graficos: Grafico[]): Promise<Buffer> {
  const zip = await JSZip.loadAsync(xlsx);
  if (!graficos.length) return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));

  const planilha = await caminhoDaAba(zip, aba);
  const proximo = (prefixo: string) => {
    const usados = Object.keys(zip.files).map(n => n.match(new RegExp(`^${prefixo}(\\d+)\\.xml$`))?.[1]).filter(Boolean).map(Number);
    return (usados.length ? Math.max(...usados) : 0) + 1;
  };
  const nDesenho = proximo('xl/drawings/drawing');
  const nGrafico = proximo('xl/charts/chart');

  // partes dos gráficos e do desenho
  graficos.forEach((g, i) => zip.file(`xl/charts/chart${nGrafico + i}.xml`, xmlGrafico(g)));
  zip.file(`xl/drawings/drawing${nDesenho}.xml`, xmlDesenho(graficos));
  zip.file(`xl/drawings/_rels/drawing${nDesenho}.xml.rels`,
    relacoes(graficos.map((_, i) => ({ id: `rId${i + 1}`, tipo: REL_CHART, alvo: `../charts/chart${nGrafico + i}.xml` }))));

  // relação planilha → desenho
  const nomeRels = planilha.replace(/([^/]+)$/, '_rels/$1.rels');
  const idDesenho = 'rIdGraficos1';
  const relExistente = zip.file(nomeRels) ? await zip.file(nomeRels)!.async('string') : null;
  const novaRel = `<Relationship Id="${idDesenho}" Type="${REL_DRAWING}" Target="../drawings/drawing${nDesenho}.xml"/>`;
  zip.file(nomeRels, relExistente ? relExistente.replace('</Relationships>', `${novaRel}</Relationships>`)
    : relacoes([{ id: idDesenho, tipo: REL_DRAWING, alvo: `../drawings/drawing${nDesenho}.xml` }]));

  // <drawing r:id> na posição certa da planilha
  let xml = await zip.file(planilha)!.async('string');
  if (xml.includes('<drawing ')) throw new Error(`A planilha "${aba}" já tem um desenho`);
  if (!/<worksheet\b[^>]*xmlns:r=/.test(xml)) xml = xml.replace('<worksheet', `<worksheet xmlns:r="${NS_R}"`);
  const pos = Math.min(...DEPOIS_DO_DESENHO.map(t => xml.indexOf(t)).filter(i => i >= 0));
  xml = `${xml.slice(0, pos)}<drawing r:id="${idDesenho}"/>${xml.slice(pos)}`;
  zip.file(planilha, xml);

  // tipos de conteúdo
  let tipos = await zip.file('[Content_Types].xml')!.async('string');
  const overrides = [`<Override PartName="/xl/drawings/drawing${nDesenho}.xml" ContentType="${CT_DRAWING}"/>`,
    ...graficos.map((_, i) => `<Override PartName="/xl/charts/chart${nGrafico + i}.xml" ContentType="${CT_CHART}"/>`)].join('');
  tipos = tipos.replace('</Types>', `${overrides}</Types>`);
  zip.file('[Content_Types].xml', tipos);

  return Buffer.from(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
}

/** Paleta do painel (mesma ordem do tema claro). */
export const PALETA = ['2A78D6', 'EB6834', '1BAF7A', 'EDA100', 'E87BA4', '008300', '6250D6', 'E34948'];
