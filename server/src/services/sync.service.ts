// Orquestra Sienge -> SQLite -> painel. Em modo demonstração lê direto do mock (nada é gravado).
import { env } from '../config/env';
import { transacao } from '../models/db';
import { DadosModel } from '../models/DadosModel';
import { SincronizacaoModel } from '../models/SincronizacaoModel';
import { ConfigService } from './config.service';
import { MockService } from './mock.service';
import { SiengeService } from './sienge.service';
import type { Dados } from '../types';

const sincronizado = new Map<string, number>(); // "de|ate" -> timestamp
let emAndamento: Promise<void> | null = null;

export const SyncService = {
  /** Força nova busca no Sienge na próxima consulta (ex.: depois de mudar as credenciais). */
  invalidar(): void {
    sincronizado.clear();
  },

  async obterDados(de: string, ate: string, forcar = false): Promise<Dados> {
    if (ConfigService.mock()) return MockService.carregar();
    if (!ConfigService.completa()) return DadosModel.ler(de, ate); // só dados locais (relatórios importados)

    const k = `${de}|${ate}`;
    if (forcar || Date.now() - (sincronizado.get(k) ?? 0) > env.cacheMs) {
      emAndamento ??= SiengeService.carregar(de, ate)
        .then(d => {
          transacao(() => {
            DadosModel.substituirPeriodo(d, de, ate);
            SincronizacaoModel.registrar(d, de, ate);
          });
          sincronizado.set(k, Date.now());
        })
        .finally(() => { emAndamento = null; });
      try {
        await emAndamento;
      } catch (e) {
        // Sienge fora do ar, cota esgotada ou credencial inválida: segue com o histórico já salvo
        console.warn('[sync] falhou, usando histórico local:', (e as Error).message);
        sincronizado.set(k, Date.now()); // não insiste a cada clique
        if (!SincronizacaoModel.ultima()) throw e;
      }
    }
    return DadosModel.ler(de, ate);
  },
};
