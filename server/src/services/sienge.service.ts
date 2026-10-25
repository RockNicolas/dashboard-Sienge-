// Cliente da API pública do Sienge (Basic Auth: usuário de API + senha).
// Base: https://api.sienge.com.br/{SUBDOMINIO}/public/api/v1
//
// ATENÇÃO: os nomes de campos seguem a documentação pública, mas variam por módulo/versão do tenant.
// Se algum campo vier com outro nome, ajuste apenas as funções `normalizar*` abaixo.
import type { Compra, Consumo, Dados, TesteConexao } from '../types';
import { ConfigService, type SiengeCfg } from './config.service';
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

function normalizarItemCompra(pedido: Raw, it: Raw): Compra {
  const qtd = num(it.quantity);
  const preco = num(it.unitPrice);
  const fornecedorId = pedido.supplierId ?? pedido.creditorId;
  const insumoId = it.resourceId ?? it.productId;
  return {
    pedido: String(pedido.id),
    data: dia(pedido.date ?? pedido.issueDate),
    fornecedorId: String(fornecedorId),
    fornecedor: pedido.supplierName ?? pedido.creditorName ?? `Fornecedor ${fornecedorId}`,
    insumoId: String(insumoId),
    insumo: it.resourceDescription ?? it.productDescription ?? it.description ?? `Insumo ${insumoId}`,
    un: it.unitOfMeasure ?? it.unit ?? '',
    qtd, preco, valor: num(it.totalPrice) || qtd * preco,
    prazoEntrega: null,
  };
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

    const pedidos = await listarTudo(cfg, '/purchase-orders', { startDate: from, endDate: to });

    const movs = await listarTudo(cfg, cfg.endpointConsumo, { startDate: from, endDate: to }).catch(e => {
      if (/Cota diária/.test((e as Error).message)) throw e;
      console.warn('[sienge] consumo indisponível:', (e as Error).message);
      return [] as Raw[];
    });
    const consumos = movs.map(m => normalizarConsumo(m, obras));

    const itens = PedidoItensModel.obter(pedidos.map(p => String(p.id)));
    const faltando = pedidos
      .filter(p => !itens.has(String(p.id)))
      .sort((a, b) => dia(b.date ?? b.issueDate).localeCompare(dia(a.date ?? a.issueDate)));
    await paralelo(faltando.slice(0, QuotaService.disponivel()), 5, async p => {
      try {
        const it = await listarTudo(cfg, `/purchase-orders/${p.id}/items`);
        PedidoItensModel.salvar(String(p.id), it);
        itens.set(String(p.id), it);
      } catch (e) {
        if (!/Cota diária/.test((e as Error).message)) console.warn(`[sienge] itens do pedido ${p.id}:`, (e as Error).message);
      }
    });
    const compras = pedidos.flatMap(p => (itens.get(String(p.id)) ?? []).map(it => normalizarItemCompra(p, it)));

    return {
      dados: { compras, consumos, obras: [...obras].map(([id, nome]) => ({ id, nome })) },
      pedidos: pedidos.length,
      pendentes: pedidos.filter(p => !itens.has(String(p.id))).length,
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
