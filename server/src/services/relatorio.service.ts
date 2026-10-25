// Leitura dos relatórios em PDF exportados do Sienge. Usa o pdf.js (posição de cada texto) para
// separar as colunas com segurança, inclusive nomes de insumo que quebram em mais de uma linha.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { ItemApropriacao, RelatorioApropriacoes } from '../types';

interface Token { str: string; x: number }
interface Linha { y: number; tokens: Token[] }

// limites de coluna (em pontos do PDF) do relatório "Curva ABC de Apropriações"
const X_UN_MIN = 225;
const X_NUM_MIN = 262;

const NUMERO = /^-?\d{1,3}(?:\.\d{3})*,\d+$|^-?\d+,\d+$/;
const num = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));
const dataISO = (br: string) => br.split('/').reverse().join('-');

async function linhasDoPdf(buf: Buffer): Promise<Linha[][]> {
  const pdf = await getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false }).promise;
  const paginas: Linha[][] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const tc = await (await pdf.getPage(n)).getTextContent();
    const linhas: Linha[] = [];
    for (const it of tc.items) {
      if (!('str' in it) || !it.str) continue;
      const y = it.transform[5] as number;
      const x = it.transform[4] as number;
      const l = linhas.find(l => Math.abs(l.y - y) <= 2);
      if (l) l.tokens.push({ str: it.str, x }); else linhas.push({ y, tokens: [{ str: it.str, x }] });
    }
    linhas.sort((a, b) => b.y - a.y).forEach(l => l.tokens.sort((a, b) => a.x - b.x));
    paginas.push(linhas);
  }
  return paginas;
}

const textoDe = (l: Linha) => l.tokens.map(t => t.str).join('');

export const RelatorioService = {
  async lerApropriacoes(buf: Buffer): Promise<RelatorioApropriacoes> {
    const paginas = await linhasDoPdf(buf);
    const todas = paginas.flat();
    if (!todas.some(l => /Curva ABC de Apropria/i.test(textoDe(l))))
      throw new Error('Relatório não reconhecido. O painel importa hoje o relatório "Curva ABC de Apropriações" do Sienge (PDF).');

    const avisos: string[] = [];
    let de = '', ate = '';
    let totalGeral: number | null = null;
    const itens: ItemApropriacao[] = [];

    for (const l of todas) {
      const txt = textoDe(l).trim();
      const per = txt.match(/Per[ií]odo\s*(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/);
      if (per) { de = dataISO(per[1]); ate = dataISO(per[2]); continue; }
      if (/^Total geral/i.test(txt)) {
        const n = l.tokens.map(t => t.str.trim()).filter(s => NUMERO.test(s));
        if (n.length) totalGeral = num(n[n.length - 1]);
        continue;
      }
      if (/SIENGE/.test(txt) || /^\d{2}\/\d{2}\/\d{4} - \d{2}:\d{2}/.test(txt)) continue; // rodapé
      if (/^Insumo/.test(txt) && /Quantidade/.test(txt)) continue; // cabeçalho da tabela
      if (/Curva ABC de Apropria/i.test(txt)) continue;

      const numeros = l.tokens.filter(t => t.x >= X_NUM_MIN && NUMERO.test(t.str.trim())).map(t => num(t.str.trim()));
      const nome = l.tokens.filter(t => t.x < X_UN_MIN).map(t => t.str).join('').trim();
      const un = l.tokens.filter(t => t.x >= X_UN_MIN && t.x < X_NUM_MIN && t.str.trim()).map(t => t.str.trim()).join(' ');

      if (numeros.length === 5) {
        const m = nome.match(/^(\d+)\s*-\s*(.*)$/s);
        itens.push({
          insumoId: m ? m[1] : nome, insumo: (m ? m[2] : nome).trim(), un,
          qtd: numeros[0], precoMedio: numeros[1], total: numeros[2], participacao: numeros[3], acumulado: numeros[4],
        });
      } else if (nome && !numeros.length && itens.length) {
        itens[itens.length - 1].insumo += ' ' + nome; // continuação do nome na linha seguinte
      } else if (nome || numeros.length) {
        avisos.push(`Linha ignorada: "${txt.slice(0, 80)}"`);
      }
    }

    if (!de || !ate) throw new Error('Não encontrei o período do relatório no PDF.');
    if (!itens.length) throw new Error('Nenhum insumo encontrado no PDF.');

    const somaItens = Math.round(itens.reduce((a, i) => a + i.total, 0) * 100) / 100;
    const confere = totalGeral != null && Math.abs(somaItens - totalGeral) < 1;
    if (totalGeral == null) avisos.push('O relatório não traz "Total geral"; não foi possível conferir a soma.');
    else if (!confere) avisos.push(`A soma dos itens (${somaItens}) difere do total geral do relatório (${totalGeral}).`);

    return { tipo: 'curva-abc-apropriacoes', de, ate, itens, totalGeral, somaItens, confere, avisos };
  },
};
