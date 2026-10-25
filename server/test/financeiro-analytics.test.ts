import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FinanceiroAnalytics, fatia, periodo, periodos } from '../src/services/financeiro-analytics.service';
import type { ContaPagar, ContaReceber, DadosFinanceiros, MovimentoBancario, Rateio } from '../src/types';

const HOJE = '2026-10-25';
const A: Rateio = { id: 'A', nome: 'Obra A', pct: 100 };

const pagar = (o: Partial<ContaPagar>): ContaPagar => ({
  empresaId: '1', empresa: 'E', tituloId: '1', parcelaId: '1', documento: 'NF 1', emissao: '', vencimento: '2026-10-05', competencia: '',
  valor: 1000, saldo: 0, situacao: 'quitada', planos: [], centrosCusto: [], obras: [A],
  credorId: 'c', credor: 'Cimento SA', pago: 1000, ultimoPagamento: '2026-10-05', autorizada: true, ...o,
});
const receber = (o: Partial<ContaReceber>): ContaReceber => ({
  empresaId: '1', empresa: 'E', tituloId: '9', parcelaId: '1', documento: 'CT 9', emissao: '', vencimento: '2026-10-12', competencia: '',
  valor: 3000, saldo: 0, situacao: 'quitada', planos: [], centrosCusto: [], obras: [A],
  clienteId: 'm', cliente: 'Maria', recebido: 3000, ultimoRecebimento: '2026-10-12', inadimplencia: 'N', unidade: 'Apto 1', ...o,
});
const mov = (o: Partial<MovimentoBancario>): MovimentoBancario => ({
  id: '1', data: '2026-10-05', empresaId: '1', empresa: 'E', conta: '1', valor: -1000, operacao: '', historico: '',
  conciliado: true, tituloId: null, parceiro: '', planos: [{ id: '2.01', nome: 'Materiais', pct: 100 }], obras: [A], ...o,
});

const dados: DadosFinanceiros = {
  pagar: [
    pagar({}),
    // título rateado 60% obra A / 40% obra B, vencido e em aberto
    pagar({ tituloId: '2', vencimento: '2026-10-20', saldo: 500, pago: 0, valor: 500, obras: [{ id: 'A', nome: 'Obra A', pct: 60 }, { id: 'B', nome: 'Obra B', pct: 40 }] }),
  ],
  receber: [receber({}), receber({ tituloId: '10', vencimento: '2026-11-03', saldo: 2000, recebido: 0, valor: 2000, obras: [{ id: 'B', nome: 'Obra B', pct: 100 }] })],
  movimentos: [mov({}), mov({ id: '2', data: '2026-10-13', valor: 3000, planos: [{ id: '1.01', nome: 'Vendas', pct: 100 }] })],
  contas: [{ conta: '1', nome: 'Itaú', banco: 'Itaú', agencia: '', tipo: '', empresaId: '1', empresa: 'E', ativa: true }],
  saldos: [{ conta: '1', empresaId: '1', data: HOJE, saldo: 50_000, conciliado: 50_000 }],
  obras: [],
};

test('semana começa na segunda-feira; mês é AAAA-MM', () => {
  assert.equal(periodo('2026-10-25', 'semana'), '2026-10-19'); // domingo → segunda anterior
  assert.equal(periodo('2026-10-19', 'semana'), '2026-10-19');
  assert.equal(periodo('2026-10-25', 'mes'), '2026-10');
  assert.deepEqual(periodos('2026-09-15', '2026-11-02', 'mes'), ['2026-09', '2026-10', '2026-11']);
  assert.deepEqual(periodos('2026-10-01', '2026-10-20', 'semana'), ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19']);
});

test('fatia da obra pelo rateio', () => {
  const r = [{ id: 'A', nome: '', pct: 60 }, { id: 'B', nome: '', pct: 40 }];
  assert.equal(fatia(r), 1);
  assert.equal(fatia(r, 'B'), 0.4);
  assert.equal(fatia(r, 'C'), 0);
});

test('geral de tudo: totais, vencidos e saldo bancário', () => {
  const d = FinanceiroAnalytics.dashboard(dados, { from: '2026-10-01', to: '2026-11-30', agrupar: 'mes' }, HOJE);
  assert.equal(d.resumo.aPagar, 1500);
  assert.equal(d.resumo.pagarAberto, 500);
  assert.equal(d.resumo.pagarVencido, 500);
  assert.equal(d.resumo.aReceber, 5000);
  assert.equal(d.resumo.receberAberto, 2000);
  assert.equal(d.resumo.receberVencido, 0); // vence em 03/11, depois de hoje
  assert.equal(d.resumo.entradas, 3000);
  assert.equal(d.resumo.saidas, 1000);
  assert.equal(d.resumo.resultadoCaixa, 2000);
  assert.equal(d.resumo.saldoBancos, 50_000);
  assert.deepEqual(d.serie.map(s => [s.periodo, s.aPagar, s.aReceber, s.saldoAcumulado]), [
    ['2026-10', 1500, 3000, 2000], ['2026-11', 0, 2000, 2000],
  ]);
  assert.equal(d.proximos[0].parceiro, 'Maria');
  assert.equal(d.vencidas[0].saldo, 500);
});

test('filtro por obra aplica o rateio e esconde o saldo bancário', () => {
  const d = FinanceiroAnalytics.dashboard(dados, { from: '2026-10-01', to: '2026-11-30', obraId: 'B', agrupar: 'mes' }, HOJE);
  assert.equal(d.resumo.aPagar, 200);       // 40% de 500
  assert.equal(d.resumo.pagarVencido, 200);
  assert.equal(d.resumo.aReceber, 2000);
  assert.equal(d.resumo.entradas, 0);
  assert.equal(d.resumo.saldoBancos, null);
  assert.deepEqual(d.porObra.map(o => o.obraId), ['B']);
});

test('por obra distribui o rateio entre as obras', () => {
  const d = FinanceiroAnalytics.dashboard(dados, { from: '2026-10-01', to: '2026-11-30', agrupar: 'semana' }, HOJE);
  const a = d.porObra.find(o => o.obraId === 'A')!;
  const b = d.porObra.find(o => o.obraId === 'B')!;
  assert.equal(a.aPagar, 1300);  // 1000 + 60% de 500
  assert.equal(b.aPagar, 200);
  assert.equal(a.resultado, 2000);
  assert.equal(d.serie[0].periodo, '2026-09-28');
  assert.equal(d.planos[0].plano, 'Vendas');
});
