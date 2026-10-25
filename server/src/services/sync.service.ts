// Orquestra Sienge -> SQLite -> painel. Em modo demonstração lê direto do mock (nada é gravado).
import { env } from '../config/env';
import { transacao } from '../models/db';
import { DadosModel } from '../models/DadosModel';
import { SincronizacaoModel } from '../models/SincronizacaoModel';
import { ConfigService } from './config.service';
import { MockService } from './mock.service';
import { SiengeService } from './sienge.service';
import { BULK_POR_SYNC, FinanceiroService, janelaFinanceira } from './financeiro.service';
import { FinanceiroModel } from '../models/FinanceiroModel';
import { QuotaService } from './quota.service';
import type { Dados, DadosFinanceiros } from '../types';

const sincronizado = new Map<string, number>(); // "de|ate" -> timestamp
const emAndamento = new Map<string, Promise<string | null>>(); // uma sincronização por período, sem duplicar chamadas
const avisos = new Map<string, string | null>(); // "de|ate" -> aviso da última tentativa

let finEmAndamento: Promise<string | null> | null = null;
let finTentativa = 0;          // evita repetir tentativas que falharam a cada clique
let finAviso: string | null = null;

export interface Resultado { dados: Dados; aviso: string | null }
export interface ResultadoFinanceiro { dados: DadosFinanceiros; aviso: string | null; atualizado: string | null }

export const SyncService = {
  /** Força nova busca no Sienge na próxima consulta (ex.: depois de mudar as credenciais). */
  invalidar(): void {
    sincronizado.clear();
    avisos.clear();
    finTentativa = 0;
    finAviso = null;
  },

  async obterDados(de: string, ate: string, forcar = false): Promise<Resultado> {
    if (ConfigService.mock()) return { dados: MockService.carregar(), aviso: null };
    if (!ConfigService.completa()) return { dados: DadosModel.ler(de, ate), aviso: null }; // só dados locais (relatórios importados)

    const k = `${de}|${ate}`;
    if (forcar || Date.now() - (sincronizado.get(k) ?? 0) > env.cacheMs) {
      let p = emAndamento.get(k);
      if (!p) {
        p = SiengeService.carregar(de, ate)
          .then(({ dados, pedidos, pendentes }) => {
            // grava mesmo parcial: os itens já baixados ficam guardados e a próxima sincronização completa o resto
            transacao(() => {
              DadosModel.substituirPeriodo(dados, de, ate);
              SincronizacaoModel.registrar(dados, de, ate);
            });
            return pendentes
              ? `Sincronização parcial: itens de ${pedidos - pendentes} de ${pedidos} pedidos baixados. `
                + 'A cota diária da API acabou; o restante é buscado nas próximas sincronizações.'
              : null;
          })
          .finally(() => { emAndamento.delete(k); });
        emAndamento.set(k, p);
      }
      try {
        avisos.set(k, await p);
      } catch (e) {
        // Sienge fora do ar, cota esgotada ou credencial inválida: segue com o histórico já salvo (ou vazio)
        const msg = (e as Error).message;
        console.warn('[sync] falhou, usando histórico local:', msg);
        avisos.set(k, SincronizacaoModel.ultima() ? msg : `${msg.replace(/ Usando os dados já salvos\.$/, '')} Ainda não há dados salvos do Sienge.`);
      }
      sincronizado.set(k, Date.now()); // não insiste a cada clique; tenta de novo quando o cache vencer ou no "↻ Sienge"
    }
    return { dados: DadosModel.ler(de, ate), aviso: avisos.get(k) ?? null };
  },

  /**
   * Financeiro: sincroniza a janela fixa (janelaFinanceira) e lê do SQLite o período pedido.
   * Intervalo entre sincronizações conforme a cota bulk do plano (Free: 10/dia → a cada ~7h; planos maiores: o cache normal).
   */
  async obterFinanceiro(de: string, ate: string, forcar = false): Promise<ResultadoFinanceiro> {
    if (ConfigService.mock()) return { dados: MockService.financeiro(), aviso: null, atualizado: null };
    const obras = DadosModel.obras();
    if (!ConfigService.completa()) return { dados: FinanceiroModel.ler(de, ate, obras), aviso: null, atualizado: FinanceiroModel.ultima() };

    const limiteBulk = QuotaService.info().bulkLimite;
    const intervalo = Math.max(env.cacheMs, limiteBulk ? (24 * 3600_000 * BULK_POR_SYNC) / limiteBulk : 0);
    const ultima = FinanceiroModel.ultima();
    const venceu = !ultima || Date.now() - new Date(ultima).getTime() > intervalo;

    if ((forcar || venceu) && Date.now() - finTentativa > 60_000) {
      finTentativa = Date.now();
      if (!finEmAndamento) {
        finEmAndamento = (async () => {
          if (QuotaService.disponivelBulk() < BULK_POR_SYNC)
            return 'Cota diária bulk-data do Sienge esgotada: o financeiro mostra a última sincronização.';
          const j = janelaFinanceira();
          const { dados, erros } = await FinanceiroService.sincronizar(j);
          FinanceiroModel.salvar(dados, j); // grava também com erros: a próxima tentativa espera o intervalo
          // obras que só aparecem no financeiro entram no filtro de obra
          const conhecidas = new Set(obras.map(o => o.id));
          [...(dados.pagar ?? []), ...(dados.movimentos ?? [])].flatMap(r => r.obras)
            .filter(o => o.nome && !conhecidas.has(o.id) && conhecidas.add(o.id))
            .forEach(o => DadosModel.garantirObra({ id: o.id, nome: o.nome }));
          return erros.length ? `Parte do financeiro não veio do Sienge — ${erros.join(' · ')}` : null;
        })()
          .catch(e => `${(e as Error).message}`)
          .finally(() => { finEmAndamento = null; });
      }
      finAviso = await finEmAndamento;
    }
    return { dados: FinanceiroModel.ler(de, ate, DadosModel.obras()), aviso: finAviso, atualizado: FinanceiroModel.ultima() };
  },
};
