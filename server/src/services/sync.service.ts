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
import { janelaSync, SyncConfigService } from './sync-config.service';
import type { Dados, DadosFinanceiros } from '../types';

const diaLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dataBR = (iso: string) => iso.split('-').reverse().join('/');

// O financeiro usa no máximo esta parte da cota bulk-data do dia; o resto fica para os Insumos da Obra (custos por obra).
const PARTE_BULK_FINANCEIRO = 0.5;

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

    // Com a escolha feita em Configurações (O que puxar do Sienge), o Sienge só é consultado no período e nas obras
    // escolhidos; o filtro da tela lê o que já veio. Sem escolha, sincroniza o próprio período do filtro (como antes).
    const escolha = SyncConfigService.obter();
    const alvo = escolha ? janelaSync(escolha) : { de, ate };
    const op = { obras: escolha?.obras ?? null, fornecedores: escolha?.fornecedores ?? true };
    const k = `${alvo.de}|${alvo.ate}|${op.obras?.join(',') ?? '*'}|${op.fornecedores ? 1 : 0}`;
    if (forcar || Date.now() - (sincronizado.get(k) ?? 0) > env.cacheMs) {
      let p = emAndamento.get(k);
      if (!p) {
        p = SiengeService.carregar(alvo.de, alvo.ate, op)
          .then(({ dados, pedidos, pendentes, avisos: extras }) => {
            // grava mesmo parcial: os itens já baixados ficam guardados e a próxima sincronização completa o resto
            transacao(() => {
              DadosModel.substituirPeriodo(dados, alvo.de, alvo.ate);
              SincronizacaoModel.registrar(dados, alvo.de, alvo.ate);
            });
            const msgs = [
              ...(pendentes
                ? [`Sincronização parcial: itens de ${pedidos - pendentes} de ${pedidos} pedidos baixados. `
                  + 'A cota diária da API acabou; o restante é buscado nas próximas sincronizações.']
                : []),
              ...extras,
            ];
            return msgs.length ? msgs.join(' ') : null;
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
    // filtro da tela além do período escolhido: avisa que essa parte não vem do Sienge
    const fora = escolha && (de < alvo.de || (ate > alvo.ate && alvo.ate < diaLocal()))
      ? `Do Sienge vem só o período escolhido em Configurações (${dataBR(alvo.de)} a ${dataBR(alvo.ate)}); fora dele aparece só o que já estava salvo.`
      : null;
    return { dados: DadosModel.ler(de, ate), aviso: [avisos.get(k), fora].filter(Boolean).join(' ') || null };
  },

  /**
   * Financeiro: sincroniza a janela fixa (janelaFinanceira) e lê do SQLite o período pedido.
   * Intervalo entre sincronizações conforme a parte da cota bulk do plano reservada ao financeiro
   * (Free: 10/dia, metade para o financeiro → a cada ~14h; planos maiores: o cache normal).
   */
  async obterFinanceiro(de: string, ate: string, forcar = false): Promise<ResultadoFinanceiro> {
    if (ConfigService.mock()) return { dados: MockService.financeiro(), aviso: null, atualizado: null };
    const obras = DadosModel.obras();
    if (!ConfigService.completa()) return { dados: FinanceiroModel.ler(de, ate, obras), aviso: null, atualizado: FinanceiroModel.ultima() };
    if (SyncConfigService.obter()?.financeiro === false) {
      return {
        dados: FinanceiroModel.ler(de, ate, obras), atualizado: FinanceiroModel.ultima(),
        aviso: 'O financeiro está desligado em Configurações → O que puxar do Sienge: aparece só o que já estava salvo.',
      };
    }

    const limiteBulk = QuotaService.info().bulkLimite * PARTE_BULK_FINANCEIRO;
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
