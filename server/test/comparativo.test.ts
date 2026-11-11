import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComparativoService, deslocar, fimPeriodo, inicioPeriodo, rotulo } from '../src/services/comparativo.service';
import type { Compra, ContaPagar, ContaReceber, Dados, DadosFinanceiros } from '../src/types';

const HOJE = '2026-11-10';
const cobertura = { compras: { de: '2024-01-01', ate: HOJE }, financeiro: { de: '2024-01-01', ate: '2027-05-31' } };

const compra = (o: Partial<Compra>): Compra => ({
  data: '2026-11-03', pedido: '1', fornecedorId: 'f1', fornecedor: 'Gerdau', insumoId: 'i1', insumo: 'Aço', un: 'kg',
  qtd: 100, preco: 10, valor: 1000, prazoEntrega: null, obraId: 'A', obra: 'Obra A', item: 1, codigo: '', detalhe: '', marca: '',
  precoUnitario: 10, situacao: '', autorizado: true, atrasado: false, comprador: '', condicaoPagamento: '', ...o,
});
const pagar = (o: Partial<ContaPagar>) => ({
  vencimento: '2026-11-05', valor: 500, pago: 500, saldo: 0, obras: [{ id: 'A', nome: 'Obra A', pct: 100 }], ...o,
}) as ContaPagar;
const receber = (o: Partial<ContaReceber>) => ({
  vencimento: '2026-11-08', valor: 2000, recebido: 0, saldo: 2000, obras: [{ id: 'A', nome: 'Obra A', pct: 100 }], ...o,
}) as ContaReceber;

const dados: Dados = {
  obras: [],
  consumos: [],
  compras: [
    compra({}),                                                                    // nov/26 (até dia 10)
    compra({ data: '2026-11-25', pedido: '9', valor: 9999 }),                       // depois de hoje: fora
    compra({ data: '2026-10-07', pedido: '2', qtd: 100, preco: 8, valor: 800 }),    // out/26, dentro do 1º ao 10
    compra({ data: '2026-10-20', pedido: '3', valor: 5000, fornecedorId: 'f2', fornecedor: 'Votorantim' }), // out/26 depois do dia 10
    compra({ data: '2025-11-04', pedido: '4', valor: 700 }),                        // nov/25 (mesmo ponto)
  ],
};
const fin: DadosFinanceiros = {
  pagar: [pagar({}), pagar({ vencimento: '2026-10-02', valor: 300, pago: 300, obras: [{ id: 'A', nome: 'Obra A', pct: 50 }, { id: 'B', nome: 'Obra B', pct: 50 }] })],
  receber: [receber({})],
  movimentos: [], contas: [], saldos: [], titulos: [], titulosReceber: [], obras: [],
};

test('períodos: semana começa na segunda, fim de mês e de ano, deslocar', () => {
  assert.equal(inicioPeriodo('2026-11-10', 'semana'), '2026-11-09');
  assert.equal(inicioPeriodo('2026-11-08', 'semana'), '2026-11-02'); // domingo → segunda anterior
  assert.equal(fimPeriodo('2026-02-01', 'mes'), '2026-02-28');
  assert.equal(fimPeriodo('2026-01-01', 'ano'), '2026-12-31');
  assert.equal(deslocar('2026-01-01', 'mes', 1), '2025-12-01');   // vira o ano
  assert.equal(deslocar('2026-11-09', 'semana', 1), '2026-11-02');
  assert.equal(rotulo('2026-11-01', '2026-11-30', 'mes'), 'nov/26');
  assert.equal(rotulo('2026-11-01', '2026-11-10', 'mes'), 'nov/26 (até 10/11)');
  assert.equal(rotulo('2026-11-02', '2026-11-08', 'semana'), '02/11 a 08/11/26');
});

test('mensal com mês em andamento: compara no mesmo ponto (1–10/nov × 1–10/out × 1–10/nov/25)', () => {
  const c = ComparativoService.calcular(dados, fin, { agrupar: 'mes', ref: HOJE, hoje: HOJE, cobertura });
  assert.equal(c.parcial, true);
  assert.deepEqual([c.periodos.atual.de, c.periodos.atual.ate], ['2026-11-01', '2026-11-10']);
  assert.deepEqual([c.periodos.anterior.de, c.periodos.anterior.ate], ['2026-10-01', '2026-10-10']);
  assert.deepEqual([c.periodos.anoAnterior?.de, c.periodos.anoAnterior?.ate], ['2025-11-01', '2025-11-10']);
  assert.deepEqual(c.compras.comprado, { atual: 1000, anterior: 800, anoAnterior: 700 });
  assert.deepEqual(c.resultado.despesas, { atual: 500, anterior: 300, anoAnterior: 0 });
  assert.deepEqual(c.resultado.resultado, { atual: 1500, anterior: -300, anoAnterior: 0 });
  // material: preço subiu de 8 para 10 → encareceu 2 × 100 kg
  const aco = c.materiais.find(m => m.insumoId === 'i1')!;
  assert.equal(aco.precoAtual, 10);
  assert.equal(aco.precoAnterior, 8);
  assert.equal(aco.impactoPreco, 200);
  assert.equal(c.avisos.length, 0);
  // série: 12 meses terminando no atual, com o ano anterior
  assert.equal(c.serie.length, 12);
  assert.equal(c.serie.at(-1)?.periodo, '2026-11');
  assert.equal(c.serie.at(-2)?.comprado, 5800);          // outubro inteiro na série
  assert.equal(c.serie.at(-1)?.compradoAnoAnterior, 700);
});

test('mês já fechado: compara os meses inteiros', () => {
  const c = ComparativoService.calcular(dados, fin, { agrupar: 'mes', ref: '2026-10-15', hoje: HOJE, cobertura });
  assert.equal(c.parcial, false);
  assert.deepEqual([c.periodos.atual.de, c.periodos.atual.ate], ['2026-10-01', '2026-10-31']);
  assert.equal(c.compras.comprado.atual, 5800);
  assert.equal(c.fornecedores[0].nome, 'Votorantim');   // maior variação primeiro
});

test('anual: sem "ano anterior" separado e série de 5 anos', () => {
  const c = ComparativoService.calcular(dados, fin, { agrupar: 'ano', ref: HOJE, hoje: HOJE, cobertura });
  assert.equal(c.periodos.anoAnterior, null);
  assert.deepEqual([c.periodos.anterior.de, c.periodos.anterior.ate], ['2025-01-01', '2025-11-10']);
  assert.equal(c.compras.comprado.anterior, 700);
  assert.equal(c.compras.comprado.anoAnterior, null);
  // dados a partir de 2024: os anos de antes não aparecem zerados no gráfico
  assert.deepEqual(c.serie.map(s => s.periodo), ['2024', '2025', '2026']);
});

test('filtro de obra usa o rateio do financeiro', () => {
  const c = ComparativoService.calcular(dados, fin, { agrupar: 'mes', ref: HOJE, hoje: HOJE, obraId: 'B', cobertura });
  assert.equal(c.compras.comprado.atual, 0);
  assert.equal(c.resultado.despesas.anterior, 150);       // 50% de 300
  assert.deepEqual(c.obras.map(o => o.obraId), ['B']);
});

test('período anterior fora do que foi sincronizado vira aviso', () => {
  const c = ComparativoService.calcular(dados, fin, {
    agrupar: 'mes', ref: HOJE, hoje: HOJE,
    cobertura: { compras: { de: '2026-01-01', ate: HOJE }, financeiro: null },
  });
  assert.equal(c.periodos.anoAnterior?.semDados, true);
  assert.equal(c.periodos.anterior.semDados, false);
  assert.match(c.avisos[0], /Sem dados sincronizados para nov\/25/);
  // gráfico: só de jan/26 em diante, e sem "ano anterior" (não sincronizado) em vez de zero
  assert.equal(c.serie[0].periodo, '2026-01');
  assert.equal(c.serie.at(-1)?.compradoAnoAnterior, null);
});

test('cards da Visão geral: período anterior de mesmo tamanho', () => {
  assert.deepEqual(ComparativoService.periodoAnterior('2026-11-01', '2026-11-10'), { de: '2026-10-22', ate: '2026-10-31' });
  const a = ComparativoService.resumoAnterior(dados, { de: '2026-10-01', ate: '2026-10-31' }, undefined, cobertura.compras);
  assert.equal(a.comprado, 5800);
  assert.equal(a.pedidos, 2);
  assert.equal(a.semDados, false);
});
