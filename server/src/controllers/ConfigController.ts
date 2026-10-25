import type { Request, Response } from 'express';
import { ConfigService } from '../services/config.service';
import { QuotaService } from '../services/quota.service';
import { SiengeService } from '../services/sienge.service';
import { SyncService } from '../services/sync.service';
import type { ConfigEntrada } from '../types';

const corpo = (req: Request): ConfigEntrada => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' ? v : undefined);
  return {
    usarMock: typeof b.usarMock === 'boolean' ? b.usarMock : undefined,
    subdominio: s(b.subdominio),
    usuario: s(b.usuario),
    senha: s(b.senha),
    endpointConsumo: s(b.endpointConsumo),
    limiteDiario: typeof b.limiteDiario === 'number' ? b.limiteDiario : undefined,
  };
};

export const ConfigController = {
  obter(_req: Request, res: Response): void {
    res.json(ConfigService.publica());
  },

  salvar(req: Request, res: Response): void {
    ConfigService.salvar(corpo(req));
    SyncService.invalidar();
    res.json(ConfigService.publica());
  },

  async testar(req: Request, res: Response): Promise<void> {
    res.json(await SiengeService.testar(ConfigService.simular(corpo(req))));
  },

  quota(_req: Request, res: Response): void {
    res.json(QuotaService.info());
  },
};
