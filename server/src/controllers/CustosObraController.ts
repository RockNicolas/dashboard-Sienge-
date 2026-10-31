import type { Request, Response } from 'express';
import { CustosObraService } from '../services/custos-obra.service';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const param = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

export const CustosObraController = {
  /** GET /api/custos-obra?from&to&obra&forcar=1 — orçado × pendente × atendido por obra (Insumos da Obra do Sienge). */
  async custos(req: Request, res: Response): Promise<void> {
    const hoje = new Date();
    const to = param(req.query.to) ?? iso(hoje);
    const from = param(req.query.from) ?? iso(new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1));
    res.json(await CustosObraService.obter({ from, to, obraId: param(req.query.obra) }, req.query.forcar === '1'));
  },
};
