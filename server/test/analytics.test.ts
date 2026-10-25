import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnalyticsService } from '../src/services/analytics.service';
import type { Compra, Consumo, Dados } from '../src/types';

const compra = (o: Partial<Compra>): Compra => ({
  data: '2026-03-10', pedido: '1', fornecedorId: 'f1', fornecedor: 'Forn 1', insumoId: 'i1', insumo: 'Cimento', un: 'sc',
  qtd: 100, preco: 10, valor: 1000, prazoEntrega: null, ...o,
});
const consumo = (o: Partial<Consumo>): Consumo => ({
  data: '2026-03-15', obraId: 'o1', obra: 'Obra X', insumoId: 'i1', insumo: 'Cimento', un: 'sc', qtd: 30, valor: 300, ...o,
});
const F = { from: '2026-01-01', to: '2026-12-31' };
const dados = (compras: Compra[], consumos: Consumo[]): Dados => ({ compras, consumos, obras: [] });

test('comprado × consumido por obra (caso do cimento)', () => {
  const d = AnalyticsService.dashboard(dados(
    [compra({ qtd: 100, valor: 1000 })],
    [consumo({ obraId: 'x', obra: 'Obra X', qtd: 30 }), consumo({ obraId: 'y', obra: 'Obra Y', qtd: 50 })],
  ), F);
  const c = d.compradoVsConsumido[0];
  assert.equal(c.comprado, 100);
  assert.equal(c.consumido, 80);
  assert.equal(c.saldo, 20);
  assert.equal(c.pctUso, 80);
  assert.deepEqual(c.porObra.map(o => [o.obra, o.qtd, o.pctDoComprado]), [['Obra Y', 50, 50], ['Obra X', 30, 30]]);
});

test('filtro de período exclui lançamentos fora do intervalo', () => {
  const d = AnalyticsService.dashboard(dados(
    [compra({ data: '2025-12-31', valor: 500 }), compra({ data: '2026-02-01', valor: 700 })], [],
  ), F);
  assert.equal(d.resumo.comprado, 700);
});

test('filtro de obra afeta só o consumo', () => {
  const d = AnalyticsService.dashboard(dados(
    [compra({ valor: 1000 })],
    [consumo({ obraId: 'x', valor: 100 }), consumo({ obraId: 'y', valor: 200 })],
  ), { ...F, obraId: 'y' });
  assert.equal(d.resumo.comprado, 1000);
  assert.equal(d.resumo.consumido, 200);
});

test('variação de preço não quebra com preço zerado (antes virava Infinity)', () => {
  const d = AnalyticsService.dashboard(dados([compra({ preco: 0, valor: 0 })], []), F);
  const v = d.variacaoPreco[0];
  assert.ok(Number.isFinite(v.min) && Number.isFinite(v.max) && Number.isFinite(v.economiaPotencial));
  assert.equal(v.min, 0);
});

test('economia potencial = (preço pago − menor preço) × quantidade', () => {
  const d = AnalyticsService.dashboard(dados([
    compra({ pedido: '1', preco: 10, qtd: 100, valor: 1000, fornecedor: 'Barato' }),
    compra({ pedido: '2', preco: 12, qtd: 50, valor: 600, fornecedor: 'Caro' }),
  ], []), F);
  const v = d.variacaoPreco[0];
  assert.equal(v.min, 10);
  assert.equal(v.max, 12);
  assert.equal(v.melhorFornecedor, 'Barato');
  assert.equal(v.economiaPotencial, 100); // (12-10) × 50
  assert.equal(v.variacao, 20);
});

test('curva ABC classifica por acumulado e soma 100%', () => {
  const d = AnalyticsService.dashboard(dados([
    compra({ insumoId: 'a', insumo: 'A', valor: 800, qtd: 1 }),
    compra({ insumoId: 'b', insumo: 'B', valor: 150, qtd: 1 }),
    compra({ insumoId: 'c', insumo: 'C', valor: 50, qtd: 1 }),
  ], []), F);
  assert.deepEqual(d.abc.map(i => [i.insumo, i.classe]), [['A', 'A'], ['B', 'B'], ['C', 'C']]);
  assert.equal(d.abc.at(-1)!.acumulado, 100);
});

test('ranking de fornecedores soma 100% de participação', () => {
  const d = AnalyticsService.dashboard(dados([
    compra({ fornecedorId: 'f1', valor: 300 }), compra({ fornecedorId: 'f2', fornecedor: 'F2', valor: 700 }),
  ], []), F);
  assert.equal(d.fornecedores[0].fornecedor, 'F2');
  assert.equal(Math.round(d.fornecedores.reduce((a, f) => a + f.participacao, 0)), 100);
});

test('sem dados não quebra', () => {
  const d = AnalyticsService.dashboard(dados([], []), F);
  assert.equal(d.resumo.comprado, 0);
  assert.equal(d.resumo.pctConsumido, 0);
  assert.deepEqual(d.abc, []);
});
