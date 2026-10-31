import type { Request, Response } from 'express';
import { ExportacaoService, SECOES, type OpcoesExportacao, type Secao } from '../services/exportacao.service';

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Lê e valida os parâmetros da exportação (datas AAAA-MM-DD, seções conhecidas). */
export function lerOpcoes(q: Request['query']): OpcoesExportacao {
  const from = texto(q.from);
  const to = texto(q.to);
  if ((from && !DATA.test(from)) || (to && !DATA.test(to))) throw Object.assign(new Error('Datas no formato AAAA-MM-DD'), { status: 400 });
  if (from && to && from > to) throw Object.assign(new Error('A data inicial é depois da final'), { status: 400 });
  const pedidas = texto(q.secoes).split(',').map(s => s.trim()).filter(Boolean);
  const secoes = (pedidas.length ? pedidas : [...SECOES]).filter((s): s is Secao => (SECOES as readonly string[]).includes(s));
  if (!secoes.length) throw Object.assign(new Error('Escolha ao menos uma seção'), { status: 400 });
  return { from, to, obraId: texto(q.obra) || undefined, secoes, graficos: q.graficos === '1' };
}

export const ExportarController = {
  /** GET /api/exportar/excel?from&to&obra&secoes=geral,compras,fornecedores,custos,resultado&graficos=1 */
  async excel(req: Request, res: Response): Promise<void> {
    const { buffer, nome } = await ExportacaoService.excel(lerOpcoes(req.query));
    const ascii = nome.normalize('NFD').replace(/[^\x20-\x7e]/g, '');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  },
};
