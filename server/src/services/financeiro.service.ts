// Módulo financeiro do Sienge: contas a pagar, contas a receber, caixa e bancos.
// Campos conforme as especificações oficiais (https://api.sienge.com.br/docs/yaml-files/*.yaml):
//   bulk-data-outcome-v1, bulk-data-income-v1, bulk-data-bank-movement-v1, checking-accounts-v1, accounts-balances-v1.
// Os bulk-data trazem o período inteiro em 1 requisição (cota BULK separada da REST: 10/dia no plano Free).
// Se algum campo vier diferente no seu tenant, ajuste só as funções `normalizar*`.
import type {
  ContaCorrente, ContaPagar, ContaReceber, DadosFinanceiros, MovimentoBancario, Rateio, SaldoConta, SituacaoParcela,
} from '../types';
import { ConfigService, type SiengeCfg } from './config.service';
import { bulkUrl, get, listarTudo } from './sienge.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

// Indexador de correção exigido pelo /outcome. 0 = sem correção (confirmar no tenant; o código vem do cadastro de indexadores).
const INDEXADOR_SEM_CORRECAO = 0;

const num = (v: unknown) => (v == null ? 0 : Number(v));
const dia = (v: unknown) => String(v ?? '').slice(0, 10);
const txt = (v: unknown) => (v == null ? '' : String(v));
const id = (v: unknown) => (v == null ? '' : String(v));
const lista = (v: unknown): Raw[] => (Array.isArray(v) ? v : []);
const somar = (xs: Raw[], campo: string) => xs.reduce((s, x) => s + num(x[campo]), 0);
const ultimaData = (xs: Raw[]) => xs.map(x => dia(x.paymentDate)).filter(Boolean).sort().at(-1) ?? null;

function situacao(saldo: number, vencimento: string, hoje: string): SituacaoParcela {
  if (saldo <= 0.005) return 'quitada';
  return vencimento && vencimento < hoje ? 'vencida' : 'aberta';
}

const rateio = (xs: Raw[], campoId: string, campoNome: string, campoPct: string): Rateio[] =>
  xs.filter(x => x[campoId] != null).map(x => ({ id: id(x[campoId]), nome: txt(x[campoNome]), pct: num(x[campoPct]) }));

const documento = (r: Raw, numero = r.documentNumber) => [txt(r.documentIdentificationId), txt(numero)].filter(Boolean).join(' ');

const centrosCusto = (categorias: Raw[]) => rateio(categorias, 'costCenterId', 'costCenterName', 'financialCategoryRate');

// Obra: usa a apropriação por obra quando o Sienge manda; senão o centro de custo (no Sienge cada obra costuma ter o seu).
const obrasOuCentros = (obras: Rateio[], categorias: Raw[]) => (obras.length ? obras : centrosCusto(categorias));

function parcelaBase(r: Raw, categorias: Raw[], obras: Rateio[], hoje: string) {
  const saldo = num(r.balanceAmount);
  const vencimento = dia(r.dueDate);
  return {
    empresaId: id(r.companyId), empresa: txt(r.companyName),
    tituloId: id(r.billId), parcelaId: id(r.installmentId),
    documento: documento(r),
    emissao: dia(r.issueDate), vencimento, competencia: dia(r.billDate),
    valor: num(r.originalAmount), saldo,
    situacao: situacao(saldo, vencimento, hoje),
    planos: rateio(categorias, 'financialCategoryId', 'financialCategoryName', 'financialCategoryRate'),
    centrosCusto: centrosCusto(categorias),
    obras: obrasOuCentros(obras, categorias),
  };
}

export function normalizarContaPagar(r: Raw, hoje: string): ContaPagar {
  const pagamentos = lista(r.payments);
  const obras = rateio(lista(r.buildingsCosts), 'buildingId', 'buildingName', 'rate');
  return {
    ...parcelaBase(r, lista(r.paymentsCategories), obras, hoje),
    credorId: id(r.creditorId), credor: txt(r.creditorName),
    pago: somar(pagamentos, 'netAmount'),
    ultimoPagamento: ultimaData(pagamentos),
    autorizada: r.authorizationStatus === 'S',
  };
}

// O /income não traz apropriação por obra: a obra sai do centro de custo das categorias (confirmar no tenant).
export function normalizarContaReceber(r: Raw, hoje: string): ContaReceber {
  const recebimentos = lista(r.receipts);
  return {
    ...parcelaBase(r, lista(r.receiptsCategories), [], hoje),
    clienteId: id(r.clientId), cliente: txt(r.clientName),
    recebido: somar(recebimentos, 'netAmount'),
    ultimoRecebimento: ultimaData(recebimentos),
    inadimplencia: txt(r.defaulterSituation),
    unidade: txt(r.mainUnit),
  };
}

// Tipo da operação não é documentado; trata D/S (débito/saída) como saída. Conferir com dados reais.
const ehSaida = (tipo: unknown) => /^(d|s)/i.test(txt(tipo));

export function normalizarMovimento(r: Raw): MovimentoBancario {
  const v = num(r.bankMovementAmount);
  const categorias = lista(r.financialCategories);
  // "buldingCosts" é a grafia da própria especificação do Sienge
  const obras = rateio(lista(r.buldingCosts ?? r.buildingsCosts), 'buildingId', 'name', 'rate');
  return {
    id: id(r.bankMovementId),
    data: dia(r.bankMovementDate),
    empresaId: id(r.companyId), empresa: txt(r.companyName),
    conta: txt(r.accountNumber),
    valor: v < 0 || !ehSaida(r.bankMovementOperationType) ? v : -v,
    operacao: txt(r.bankMovementOperationName),
    historico: txt(r.bankMovementHistoricName),
    conciliado: r.bankMovementReconcile === 'S',
    tituloId: r.billId != null ? id(r.billId) : null,
    parceiro: txt(r.creditorName || r.clientName),
    planos: rateio(categorias, 'financialCategoryId', 'financialCategoryName', 'financialCategoryRate'),
    obras: obrasOuCentros(obras, categorias),
  };
}

export function normalizarContaCorrente(r: Raw): ContaCorrente {
  return {
    conta: txt(r.accountNumber), nome: txt(r.accountName),
    banco: txt(r.bankName), agencia: txt(r.agencyNumber),
    tipo: txt(r.accountType?.description ?? r.accountType),
    empresaId: id(r.companyId), empresa: txt(r.companyName),
    ativa: r.accountStatus !== 'DISABLED',
  };
}

export function normalizarSaldo(r: Raw): SaldoConta {
  return {
    conta: txt(r.accountNumber), empresaId: id(r.companyId),
    data: dia(r.balanceDate),
    saldo: num(r.amount), conciliado: num(r.reconciledAmount),
  };
}

const hojeIso = () => iso(new Date());

async function bulk(cfg: SiengeCfg, path: string, params: Record<string, string | number>): Promise<Raw[]> {
  const j = await get(cfg, path, params, bulkUrl(cfg));
  return lista(j.data);
}

/** Requisições bulk-data gastas por sincronização completa (a pagar, a receber, movimentos). */
export const BULK_POR_SYNC = 3;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Janela fixa sincronizada (não depende do filtro da tela, para não gastar cota a cada mudança de período):
 * vencimentos de 12 meses atrás até 6 meses à frente; movimentos de 12 meses atrás até hoje.
 */
export function janelaFinanceira(hoje = new Date()) {
  const vencDe = iso(new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() - 12, 1)));
  const vencAte = iso(new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() + 7, 0)));
  return { vencDe, vencAte, movDe: vencDe, movAte: iso(hoje) };
}

export interface CargaFinanceira {
  dados: Partial<Omit<DadosFinanceiros, 'obras'>>;
  erros: string[];   // módulos que falharam (o resto é gravado mesmo assim)
}

export const FinanceiroService = {
  /** Busca os três módulos de forma independente: se um falhar, os outros seguem. */
  async sincronizar(j = janelaFinanceira(), cfg = ConfigService.efetiva()): Promise<CargaFinanceira> {
    const dados: CargaFinanceira['dados'] = {};
    const erros: string[] = [];
    const tentar = async <K extends keyof CargaFinanceira['dados']>(nome: string, k: K, fn: () => Promise<CargaFinanceira['dados'][K]>) => {
      // erro (inclusive cota) só invalida o próprio módulo: o que já veio é gravado
      try { dados[k] = await fn(); } catch (e) {
        console.warn(`[financeiro] ${nome}:`, (e as Error).message);
        erros.push(`${nome}: ${(e as Error).message.slice(0, 160)}`);
      }
    };
    // em sequência: o bulk-data aceita só 20 requisições por minuto
    await tentar('Contas a pagar', 'pagar', () => this.contasPagar(j.vencDe, j.vencAte, cfg));
    await tentar('Contas a receber', 'receber', () => this.contasReceber(j.vencDe, j.vencAte, cfg));
    await tentar('Caixa e bancos', 'movimentos', () => this.movimentos(j.movDe, j.movAte, cfg));
    await tentar('Contas correntes', 'contas', () => this.contasCorrentes(cfg));
    await tentar('Saldos', 'saldos', () => this.saldos(j.movAte, cfg));
    return { dados, erros };
  },

  /** Parcelas a pagar com vencimento no período (selectionType D), com pagamentos e rateios. 1 requisição BULK. */
  async contasPagar(de: string, ate: string, cfg = ConfigService.efetiva()): Promise<ContaPagar[]> {
    const hoje = hojeIso();
    const rows = await bulk(cfg, '/outcome', {
      startDate: de, endDate: ate, selectionType: 'D',
      correctionIndexerId: INDEXADOR_SEM_CORRECAO, correctionDate: hoje,
    });
    return rows.map(r => normalizarContaPagar(r, hoje));
  },

  /** Parcelas a receber com vencimento no período, com recebimentos. 1 requisição BULK. */
  async contasReceber(de: string, ate: string, cfg = ConfigService.efetiva()): Promise<ContaReceber[]> {
    const hoje = hojeIso();
    const rows = await bulk(cfg, '/income', { startDate: de, endDate: ate, selectionType: 'D' });
    return rows.map(r => normalizarContaReceber(r, hoje));
  },

  /** Movimentos de caixa e bancos pela data do movimento (selectionType M). 1 requisição BULK. */
  async movimentos(de: string, ate: string, cfg = ConfigService.efetiva()): Promise<MovimentoBancario[]> {
    const rows = await bulk(cfg, '/bank-movement', { startDate: de, endDate: ate, selectionType: 'M' });
    return rows.map(normalizarMovimento);
  },

  /** Contas correntes cadastradas. REST paginado (normalmente 1 requisição). */
  async contasCorrentes(cfg = ConfigService.efetiva()): Promise<ContaCorrente[]> {
    return (await listarTudo(cfg, '/checking-accounts')).map(normalizarContaCorrente);
  },

  /** Saldo de cada conta na data (usa o último saldo se não houver movimento no dia). REST paginado. */
  async saldos(data = hojeIso(), cfg = ConfigService.efetiva()): Promise<SaldoConta[]> {
    const rows = await listarTudo(cfg, '/accounts-balances', { balanceDate: data, showLastBalanceIfNotExistBalance: 'true' });
    return rows.map(normalizarSaldo);
  },
};
