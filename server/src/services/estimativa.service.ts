// Quanto as escolhas de sincronização (período, obras, módulos) vão gastar da cota diária do Sienge.
// REST e bulk-data têm cotas separadas (ver planos.ts). O grosso do REST é 1 requisição por pedido de compra
// (os itens de cada pedido); os itens que já vieram ficam salvos e não gastam de novo.
import { FornecedorModel } from '../models/FornecedorModel';
import { PedidoItensModel } from '../models/PedidoItensModel';
import { UsoApiModel } from '../models/UsoApiModel';
import type { ConfigSync, EstimativaSync, JanelaSync, Obra, PlanoSienge } from '../types';
import { ConfigService } from './config.service';
import { MAX_OBRAS } from './custos-obra.service';
import { BULK_POR_SYNC } from './financeiro.service';
import { MockService } from './mock.service';
import { planoPorId } from './planos';
import { QuotaService } from './quota.service';
import { contarCredores, listarObras, listarPedidos, pedidoValido, totalDoPeriodo } from './sienge.service';
import { janelaSync } from './sync-config.service';

const PAGE = 200;
/** Financeiro em REST a cada sincronização: contas correntes + saldos (títulos só com sobra de cota no dia). */
const REST_FINANCEIRO = 2;

const paginas = (n: number) => Math.max(1, Math.ceil(n / PAGE));
const txt = (v: unknown) => (v == null ? '' : String(v).trim());

export interface PedidoResumo { id: string; obraId: string; fornecedorId: string; valido: boolean }

export interface EntradaEstimativa {
  janela: JanelaSync;
  escolha: ConfigSync;
  pedidos: PedidoResumo[];              // pedidos do período das obras escolhidas (ou de todas), cancelados também
  totalPeriodo: number;                 // pedidos do período em todas as obras (páginas da lista completa)
  obras: Obra[];                        // obras que o usuário de API enxerga
  paginasObras: number;                 // requisições para listar as obras (/enterprises)
  itensSalvos: Set<string>;             // pedidos com os itens já baixados
  fornecedoresConhecidos: Set<string>;  // credores já salvos
  credores: number | null;              // quantos credores o Sienge tem (null = não se sabe)
  plano: PlanoSienge | null;
  hoje: { rest: number | null; bulk: number | null };
  reservaRest: number;                  // reserva diária que a sincronização não usa
  gastoNaEstimativa: number;
  listaGuardada: boolean;               // a lista de pedidos já está guardada: a sincronização não lista de novo
  mock: boolean;
}

/** Cálculo puro (testável): requisições REST e bulk da 1ª carga, de cada atualização e dias para terminar. */
export function estimar(e: EntradaEstimativa): EstimativaSync {
  const sel = e.escolha.obras ? new Set(e.escolha.obras) : null;
  const porObra = new Map<string, { bruto: number; pedidos: number; pendentes: number }>();
  for (const p of e.pedidos) {
    const s = porObra.get(p.obraId) ?? { bruto: 0, pedidos: 0, pendentes: 0 };
    s.bruto++;
    if (p.valido) { s.pedidos++; if (!e.itensSalvos.has(p.id)) s.pendentes++; }
    porObra.set(p.obraId, s);
  }
  // pedido sem obra (obraId '') só entra com "todas as obras"
  const escolhidos = e.pedidos.filter(p => p.valido && (!sel || sel.has(p.obraId)));

  // lista de pedidos: a empresa toda de uma vez ou obra a obra (filtro buildingId), o que for menor
  const tudo = paginas(e.totalPeriodo);
  const obraAObra = sel ? [...sel].reduce((s, id) => s + paginas(porObra.get(id)?.bruto ?? 0), 0) : Infinity;
  const listar = Math.min(tudo, obraAObra);
  const listagem = e.listaGuardada ? 0 : listar;
  const itens = escolhidos.filter(p => !e.itensSalvos.has(p.id)).length;
  // credores: 1ª página da lista e depois o resto da lista ou 1 por fornecedor que falta, o que for menor
  const faltando = new Set(escolhidos.map(p => p.fornecedorId).filter(id => id && !e.fornecedoresConhecidos.has(id)));
  const fornecedores = !e.escolha.fornecedores || !faltando.size ? 0
    : 1 + (e.credores != null ? Math.min(paginas(e.credores) - 1, faltando.size) : faltando.size);
  const financeiro = e.escolha.financeiro ? REST_FINANCEIRO : 0;
  const rest = { obras: e.paginasObras, listagem, itens, fornecedores, financeiro, total: 0 };
  rest.total = rest.obras + listagem + itens + fornecedores + financeiro;

  // Insumos da Obra: 1 bulk por obra (sem escolha de obras, as com mais compras no período, até MAX_OBRAS)
  const comPedido = [...porObra].filter(([id, s]) => id && s.pedidos > 0).length;
  const insumosObra = !e.escolha.insumosObra ? 0 : sel ? sel.size : Math.min(MAX_OBRAS, comPedido);
  const bulkFinanceiro = e.escolha.financeiro ? BULK_POR_SYNC : 0;
  const bulk = { insumosObra, financeiro: bulkFinanceiro, total: insumosObra + bulkFinanceiro };

  // dias para terminar a 1ª carga: o que resta hoje e depois a cota cheia de cada dia (menos a reserva)
  const dias = (total: number, hoje: number | null, porDia: number) => {
    if (hoje == null || porDia <= 0) return 0;
    return total <= hoje ? 1 : 1 + Math.ceil((total - hoje) / porDia);
  };
  const diasRest = e.plano ? dias(rest.total, e.hoje.rest, e.plano.rest - e.reservaRest) : 0;
  const diasBulk = e.plano && bulk.total ? dias(bulk.total, e.hoje.bulk, e.plano.bulk) : diasRest ? 1 : 0;

  // por obra: as escolhidas (mesmo sem pedido) ou, com todas, as que têm pedido no período
  const nomes = new Map(e.obras.map(o => [o.id, o.nome]));
  const ids = sel ? [...sel] : [...porObra].filter(([id, s]) => id && s.pedidos > 0).map(([id]) => id);
  const lista = ids
    .map(id => ({ id, nome: nomes.get(id) ?? `Obra ${id}`, pedidos: porObra.get(id)?.pedidos ?? 0, pendentes: porObra.get(id)?.pendentes ?? 0 }))
    .sort((a, b) => b.pedidos - a.pedidos || a.nome.localeCompare(b.nome, 'pt-BR'));

  return {
    janela: e.janela,
    pedidos: escolhidos.length,
    porObra: lista,
    semObra: porObra.get('')?.pedidos ?? 0,
    rest,
    bulk,
    porAtualizacao: { rest: e.paginasObras + listar, bulk: 0 },
    gastoNaEstimativa: e.gastoNaEstimativa,
    plano: e.plano,
    hoje: e.hoje,
    dias: Math.max(diasRest, diasBulk),
    mock: e.mock,
  };
}

const semInfinito = (n: number) => (Number.isFinite(n) ? n : null);

export const EstimativaService = {
  /** Lista obras e pedidos do período no Sienge (guardados 30 min para a sincronização reaproveitar) e estima. */
  async estimar(escolha: ConfigSync): Promise<EstimativaSync> {
    const janela = janelaSync(escolha);
    const plano = planoPorId(ConfigService.efetiva().plano);
    const reservaRest = plano ? Math.max(5, Math.ceil(plano.rest * 0.05)) : 0;
    const hoje = () => ({ rest: semInfinito(QuotaService.disponivel()), bulk: semInfinito(QuotaService.disponivelBulk()) });

    if (ConfigService.mock()) {
      // demonstração: os pedidos do demo, como se nada tivesse sido baixado ainda
      const d = MockService.carregar();
      const pedidos = new Map<string, PedidoResumo>();
      for (const c of d.compras) {
        if (c.data >= janela.de && c.data <= janela.ate && !pedidos.has(c.pedido))
          pedidos.set(c.pedido, { id: c.pedido, obraId: c.obraId, fornecedorId: c.fornecedorId, valido: true });
      }
      const todos = [...pedidos.values()];
      return estimar({
        janela, escolha, pedidos: todos.filter(p => !escolha.obras || escolha.obras.includes(p.obraId)), totalPeriodo: todos.length,
        obras: d.obras, paginasObras: 1, itensSalvos: new Set(),
        fornecedoresConhecidos: new Set(), credores: null, plano, hoje: hoje(), reservaRest, gastoNaEstimativa: 0,
        listaGuardada: false, mock: true,
      });
    }

    const cfg = ConfigService.efetiva();
    if (!ConfigService.completa(cfg))
      throw Object.assign(new Error('Cadastre o usuário de API do Sienge (subdomínio, usuário e senha) para estimar a cota.'), { status: 400 });
    const antes = UsoApiModel.hoje().requisicoes;
    const empresas = await listarObras(cfg);
    // só as obras escolhidas (obra a obra quando sai mais barato que listar a empresa toda)
    const brutos = await listarPedidos(cfg, janela.de, janela.ate, escolha.obras);
    const credores = escolha.fornecedores ? await contarCredores(cfg) : null;
    const pedidos = brutos.map(p => ({ id: txt(p.id), obraId: txt(p.buildingId), fornecedorId: txt(p.supplierId), valido: pedidoValido(p) }));
    return estimar({
      janela, escolha, pedidos, totalPeriodo: totalDoPeriodo(cfg, janela.de, janela.ate) ?? brutos.length,
      obras: empresas.map(x => ({ id: txt(x.id), nome: txt(x.name ?? x.commercialName) })),
      paginasObras: paginas(empresas.length),
      itensSalvos: PedidoItensModel.salvos(pedidos.filter(p => p.valido).map(p => p.id)),
      fornecedoresConhecidos: FornecedorModel.conhecidos(),
      credores, plano, hoje: hoje(), reservaRest,
      gastoNaEstimativa: UsoApiModel.hoje().requisicoes - antes,
      listaGuardada: true, // acabou de listar (ou já estava guardada): a sincronização reaproveita por 30 min
      mock: false,
    });
  },
};
