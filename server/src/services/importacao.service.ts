// Importação de relatórios em PDF: prévia (nada é gravado) -> confirmação (grava e é desfazível).
import crypto from 'node:crypto';
import { transacao } from '../models/db';
import { DadosModel } from '../models/DadosModel';
import { ImportacaoModel } from '../models/ImportacaoModel';
import { ConfigService } from './config.service';
import { distribuirConsumo } from './distribuicao';
import { RelatorioService } from './relatorio.service';
import type {
  ImportConfirmacao, ImportListagem, ImportPreview, ImportResultado, RelatorioApropriacoes,
} from '../types';

const TITULO = 'Curva ABC de Apropriações';
const VALIDADE_MS = 30 * 60 * 1000;
const pendentes = new Map<string, { rel: RelatorioApropriacoes; arquivo: string; exp: number }>();

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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

    const linhas = distribuirConsumo(rel.itens, rel.de, rel.ate, obra, c.distribuir);

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
