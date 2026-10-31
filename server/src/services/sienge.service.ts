// Cliente da API pública do Sienge (Basic Auth: usuário de API + senha).
// Base: https://api.sienge.com.br/{SUBDOMINIO}/public/api/v1
//
// Campos conforme as especificações oficiais (https://api.sienge.com.br/docs/yaml-files/*.yaml):
//   purchase-orders-v1 (/purchase-orders e /items), creditor-v1 (/creditors), enterprise-v1 (/enterprises).
// Se algum campo vier diferente no seu tenant, ajuste só as funções `normalizar*` abaixo.
import type { Compra, Consumo, Dados, FornecedorCadastro, TesteConexao } from '../types';
import { ConfigService, type SiengeCfg } from './config.service';
import { FornecedorModel } from '../models/FornecedorModel';
import { PedidoItensModel } from '../models/PedidoItensModel';
import { QuotaService } from './quota.service';

const PAGE = 200;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;
type Params = Record<string, string | number | undefined>;

/** Endereço das APIs bulk-data (…/public/api/bulk-data/v1), diferente do REST (…/public/api/v1). */
export const bulkUrl = (cfg: SiengeCfg) => cfg.baseUrl.replace(/\/v1$/, '/bulk-data/v1');

export async function get(cfg: SiengeCfg, path: string, params: Params = {}, base = cfg.baseUrl): Promise<Raw> {
  const url = new URL(base + path);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, String(v)));
  const auth = 'Basic ' + Buffer.from(`${cfg.usuario}:${cfg.senha}`).toString('base64');
  const bulk = base !== cfg.baseUrl;

  for (let tent = 0; tent < 4; tent++) {
    QuotaService.garantir(bulk);
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json' } });
    } catch (e) {
      QuotaService.registrar(null, true, bulk);
      throw e;
    }
    QuotaService.registrar(res, !res.ok, bulk);
    if (res.status === 429) { await new Promise(r => setTimeout(r, 1500 * (tent + 1))); continue; }
    if (!res.ok) throw new Error(`Sienge ${res.status} em ${path}: ${(await res.text()).slice(0, 200)}`);
    return res.json() as Promise<Raw>;
  }
  throw new Error(`Sienge: limite de requisições excedido em ${path}`);
}

export async function listarTudo(cfg: SiengeCfg, path: string, params: Params = {}): Promise<Raw[]> {
  const out: Raw[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const j = await get(cfg, path, { ...params, limit: PAGE, offset });
    const rows: Raw[] = j.results ?? (Array.isArray(j) ? j : []);
    out.push(...rows);
    const total = j.resultSetMetadata?.count ?? rows.length;
    if (!rows.length || offset + PAGE >= total) break;
  }
  return out;
}

// Executa tarefas com concorrência limitada (respeita rate limit)
async function paralelo<T, R>(itens: T[], n: number, fn: (i: T) => Promise<R>): Promise<R[]> {
  const res: R[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < itens.length) { const k = i++; res[k] = await fn(itens[k]); }
  }));
  return res;
}

const num = (v: unknown) => (v == null ? 0 : Number(v));
const dia = (v: unknown) => String(v ?? '').slice(0, 10);
const txt = (v: unknown) => (v == null ? '' : String(v).trim());
const lista = (v: unknown): Raw[] => (Array.isArray(v) ? v : []);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Pedido que conta como compra: fora os cancelados (status CANCELED) e os reprovados (disapproved). */
export const pedidoValido = (p: Raw) => p.status !== 'CANCELED' && p.disapproved !== true;

/**
 * Item do pedido de compra (spec purchase-orders-v1: PurchaseOrder + PurchaseOrderItem) → linha de compra.
 * O pedido não traz o nome do fornecedor nem o total do item: o nome vem de /creditors e o valor é quantidade × preço líquido.
 */
export function normalizarItemCompra(pedido: Raw, it: Raw, obras: Map<string, string> = new Map()): Compra {
  const qtd = num(it.quantity);
  const precoUnitario = num(it.unitPrice);
  const preco = num(it.netPrice) || precoUnitario;
  const fornecedorId = txt(pedido.supplierId);
  const obraId = txt(pedido.buildingId);
  const insumoId = txt(it.resourceId);
  return {
    data: dia(pedido.date),
    pedido: txt(pedido.formattedPurchaseOrderId) || txt(pedido.id),
    fornecedorId,
    fornecedor: fornecedorId ? `Fornecedor ${fornecedorId}` : 'Sem fornecedor',
    insumoId,
    insumo: txt(it.resourceDescription) || `Insumo ${insumoId}`,
    un: txt(it.unitOfMeasure),
    qtd, preco, valor: r2(qtd * preco),
    prazoEntrega: null,
    obraId,
    obra: obraId ? obras.get(obraId) ?? `Obra ${obraId}` : '',
    item: num(it.itemNumber),
    codigo: txt(it.resourceCode),
    detalhe: txt(it.detailDescription),
    marca: txt(it.trademarkDescription),
    precoUnitario,
    situacao: txt(pedido.status),
    autorizado: pedido.authorized !== false,
    atrasado: pedido.deliveryLate === true,
    comprador: txt(pedido.buyerId),
    condicaoPagamento: txt(pedido.paymentCondition),
  };
}

/** Credor do Sienge (spec creditor-v1: Creditor) → cadastro do fornecedor. */
export function normalizarCredor(c: Raw, id = txt(c.id)): FornecedorCadastro {
  const fones = lista(c.phones);
  const fone = fones.find(f => f.main === true) ?? fones[0];
  return {
    id,
    nome: txt(c.name),
    fantasia: txt(c.tradeName),
    cnpj: txt(c.cnpj) || txt(c.cpf),
    cidade: txt(c.address?.cityName),
    telefone: fone ? [txt(fone.ddd) && `(${txt(fone.ddd)})`, txt(fone.number)].filter(Boolean).join(' ') : '',
    email: txt(lista(c.contacts).find(x => txt(x.email))?.email),
    ativo: c.active !== false,
  };
}

const AVISO_SEM_CREDORES =
  'O usuário de API não tem acesso ao cadastro de credores do Sienge (/creditors): os fornecedores aparecem pelo código.';

/**
 * Busca o cadastro (credor) dos fornecedores que ainda não estão salvos, gastando no máximo `orcamento` requisições.
 * A 1ª página de /creditors diz quantos credores existem: se a lista inteira custar menos que buscar um a um, baixa a lista;
 * senão busca /creditors/{id} dos fornecedores com mais pedidos primeiro. O que veio fica salvo (não gasta cota de novo).
 */
async function buscarFornecedores(cfg: SiengeCfg, pedidos: Raw[], orcamento: number): Promise<string | null> {
  const conhecidos = FornecedorModel.conhecidos();
  const contagem = new Map<string, number>();
  for (const p of pedidos) {
    const id = txt(p.supplierId);
    if (id && !conhecidos.has(id)) contagem.set(id, (contagem.get(id) ?? 0) + 1);
  }
  let faltando = [...contagem].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  if (!faltando.length || orcamento < 1) return null;

  const erro = (e: unknown) => (e as Error).message;
  try {
    const p1 = await get(cfg, '/creditors', { limit: PAGE, offset: 0 });
    const vieram = new Set<string>();
    const guardar = (rows: Raw[]) => {
      FornecedorModel.salvar(rows.map(c => normalizarCredor(c)));
      rows.forEach(c => vieram.add(txt(c.id)));
    };
    guardar(lista(p1.results));
    const total = num(p1.resultSetMetadata?.count);
    faltando = faltando.filter(id => !vieram.has(id));
    const paginas = Math.ceil(total / PAGE) - 1;
    orcamento -= 1;
    if (paginas <= Math.min(faltando.length, orcamento)) {
      for (let offset = PAGE; offset < total; offset += PAGE) {
        const rows = lista((await get(cfg, '/creditors', { limit: PAGE, offset })).results);
        guardar(rows);
        if (!rows.length) break;
      }
      faltando.filter(id => !vieram.has(id)).forEach(id => FornecedorModel.marcarAusente(id));
      return null;
    }
  } catch (e) {
    if (/Sienge (401|403) /.test(erro(e))) return AVISO_SEM_CREDORES;
    if (/Cota diária/.test(erro(e))) return null;
    console.warn('[sienge] lista de credores:', erro(e));
  }

  let semAcesso = false;
  await paralelo(faltando.slice(0, Math.max(0, orcamento)), 5, async id => {
    if (semAcesso) return;
    try {
      FornecedorModel.salvar([normalizarCredor(await get(cfg, `/creditors/${encodeURIComponent(id)}`), id)]);
    } catch (e) {
      if (/Sienge 404 /.test(erro(e))) FornecedorModel.marcarAusente(id);
      else if (/Sienge (401|403) /.test(erro(e))) semAcesso = true;
      else if (!/Cota diária/.test(erro(e))) console.warn(`[sienge] credor ${id}:`, erro(e));
    }
  });
  return semAcesso ? AVISO_SEM_CREDORES : null;
}

function normalizarConsumo(m: Raw, obras: Map<string, string>): Consumo {
  const obraId = String(m.buildingId ?? m.enterpriseId ?? m.costCenterId);
  const insumoId = m.resourceId ?? m.productId;
  return {
    data: dia(m.date ?? m.movementDate),
    obraId,
    obra: obras.get(obraId) ?? `Obra ${obraId}`,
    insumoId: String(insumoId),
    insumo: m.resourceDescription ?? m.productDescription ?? `Insumo ${insumoId}`,
    un: m.unitOfMeasure ?? '',
    qtd: Math.abs(num(m.quantity)),
    valor: Math.abs(num(m.totalCost ?? m.totalPrice)),
  };
}

export interface Carga {
  dados: Dados;
  pedidos: number;     // pedidos no período
  pendentes: number;   // pedidos cujos itens ainda não foram baixados (cota do dia acabou)
  avisos: string[];    // problemas que não impedem a sincronização (ex.: sem acesso ao cadastro de credores)
}

export const SiengeService = {
  /**
   * Busca o período no Sienge cabendo na cota diária: listas primeiro (poucas requisições) e, com o que sobrar,
   * os itens dos pedidos ainda não baixados, dos mais recentes para os mais antigos. Os itens ficam salvos,
   * então se a cota acabar a próxima sincronização continua de onde parou.
   */
  async carregar(from: string, to: string): Promise<Carga> {
    const cfg = ConfigService.efetiva();
    if (!ConfigService.completa(cfg)) throw new Error('Configure subdomínio, usuário e senha do Sienge na tela Configurações.');
    if (QuotaService.disponivel() <= 0)
      throw new Error('Cota diária da API do Sienge no fim (o restante fica reservado). Usando os dados já salvos.');

    const empresas = await listarTudo(cfg, '/enterprises').catch(e => {
      if (/Cota diária/.test((e as Error).message)) throw e;
      return [] as Raw[];
    });
    const obras = new Map(empresas.map(e => [String(e.id), String(e.name ?? e.commercialName)]));

    // cancelados e reprovados não contam como compra (e nem gastam requisição com os itens)
    const pedidos = (await listarTudo(cfg, '/purchase-orders', { startDate: from, endDate: to })).filter(pedidoValido);

    // Consumo (telas de consumo ocultas por enquanto). O endpoint padrão /stock-movements não existe na API pública
    // do Sienge (veja a lista em https://api.sienge.com.br/docs/), então a chamada fica desligada para não gastar cota.
    // const movs = await listarTudo(cfg, cfg.endpointConsumo, { startDate: from, endDate: to }).catch(e => {
    //   if (/Cota diária/.test((e as Error).message)) throw e;
    //   console.warn('[sienge] consumo indisponível:', (e as Error).message);
    //   return [] as Raw[];
    // });
    const movs: Raw[] = [];
    const consumos = movs.map(m => normalizarConsumo(m, obras));

    // nomes dos fornecedores: no máximo metade do que sobrou da cota, para os itens dos pedidos também andarem
    const avisoFornecedores = await buscarFornecedores(cfg, pedidos, Math.ceil(QuotaService.disponivel() / 2));

    const itens = PedidoItensModel.obter(pedidos.map(p => String(p.id)));
    const faltando = pedidos
      .filter(p => !itens.has(String(p.id)))
      .sort((a, b) => dia(b.date).localeCompare(dia(a.date)));
    await paralelo(faltando.slice(0, QuotaService.disponivel()), 5, async p => {
      try {
        const it = await listarTudo(cfg, `/purchase-orders/${p.id}/items`);
        PedidoItensModel.salvar(String(p.id), it);
        itens.set(String(p.id), it);
      } catch (e) {
        if (!/Cota diária/.test((e as Error).message)) console.warn(`[sienge] itens do pedido ${p.id}:`, (e as Error).message);
      }
    });
    const compras = pedidos.flatMap(p => (itens.get(String(p.id)) ?? []).map(it => normalizarItemCompra(p, it, obras)));

    return {
      dados: { compras, consumos, obras: [...obras].map(([id, nome]) => ({ id, nome })) },
      pedidos: pedidos.length,
      pendentes: pedidos.filter(p => !itens.has(String(p.id))).length,
      avisos: avisoFornecedores ? [avisoFornecedores] : [],
    };
  },

  /** Faz uma chamada mínima (1 requisição) para validar subdomínio, usuário e senha. */
  async testar(cfg: SiengeCfg): Promise<TesteConexao> {
    if (!ConfigService.completa(cfg)) return { ok: false, mensagem: 'Preencha subdomínio, usuário e senha.' };
    try {
      await get(cfg, '/enterprises', { limit: 1 });
      const plano = QuotaService.verificarPlano(cfg.plano);
      return { ok: plano.confere !== false, mensagem: `Conexão com o Sienge OK. ${plano.mensagem}` };
    } catch (e) {
      const m = (e as Error).message;
      if (/ 401 /.test(m)) return { ok: false, mensagem: 'Usuário ou senha da API inválidos (401).' };
      if (/ 403 /.test(m)) return { ok: false, mensagem: 'Acesso negado (403): o usuário de API não tem permissão neste módulo.' };
      if (/ 404 /.test(m)) return { ok: false, mensagem: 'Subdomínio não encontrado (404). Confira o nome da empresa na URL do Sienge.' };
      return { ok: false, mensagem: m };
    }
  },
};
