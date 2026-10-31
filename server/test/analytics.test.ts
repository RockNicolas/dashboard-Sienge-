import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnalyticsService } from '../src/services/analytics.service';
import type { Compra, Consumo, Dados, FornecedorCadastro } from '../src/types';

const compra = (o: Partial<Compra>): Compra => ({
  data: '2026-03-10', pedido: '1', fornecedorId: 'f1', fornecedor: 'Forn 1', insumoId: 'i1', insumo: 'Cimento', un: 'sc',
  qtd: 100, preco: 10, valor: 1000, prazoEntrega: null, obraId: 'x', obra: 'Obra X',
  item: 1, codigo: '', detalhe: '', marca: '', precoUnitario: 10, situacao: 'FULLY_DELIVERED', autorizado: true, atrasado: false,
  comprador: '', condicaoPagamento: '', ...o,
});
const consumo = (o: Partial<Consumo>): Consumo => ({
  data: '2026-03-15', obraId: 'o1', obra: 'Obra X', insumoId: 'i1', insumo: 'Cimento', un: 'sc', qtd: 30, valor: 300, ...o,
});
const F = { from: '2026-01-01', to: '2026-12-31' };
const dados = (compras: Compra[], consumos: Consumo[], fornecedores: FornecedorCadastro[] = []): Dados =>
  ({ compras, consumos, obras: [], fornecedores });

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

test('filtro de obra vale para compras (obra do pedido) e consumo', () => {
  const d = AnalyticsService.dashboard(dados(
    [compra({ obraId: 'x', valor: 1000 }), compra({ pedido: '2', obraId: 'y', valor: 400 }), compra({ pedido: '3', obraId: '', obra: '', valor: 50 })],
    [consumo({ obraId: 'x', valor: 100 }), consumo({ obraId: 'y', valor: 200 })],
  ), { ...F, obraId: 'y' });
  assert.equal(d.resumo.comprado, 400);
  assert.equal(d.resumo.consumido, 200);
  assert.deepEqual(d.comprasObra.map(o => o.obraId), ['y']);
});

test('compras por obra: pedido sem obra vira "Sem obra"', () => {
  const d = AnalyticsService.dashboard(dados([
    compra({ obraId: 'x', obra: 'Obra X', valor: 300 }),
    compra({ pedido: '2', obraId: '', obra: '', valor: 700 }),
  ], []), F);
  assert.deepEqual(d.comprasObra.map(o => [o.obra, o.valor, o.participacao]), [['Sem obra', 700, 70], ['Obra X', 300, 30]]);
  assert.equal(d.resumo.obrasComCompra, 1);
});

test('histórico do material: último preço, mín/médio/máx e preço médio do mês', () => {
  const d = AnalyticsService.dashboard(dados([
    compra({ pedido: '1', data: '2026-01-10', qtd: 100, preco: 10, valor: 1000, fornecedor: 'A' }),
    compra({ pedido: '2', data: '2026-01-20', qtd: 100, preco: 12, valor: 1200, fornecedor: 'B' }),
    compra({ pedido: '3', data: '2026-03-05', qtd: 50, preco: 11, valor: 550, fornecedor: 'C', fornecedorId: 'f3' }),
  ], []), F);
  const h = d.historico[0];
  assert.equal(h.compras, 3);
  assert.equal(h.fornecedores, 2);
  assert.equal(h.precoMin, 10);
  assert.equal(h.precoMax, 12);
  assert.equal(h.precoMedio, 11);          // 2750 / 250
  assert.equal(h.variacao, 20);
  assert.deepEqual([h.ultimoPreco, h.ultimaData, h.ultimoFornecedor], [11, '2026-03-05', 'C']);
  assert.deepEqual(h.precoMensal, [{ mes: '2026-01', valor: 11 }, { mes: '2026-03', valor: 11 }]);
});

test('linhas de compra vêm das mais recentes para as mais antigas', () => {
  const d = AnalyticsService.dashboard(dados([
    compra({ pedido: '9', data: '2026-01-10' }), compra({ pedido: '10', data: '2026-02-01' }), compra({ pedido: '11', data: '2026-02-01', item: 2 }),
  ], []), F);
  assert.deepEqual(d.compras.map(c => c.pedido), ['11', '10', '9']);
  assert.equal(d.comprasTotal, 3);
});

test('ranking de fornecedores: cadastro do credor, curva ABC, ticket médio e pedidos atrasados', () => {
  const cad: FornecedorCadastro = { id: 'f2', nome: 'F2 LTDA', fantasia: 'F2', cnpj: '00.000.000/0001-00', cidade: 'Recife', telefone: '', email: '', ativo: true };
  const d = AnalyticsService.dashboard(dados([
    compra({ fornecedorId: 'f2', fornecedor: 'F2 LTDA', pedido: '1', valor: 800, atrasado: true, obraId: 'x' }),
    compra({ fornecedorId: 'f2', fornecedor: 'F2 LTDA', pedido: '2', valor: 100, obraId: 'y', data: '2026-04-01' }),
    compra({ fornecedorId: 'f1', pedido: '3', valor: 100 }),
  ], [], [cad]), F);
  const [f2, f1] = d.fornecedores;
  assert.equal(f2.cadastro?.cnpj, '00.000.000/0001-00');
  assert.equal(f1.cadastro, null);
  assert.deepEqual([f2.pedidos, f2.ticketMedio, f2.obras, f2.atrasados, f2.ultimaCompra], [2, 450, 2, 1, '2026-04-01']);
  assert.deepEqual(d.fornecedores.map(f => [f.acumulado, f.classe]), [[90, 'B'], [100, 'C']]);
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
