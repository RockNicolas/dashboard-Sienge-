// Cota diária de requisições à API do Sienge: contagem local (por dia) + cabeçalhos de rate limit da API.
import { UsoApiModel } from '../models/UsoApiModel';
import { ConfigService } from './config.service';
import { limiteDaApi, planoPorId, planoPorLimite } from './planos';
import type { QuotaInfo, VerificacaoPlano } from '../types';

const fmt = (n: number) => n.toLocaleString('pt-BR');

export class QuotaEsgotada extends Error {
  constructor(usadas: number, limite: number, bulk = false) {
    super(`Cota diária ${bulk ? 'bulk-data ' : ''}da API do Sienge atingida (${usadas}/${limite}). Usando os dados já salvos.`);
  }
}

const limiteBulk = () => planoPorId(ConfigService.efetiva().plano)?.bulk ?? 0;

export const QuotaService = {
  info(): QuotaInfo {
    const limite = ConfigService.efetiva().limiteDiario;
    const hoje = UsoApiModel.hoje();
    return {
      conectado: ConfigService.completa(),
      dia: hoje.dia,
      usadas: hoje.requisicoes,
      erros: hoje.erros,
      limite,
      restante: limite ? Math.max(0, limite - hoje.requisicoes) : null,
      pct: limite ? Math.min(100, Math.round((hoje.requisicoes / limite) * 100)) : 0,
      bulkUsadas: hoje.bulk,
      bulkLimite: limiteBulk(),
      headers: hoje.headers,
      plano: this.verificarPlano(),
      serie: UsoApiModel.ultimosDias(14).map(u => ({ dia: u.dia, requisicoes: u.requisicoes, erros: u.erros })),
    };
  },

  /** Compara o plano escolhido no painel com o limite diário que o Sienge informa nos cabeçalhos. */
  verificarPlano(planoId = ConfigService.efetiva().plano): VerificacaoPlano {
    const escolhido = planoPorId(planoId);
    const limiteApi = limiteDaApi(UsoApiModel.ultimosHeaders());
    const planoApi = planoPorLimite(limiteApi);
    const nomeApi = planoApi ? `plano ${planoApi.nome}` : 'nenhum plano conhecido';
    const base = { escolhido, limiteApi, planoApi };

    if (limiteApi == null)
      return { ...base, confere: null, mensagem: 'O Sienge ainda não informou o limite. Use "Testar conexão" para conferir o plano.' };
    if (!escolhido)
      return { ...base, confere: false, mensagem: `Selecione o plano: o Sienge informa ${fmt(limiteApi)} requisições/dia (${nomeApi}).` };
    if (escolhido.rest !== limiteApi)
      return {
        ...base, confere: false,
        mensagem: `O plano escolhido (${escolhido.nome}, ${fmt(escolhido.rest)}/dia) não confere com o Sienge, que informa ${fmt(limiteApi)}/dia (${nomeApi}).`,
      };
    return { ...base, confere: true, mensagem: `Plano ${escolhido.nome} confere com o Sienge (${fmt(limiteApi)} requisições/dia).` };
  },

  /** Requisições que a sincronização ainda pode gastar hoje, guardando uma reserva (ex.: "Testar conexão"). */
  disponivel(): number {
    const limite = ConfigService.efetiva().limiteDiario;
    if (!limite) return Infinity;
    const reserva = Math.max(5, Math.ceil(limite * 0.05));
    return Math.max(0, limite - UsoApiModel.hoje().requisicoes - reserva);
  },

  /** Requisições bulk-data que ainda cabem hoje (Infinity sem plano definido). */
  disponivelBulk(): number {
    const limite = limiteBulk();
    return limite ? Math.max(0, limite - UsoApiModel.hoje().bulk) : Infinity;
  },

  /** Lança QuotaEsgotada se o limite diário (REST ou bulk-data) já foi consumido. */
  garantir(bulk = false): void {
    if (bulk) {
      const limite = limiteBulk();
      const usadas = UsoApiModel.hoje().bulk;
      if (limite && usadas >= limite) throw new QuotaEsgotada(usadas, limite, true);
      return;
    }
    const limite = ConfigService.efetiva().limiteDiario;
    const usadas = UsoApiModel.hoje().requisicoes;
    if (limite && usadas >= limite) throw new QuotaEsgotada(usadas, limite);
  },

  registrar(res: Response | null, erro: boolean, bulk = false): void {
    const headers: Record<string, string> = {};
    res?.headers.forEach((v, k) => { if (/rate-?limit|quota|retry-after/i.test(k)) headers[k] = v; });
    UsoApiModel.registrar({ erro, headers, bulk });
  },
};
