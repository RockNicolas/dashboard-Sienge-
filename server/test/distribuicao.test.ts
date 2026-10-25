import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distribuirConsumo, mesesDoPeriodo } from '../src/services/distribuicao';
import type { ItemApropriacao } from '../src/types';

const obra = { id: 'o1', nome: 'Obra X' };
const item = (o: Partial<ItemApropriacao>): ItemApropriacao => ({
  insumoId: '1', insumo: 'Cimento', un: 'sc', qtd: 1800, precoMedio: 43.3073, total: 77953.2, participacao: 0, acumulado: 0, ...o,
});

test('meses do período 01/07 a 22/10 (114 dias)', () => {
  const m = mesesDoPeriodo('2026-07-01', '2026-10-22');
  assert.deepEqual(m.map(x => [x.mes, x.dias, x.ultimo]), [
    ['2026-07', 31, '2026-07-31'], ['2026-08', 31, '2026-08-31'], ['2026-09', 30, '2026-09-30'], ['2026-10', 22, '2026-10-22'],
  ]);
});

test('distribuição preserva exatamente quantidade e valor de cada insumo', () => {
  const itens = [item({}), item({ insumoId: '2', qtd: 97.33, total: 17032.75 }), item({ insumoId: '3', qtd: 1, total: 0.87 })];
  const linhas = distribuirConsumo(itens, '2026-07-01', '2026-10-22', obra, true);
  for (const it of itens) {
    const l = linhas.filter(x => x.insumoId === it.insumoId);
    assert.equal(Math.round(l.reduce((a, x) => a + x.qtd, 0) * 1e4) / 1e4, it.qtd);
    assert.equal(Math.round(l.reduce((a, x) => a + x.valor, 0) * 100) / 100, it.total);
  }
});

test('distribui proporcional aos dias', () => {
  const l = distribuirConsumo([item({ qtd: 114, total: 1140 })], '2026-07-01', '2026-10-22', obra, true);
  assert.deepEqual(l.map(x => [x.data, x.qtd]), [['2026-07-31', 31], ['2026-08-31', 31], ['2026-09-30', 30], ['2026-10-22', 22]]);
});

test('sem distribuir lança tudo no fim do período', () => {
  const l = distribuirConsumo([item({})], '2026-07-01', '2026-10-22', obra, false);
  assert.equal(l.length, 1);
  assert.equal(l[0].data, '2026-10-22');
  assert.equal(l[0].valor, 77953.2);
  assert.equal(l[0].obraId, 'o1');
});

test('período de um único mês e de um único dia', () => {
  assert.equal(distribuirConsumo([item({})], '2026-03-01', '2026-03-31', obra, true).length, 1);
  assert.equal(distribuirConsumo([item({})], '2026-03-05', '2026-03-05', obra, true).length, 1);
});
