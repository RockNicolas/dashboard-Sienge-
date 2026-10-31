// Custos por obra: Insumos da Obra do Sienge (bulk-data/v1/building/resources, spec bulk-data-building-resource-v1).
// É a mesma regra do "Relatório de Apropriações de Insumos": para cada insumo da obra, os itens do orçamento (orçado),
// as apropriações pendentes (saldos de pedidos de compra e contratos) e as atendidas (NFs de compra e medições).
// Cada obra custa 1 requisição bulk-data (cota diária separada da REST); o que veio fica salvo por obra.
import type { ApropriacaoInsumo, CustosObraResponse, Filtros, InsumoObra, Obra } from '../types';
import { DadosModel } from '../models/DadosModel';
import { ObraInsumosModel } from '../models/ObraInsumosModel';
import { ConfigService } from './config.service';
import { CustosObraAnalytics } from './custos-obra-analytics.service';
import { BULK_POR_SYNC } from './financeiro.service';
import { MockService } from './mock.service';
import { QuotaService } from './quota.service';
import { bulkUrl, get } from './sienge.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

const num = (v: unknown) => (v == null ? 0 : Number(v));
const dia = (v: unknown) => String(v ?? '').slice(0, 10);
const txt = (v: unknown) => (v == null ? '' : String(v).trim());
const lista = (v: unknown): Raw[] => (Array.isArray(v) ? v : []);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Cada obra é buscada de novo no máximo a cada 12h (ou no "↻ Sienge"). */
const INTERVALO_MS = 12 * 3600_000;
/** Sem filtro de obra: as obras com mais compras no período, até este limite (cada uma é 1 requisição bulk). */
export const MAX_OBRAS = 12;
/** As apropriações atendidas são filtradas por data na API: busca desde o início para ter o realizado acumulado. */
const INICIO = '2000-01-01';

const falhas = new Map<string, number>(); // obraId → última tentativa com erro (não insiste por 10 min)
const emAndamento = new Map<string, Promise<string | null>>(); // mesma consulta ao mesmo tempo: espera a que já está rodando

const apropriacao = (a: Raw): ApropriacaoInsumo => ({
  documento: txt(a.documentLabel),
  data: dia(a.date),
  edt: txt(a.costEstimationItemReference),
  servico: txt(a.costEstimationItemDescription),
  unidade: txt(a.buildingUnitName),
  qtd: num(a.quantity),
  pct: num(a.percentage),
  valor: num(a.value),
});

/** BuildingResourceDto → insumo da obra. */
export function normalizarInsumoObra(r: Raw): InsumoObra {
  return {
    obraId: txt(r.buildingId), obra: txt(r.buildingName),
    insumoId: txt(r.id), insumo: txt(r.description) || `Insumo ${txt(r.id)}`,
    codigo: txt(r.resourceCode),
    un: txt(r.unitOfMeasure),
    categoria: txt(r.category),
    grupo: txt(r.resourceGroup),
    detalhe: txt(r.detailDescription), marca: txt(r.trademarkDescription),
    precoUnitario: num(r.unitPrice),
    orcamento: lista(r.buildingCostEstimationItems).map(o => ({
      edt: txt(o.wbsCode), servico: txt(o.description), unidade: txt(o.buildingUnitName),
      qtd: num(o.quantity), valor: num(o.totalPrice),
    })),
    pendentes: lista(r.buildingAppropriations?.pending).map(apropriacao),
    atendidas: lista(r.buildingAppropriations?.attended).map(apropriacao),
  };
}

/** Obras a mostrar: a do filtro; sem filtro, as com mais compras (pela obra do pedido) no período. */
function obrasAlvo({ from, to, obraId }: Filtros): Obra[] {
  const nomes = new Map(DadosModel.obras().map(o => [o.id, o.nome]));
  if (obraId) return [{ id: obraId, nome: nomes.get(obraId) ?? `Obra ${obraId}` }];
  const valor = new Map<string, { nome: string; v: number }>();
  for (const c of DadosModel.ler(from, to).compras) {
    if (!c.obraId) continue;
    const x = valor.get(c.obraId) ?? { nome: c.obra || nomes.get(c.obraId) || `Obra ${c.obraId}`, v: 0 };
    x.v += c.valor;
    valor.set(c.obraId, x);
  }
  return [...valor].sort((a, b) => b[1].v - a[1].v).slice(0, MAX_OBRAS).map(([id, x]) => ({ id, nome: x.nome }));
}

/** Atualiza do Sienge as obras vencidas, sem passar da cota bulk-data (deixa espaço para o financeiro). */
async function sincronizar(alvo: Obra[], forcar: boolean): Promise<string | null> {
  const cfg = ConfigService.efetiva();
  const em = ObraInsumosModel.atualizacoes();
  const agora = Date.now();
  const vencidas = alvo
    .filter(o => forcar || !em.has(o.id) || agora - Date.parse(em.get(o.id)!) > INTERVALO_MS)
    .filter(o => agora - (falhas.get(o.id) ?? 0) > 10 * 60_000);
  const erros: string[] = [];
  let semCota = false;
  for (const o of vencidas) { // em sequência: o bulk-data aceita só 20 requisições por minuto
    if (QuotaService.disponivelBulk() <= BULK_POR_SYNC) { semCota = true; break; }
    try {
      const j = await get(cfg, '/building/resources', { buildingId: o.id, startDate: INICIO, endDate: iso(new Date()) }, bulkUrl(cfg));
      const insumos = lista(j.data).map(normalizarInsumoObra);
      ObraInsumosModel.salvar(o.id, insumos[0]?.obra || o.nome, insumos);
    } catch (e) {
      const m = (e as Error).message;
      falhas.set(o.id, Date.now());
      if (/Sienge (401|403) /.test(m)) return 'O usuário de API não tem acesso a "Insumos da Obra" (bulk-data building/resources) no Sienge.';
      if (/Cota diária/.test(m)) { semCota = true; break; }
      erros.push(/Sienge 404 /.test(m) ? `${o.nome}: obra não encontrada no Sienge` : `${o.nome}: ${m.slice(0, 140)}`);
    }
  }
  const partes = [
    ...(semCota ? ['Cota bulk-data do Sienge do dia no limite: as obras que faltam são buscadas na próxima sincronização.'] : []),
    ...(erros.length ? [`Insumos da obra não vieram — ${erros.join(' · ')}`] : []),
  ];
  return partes.length ? partes.join(' ') : null;
}

export const CustosObraService = {
  async obter(filtros: Filtros, forcar = false): Promise<CustosObraResponse> {
    if (ConfigService.mock()) {
      const insumos = MockService.insumosObra().filter(i => !filtros.obraId || i.obraId === filtros.obraId);
      return { mock: true, aviso: null, obras: CustosObraAnalytics.custos(insumos, filtros), aguardando: [] };
    }
    const alvo = obrasAlvo(filtros);
    let aviso: string | null = null;
    if (ConfigService.completa() && alvo.length) {
      const k = `${alvo.map(o => o.id).join(',')}|${forcar}`;
      let p = emAndamento.get(k);
      if (!p) {
        p = sincronizar(alvo, forcar).finally(() => emAndamento.delete(k));
        emAndamento.set(k, p);
      }
      aviso = await p;
    }
    const salvos = ObraInsumosModel.ler(alvo.map(o => o.id));
    const insumos = [...salvos.values()].flatMap(s => s.insumos);
    const atualizados = new Map([...salvos].map(([id, s]) => [id, s.em]));
    return {
      mock: false,
      aviso,
      obras: CustosObraAnalytics.custos(insumos, filtros, atualizados),
      aguardando: alvo.filter(o => !salvos.has(o.id)),
    };
  },
};
