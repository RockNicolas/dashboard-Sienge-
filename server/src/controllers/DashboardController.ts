import type { Request, Response } from 'express';
import { SincronizacaoModel } from '../models/SincronizacaoModel';
import { AnalyticsService } from '../services/analytics.service';
import { ComparativoService } from '../services/comparativo.service';
import { DadosModel } from '../models/DadosModel';
import { cobertura } from './ComparativoController';
import { ConfigService } from '../services/config.service';
import { QuotaService } from '../services/quota.service';
import { SyncConfigService } from '../services/sync-config.service';
import { SyncService } from '../services/sync.service';
import type { DashboardResponse } from '../types';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const param = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

export const DashboardController = {
  async dashboard(req: Request, res: Response): Promise<void> {
    const hoje = new Date();
    // sem datas no filtro: o período escolhido em Configurações (o que vem do Sienge) ou os últimos 12 meses
    const janela = ConfigService.mock() ? null : SyncConfigService.janela(hoje);
    const to = param(req.query.to) ?? janela?.ate ?? iso(hoje);
    const from = param(req.query.from) ?? janela?.de ?? iso(new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1));
    const { dados, aviso } = await SyncService.obterDados(from, to, req.query.forcar === '1');
    // com obras escolhidas, o filtro de obra do topo mostra só elas
    const escolhidas = janela ? SyncConfigService.obter()?.obras : null;
    // período anterior de mesmo tamanho, só do que já está salvo (setas ▲▼ dos cards)
    const ant = ComparativoService.periodoAnterior(from, to);
    const mock = ConfigService.mock();
    const anterior = ComparativoService.resumoAnterior(mock ? dados : DadosModel.ler(ant.de, ant.ate), ant, param(req.query.obra), cobertura().compras);

    const body: DashboardResponse = {
      mock: ConfigService.mock(),
      de: from, ate: to,
      janela,
      aviso,
      usuario: req.usuario ?? '',
      atualizado: SincronizacaoModel.ultima()?.em ?? new Date().toISOString(),
      obrasDisponiveis: escolhidas ? dados.obras.filter(o => escolhidas.includes(o.id)) : dados.obras,
      quota: QuotaService.info(),
      anterior,
      ...AnalyticsService.dashboard(dados, { from, to, obraId: param(req.query.obra) }),
    };
    res.json(body);
  },

  historico(_req: Request, res: Response): void {
    res.json(SincronizacaoModel.historico());
  },
};
