import type { Request, Response } from 'express';
import { SincronizacaoModel } from '../models/SincronizacaoModel';
import { AnalyticsService } from '../services/analytics.service';
import { ConfigService } from '../services/config.service';
import { QuotaService } from '../services/quota.service';
import { SyncService } from '../services/sync.service';
import type { DashboardResponse } from '../types';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const param = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

export const DashboardController = {
  async dashboard(req: Request, res: Response): Promise<void> {
    const hoje = new Date();
    const to = param(req.query.to) ?? iso(hoje);
    const from = param(req.query.from) ?? iso(new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1));
    const { dados, aviso } = await SyncService.obterDados(from, to, req.query.forcar === '1');

    const body: DashboardResponse = {
      mock: ConfigService.mock(),
      aviso,
      usuario: req.usuario ?? '',
      atualizado: SincronizacaoModel.ultima()?.em ?? new Date().toISOString(),
      obrasDisponiveis: dados.obras,
      quota: QuotaService.info(),
      ...AnalyticsService.dashboard(dados, { from, to, obraId: param(req.query.obra) }),
    };
    res.json(body);
  },

  historico(_req: Request, res: Response): void {
    res.json(SincronizacaoModel.historico());
  },
};
