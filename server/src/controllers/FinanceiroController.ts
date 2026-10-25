import type { Request, Response } from 'express';
import { ConfigService } from '../services/config.service';
import { FinanceiroAnalytics } from '../services/financeiro-analytics.service';
import { SyncService } from '../services/sync.service';
import type { Agrupamento, FinanceiroResponse } from '../types';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const param = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

export const FinanceiroController = {
  /** GET /api/financeiro?from&to&obra&agrupar=mes|semana&forcar=1 */
  async dashboard(req: Request, res: Response): Promise<void> {
    const hoje = new Date();
    // padrão: 12 meses até hoje + 2 meses à frente (vencimentos futuros a pagar/receber)
    const from = param(req.query.from) ?? iso(new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() - 11, 1)));
    const to = param(req.query.to) ?? iso(new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() + 3, 0)));
    const agrupar: Agrupamento = req.query.agrupar === 'semana' ? 'semana' : 'mes';

    // lê até 30 dias à frente de hoje mesmo que o filtro termine antes ("próximos vencimentos")
    const em30 = iso(new Date(hoje.getTime() + 30 * 864e5));
    const { dados, aviso, atualizado } = await SyncService.obterFinanceiro(from, to > em30 ? to : em30, req.query.forcar === '1');

    const body: FinanceiroResponse = {
      mock: ConfigService.mock(),
      aviso, atualizado, agrupar, de: from, ate: to,
      ...FinanceiroAnalytics.dashboard(dados, { from, to, obraId: param(req.query.obra), agrupar }),
    };
    res.json(body);
  },
};
