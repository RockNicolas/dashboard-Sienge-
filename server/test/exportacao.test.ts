// Exportação: gráficos nativos do Excel (DrawingML) injetados no .xlsx e validação dos parâmetros.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { esc, inserirGraficos, xmlGrafico, type Grafico } from '../src/services/excel-graficos';
import { lerOpcoes } from '../src/controllers/ExportarController';
import { periodos } from '../src/services/exportacao.service';

const base = (o: Partial<Grafico> = {}): Grafico => ({
  tipo: 'colunas', titulo: 'Compras & obras <teste>', formato: '"R$" #,##0',
  categorias: { ref: "'Dados dos gráficos'!$A$3:$A$4", valores: ['jan/26', 'fev/26'] },
  series: [{ nome: 'Comprado', ref: "'Dados dos gráficos'!$B$3:$B$4", valores: [100, 250.5], cor: '2A78D6' }],
  ancora: { col: 0, lin: 9, ateCol: 6, ateLin: 26 },
  ...o,
});

/** Posição de cada trecho no XML: a ordem tem que seguir o schema do Office. */
const ordem = (xml: string, ...trechos: string[]) => trechos.map(t => {
  const i = xml.indexOf(t);
  assert.ok(i >= 0, `faltou ${t}`);
  return i;
});
const crescente = (l: number[]) => l.every((v, i) => !i || v > l[i - 1]);

test('gráfico de colunas: elementos na ordem do schema, título escapado e cache de valores', () => {
  const x = xmlGrafico(base());
  assert.ok(crescente(ordem(x, '<c:barDir val="col"/>', '<c:grouping val="clustered"/>', '<c:varyColors', '<c:ser>', '<c:gapWidth', '<c:axId val="5001"/>', '<c:catAx>', '<c:valAx>')));
  const serie = x.slice(x.indexOf('<c:ser>'), x.indexOf('</c:ser>'));
  assert.ok(crescente(ordem(serie, '<c:idx', '<c:order', '<c:tx>', '<c:spPr>', '<c:invertIfNegative', '<c:cat>', '<c:val>')));
  assert.ok(x.includes('Compras &amp; obras &lt;teste&gt;'));
  assert.ok(x.includes(`<c:f>${esc("'Dados dos gráficos'!$B$3:$B$4")}</c:f>`));
  assert.ok(x.includes('<c:pt idx="1"><c:v>250.5</c:v></c:pt>'));
  assert.ok(!x.includes('<c:legend>'), 'série única não precisa de legenda');
});

test('barras horizontais, pizza com % nas fatias e linhas', () => {
  const barras = xmlGrafico(base({ tipo: 'barras' }));
  assert.ok(barras.includes('<c:barDir val="bar"/>') && barras.includes('<c:axPos val="l"/>'));
  const pizza = xmlGrafico(base({ tipo: 'pizza', rotulos: true }));
  assert.ok(pizza.includes('<c:pieChart><c:varyColors val="1"/>') && !pizza.includes('<c:catAx>'));
  assert.ok(crescente(ordem(pizza, '<c:dPt>', '<c:dLbls>', '<c:showPercent val="1"/>', '<c:cat>')));
  const linhas = xmlGrafico(base({ tipo: 'linhas', rotulos: true }));
  assert.ok(crescente(ordem(linhas, '<c:lineChart>', '<c:marker>', '<c:dLblPos val="t"/>', '<c:smooth val="0"/>', '<c:marker val="1"/>')));
});

test('injeta gráficos no .xlsx: partes, relações, tipos de conteúdo e <drawing> no lugar certo', async () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Outra').getCell('A1').value = 1;
  const ws = wb.addWorksheet('Dashboard');
  ws.getCell('A1').value = 'Relatório';
  const original = Buffer.from(await wb.xlsx.writeBuffer());
  const saida = await inserirGraficos(original, 'Dashboard', [base(), base({ tipo: 'pizza', titulo: 'Pizza' })]);

  const zip = await JSZip.loadAsync(saida);
  assert.ok(zip.file('xl/charts/chart1.xml') && zip.file('xl/charts/chart2.xml') && zip.file('xl/drawings/drawing1.xml'));
  const tipos = await zip.file('[Content_Types].xml')!.async('string');
  assert.ok(tipos.includes('/xl/charts/chart2.xml') && tipos.includes('/xl/drawings/drawing1.xml'));
  const rels = await zip.file('xl/worksheets/_rels/sheet2.xml.rels')!.async('string');
  assert.ok(rels.includes('../drawings/drawing1.xml'));
  const planilha = await zip.file('xl/worksheets/sheet2.xml')!.async('string');
  assert.ok(/<drawing r:id="rIdGraficos1"\/><\/worksheet>|<drawing r:id="rIdGraficos1"\/><(tableParts|extLst)/.test(planilha));
  assert.ok(!(await zip.file('xl/worksheets/sheet1.xml')!.async('string')).includes('<drawing'), 'a outra aba não muda');
  const desenho = await zip.file('xl/drawings/_rels/drawing1.xml.rels')!.async('string');
  assert.ok(desenho.includes('../charts/chart1.xml') && desenho.includes('../charts/chart2.xml'));

  // o ExcelJS ainda consegue abrir o arquivo
  const relido = new ExcelJS.Workbook();
  await relido.xlsx.load(saida.buffer.slice(saida.byteOffset, saida.byteOffset + saida.byteLength) as ArrayBuffer);
  assert.equal(relido.getWorksheet('Dashboard')!.getCell('A1').value, 'Relatório');
});

test('aba inexistente dá erro claro', async () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('A');
  await assert.rejects(inserirGraficos(Buffer.from(await wb.xlsx.writeBuffer()), 'Dashboard', [base()]), /Dashboard/);
});

test('parâmetros da exportação: datas, seções e gráficos', () => {
  assert.deepEqual(lerOpcoes({ from: '2026-10-01', to: '2026-10-31', obra: '2', secoes: 'compras,xyz,fornecedores', graficos: '1' }),
    { from: '2026-10-01', to: '2026-10-31', obraId: '2', secoes: ['compras', 'fornecedores'], graficos: true });
  assert.deepEqual(lerOpcoes({}).secoes, ['geral', 'compras', 'fornecedores', 'custos', 'resultado']);
  assert.throws(() => lerOpcoes({ from: '31/10/2026' }), /AAAA-MM-DD/);
  assert.throws(() => lerOpcoes({ from: '2026-11-01', to: '2026-10-01' }), /depois da final/);
  assert.throws(() => lerOpcoes({ secoes: 'xyz' }), /ao menos uma/);
});

test('período padrão igual ao das telas: compras até hoje, financeiro até 2 meses à frente', () => {
  const p = periodos({}, new Date(2026, 9, 31, 12));
  assert.deepEqual(p.compras, { from: '2025-11-01', to: '2026-10-31' });
  assert.deepEqual(p.financeiro, { from: '2025-11-01', to: '2026-12-31' });
  assert.deepEqual(periodos({ from: '2026-01-01', to: '2026-03-31' }).financeiro, { from: '2026-01-01', to: '2026-03-31' });
});
