// Cota diária de requisições à API do Sienge: contagem local (por dia) + cabeçalhos de rate limit da API.
import { UsoApiModel } from '../models/UsoApiModel';
import { ConfigService } from './config.service';
import type { QuotaInfo } from '../types';

export class QuotaEsgotada extends Error {
  constructor(usadas: number, limite: number) {
    super(`Cota diária da API do Sienge atingida (${usadas}/${limite}). Usando os dados já salvos.`);
  }
}

export const QuotaService = {
  info(): QuotaInfo {
    const limite = ConfigService.efetiva().limiteDiario;
    const hoje = UsoApiModel.hoje();
    return {
      dia: hoje.dia,
      usadas: hoje.requisicoes,
      erros: hoje.erros,
      limite,
      restante: limite ? Math.max(0, limite - hoje.requisicoes) : null,
      pct: limite ? Math.min(100, Math.round((hoje.requisicoes / limite) * 100)) : 0,
      headers: hoje.headers,
      serie: UsoApiModel.ultimosDias(14).map(u => ({ dia: u.dia, requisicoes: u.requisicoes, erros: u.erros })),
    };
  },

  /** Lança QuotaEsgotada se o limite diário configurado já foi consumido. */
  garantir(): void {
    const { limite, usadas } = this.info();
    if (limite && usadas >= limite) throw new QuotaEsgotada(usadas, limite);
  },

  registrar(res: Response | null, erro: boolean): void {
    const headers: Record<string, string> = {};
    res?.headers.forEach((v, k) => { if (/rate-?limit|quota|retry-after/i.test(k)) headers[k] = v; });
    UsoApiModel.registrar({ erro, headers });
  },
};
