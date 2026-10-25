// Importação de relatórios em PDF: prévia (nada é gravado) -> confirmação (grava e é desfazível).
import crypto from 'node:crypto';
import { transacao } from '../models/db';
import { DadosModel } from '../models/DadosModel';
import { ImportacaoModel } from '../models/ImportacaoModel';
import { ConfigService } from './config.service';
import { RelatorioService } from './relatorio.service';
import type {
  Consumo, ImportConfirmacao, ImportListagem, ImportPreview, ImportResultado, RelatorioApropriacoes,
} from '../types';

const TITULO = 'Curva ABC de Apropriações';
const VALIDADE_MS = 30 * 60 * 1000;
const pendentes = new Map<string, { rel: RelatorioApropriacoes; arquivo: string; exp: number }>();

const r = (n: number, casas: number) => Math.round(n * 10 ** casas) / 10 ** casas;
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Dias do período por mês: [{ mes: 'AAAA-MM', dias, ultimo: 'AAAA-MM-DD' }] */
function mesesDoPeriodo(de: string, ate: string) {
  const out: { mes: string; dias: number; ultimo: string }[] = [];
  for (let d = new Date(`${de}T12:00:00Z`); d <= new Date(`${ate}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const mes = iso.slice(0, 7);
    const ult = out[out.length - 1];
    if (ult && ult.mes === mes) { ult.dias++; ult.ultimo = iso; } else out.push({ mes, dias: 1, ultimo: iso });
  }
  return out;
}

export const ImportacaoService = {
  async preview(buf: Buffer, arquivo: string): Promise<ImportPreview> {
    const rel = await RelatorioService.lerApropriacoes(buf);
    for (const [k, v] of pendentes) if (v.exp < Date.now()) pendentes.delete(k);
    const token = crypto.randomBytes(16).toString('hex');
    pendentes.set(token, { rel, arquivo, exp: Date.now() + VALIDADE_MS });
    return {
      token, arquivo, tipo: rel.tipo, tituloTipo: TITULO, de: rel.de, ate: rel.ate,
      linhas: rel.itens.length, totalGeral: rel.totalGeral, somaItens: rel.somaItens, confere: rel.confere,
      avisos: rel.avisos, amostra: rel.itens.slice(0, 8),
    };
  },

  confirmar(c: ImportConfirmacao): ImportResultado {
    const p = pendentes.get(c.token);
    if (!p || p.exp < Date.now()) throw new Error('A prévia expirou. Envie o PDF novamente.');
    const { rel } = p;

    // obra de destino: existente ou nova
    let obra = c.obraId ? DadosModel.obras().find(o => o.id === c.obraId) : undefined;
    if (!obra) {
      const nome = (c.obraNova ?? '').trim();
      if (!nome) throw new Error('Escolha a obra deste relatório ou informe o nome de uma obra nova.');
      obra = DadosModel.obras().find(o => o.nome.toLowerCase() === nome.toLowerCase()) ?? { id: `rel-${slug(nome)}`, nome };
    }

    // distribui por mês (proporcional aos dias) ou lança tudo no fim do período
    const partes = c.distribuir ? mesesDoPeriodo(rel.de, rel.ate) : [{ mes: rel.ate.slice(0, 7), dias: 1, ultimo: rel.ate }];
    const totalDias = partes.reduce((a, m) => a + m.dias, 0);
    const linhas: Consumo[] = [];
    for (const it of rel.itens) {
      let qRest = it.qtd, vRest = it.total;
      partes.forEach((m, i) => {
        const ultimo = i === partes.length - 1;
        const q = ultimo ? r(qRest, 4) : r(it.qtd * m.dias / totalDias, 4);
        const v = ultimo ? r(vRest, 2) : r(it.total * m.dias / totalDias, 2);
        qRest -= q; vRest -= v;
        if (q || v) linhas.push({
          data: m.ultimo, obraId: obra.id, obra: obra.nome,
          insumoId: it.insumoId, insumo: it.insumo, un: it.un, qtd: q, valor: v,
        });
      });
    }

    let substituiu = null as ImportResultado['substituiu'];
    let importacao!: ImportResultado['importacao'];
    transacao(() => {
      substituiu = ImportacaoModel.mesmoPeriodo(rel.tipo, obra.id, rel.de, rel.ate) ?? null;
      if (substituiu) { DadosModel.removerOrigem(`rel:${substituiu.id}`); ImportacaoModel.excluir(substituiu.id); }
      DadosModel.garantirObra(obra);
      importacao = ImportacaoModel.criar({
        tipo: rel.tipo, arquivo: p.arquivo, obraId: obra.id, obra: obra.nome, de: rel.de, ate: rel.ate,
        linhas: rel.itens.length, total: rel.somaItens, distribuido: c.distribuir,
      });
      DadosModel.adicionarConsumos(linhas, `rel:${importacao.id}`);
    });
    pendentes.delete(c.token);

    // com dados importados o painel deixa de mostrar a demonstração
    const demoDesativado = ConfigService.efetiva().usarMock;
    if (demoDesativado) ConfigService.salvar({ usarMock: false });
    return { importacao, substituiu, demoDesativado };
  },

  listar(): ImportListagem {
    return { importacoes: ImportacaoModel.listar(), obras: DadosModel.obras() };
  },

  excluir(id: number): void {
    if (!ImportacaoModel.obter(id)) throw new Error('Importação não encontrada.');
    transacao(() => { DadosModel.removerOrigem(`rel:${id}`); ImportacaoModel.excluir(id); });
  },
};
