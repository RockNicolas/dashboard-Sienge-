// O que puxar do Sienge: janela de cada período, validação da escolha e estimativa de cota.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimar, type EntradaEstimativa } from '../src/services/estimativa.service';
import { janelaSync, lerConfigSync } from '../src/services/sync-config.service';
import type { ConfigSync } from '../src/types';

const HOJE = new Date(2026, 9, 31, 15); // 31/10/2026
const janela = (periodo: ConfigSync['periodo'], de = '', ate = '', hoje = HOJE) => janelaSync({ periodo, de, ate }, hoje);

test('janela de cada período (os atalhos andam com o calendário)', () => {
  assert.deepEqual(janela('mes'), { de: '2026-10-01', ate: '2026-10-31' });
  assert.deepEqual(janela('mes-passado'), { de: '2026-09-01', ate: '2026-09-30' });
  assert.deepEqual(janela('3m'), { de: '2026-08-01', ate: '2026-10-31' });
  assert.deepEqual(janela('6m'), { de: '2026-05-01', ate: '2026-10-31' });
  assert.deepEqual(janela('ano'), { de: '2026-01-01', ate: '2026-10-31' });
  assert.deepEqual(janela('12m'), { de: '2025-11-01', ate: '2026-10-31' });
  assert.deepEqual(janela('personalizado', '2026-02-10'), { de: '2026-02-10', ate: '2026-10-31' }, 'sem data final = até hoje');
  assert.deepEqual(janela('personalizado', '2026-02-10', '2026-03-31'), { de: '2026-02-10', ate: '2026-03-31' });
  // virada do ano
  assert.deepEqual(janela('mes-passado', '', '', new Date(2026, 0, 15)), { de: '2025-12-01', ate: '2025-12-31' });
  assert.deepEqual(janela('ano', '', '', new Date(2026, 0, 15)), { de: '2026-01-01', ate: '2026-01-15' });
});

test('escolha vinda da tela: valida período, datas e obras; módulos ligados por padrão', () => {
  assert.throws(() => lerConfigSync({ periodo: 'xyz' }), /período/);
  assert.throws(() => lerConfigSync({ periodo: 'personalizado' }), /data inicial/);
  assert.throws(() => lerConfigSync({ periodo: 'personalizado', de: '2026-05-10', ate: '2026-05-01' }), /antes da inicial/);
  assert.throws(() => lerConfigSync({ periodo: 'mes', obras: [] }), /ao menos uma obra/);
  const c = lerConfigSync({ periodo: 'ano', de: '2026-01-01', obras: ['12', '12', 'x y', 7, '30'], financeiro: false });
  assert.deepEqual(c, { periodo: 'ano', de: '', ate: '', obras: ['12', '30'], fornecedores: true, insumosObra: true, financeiro: false });
  assert.equal(lerConfigSync({ periodo: 'mes' }).obras, null, 'sem obras = todas');
  try { lerConfigSync({}); } catch (e) { assert.equal((e as { status?: number }).status, 400); }
});

const PLANO = { id: 'free', nome: 'Free', rest: 100, bulk: 10 };
const entrada = (escolha: Partial<ConfigSync> = {}, o: Partial<EntradaEstimativa> = {}): EntradaEstimativa => ({
  janela: { de: '2026-10-01', ate: '2026-10-31' },
  escolha: { periodo: 'mes', de: '', ate: '', obras: null, fornecedores: true, insumosObra: true, financeiro: true, ...escolha },
  pedidos: [
    { id: '1', obraId: 'A', fornecedorId: 's1', valido: true },
    { id: '2', obraId: 'A', fornecedorId: 's2', valido: true },
    { id: '3', obraId: 'A', fornecedorId: 's2', valido: true },
    { id: '4', obraId: 'A', fornecedorId: 's9', valido: false }, // cancelado: só conta na listagem
    { id: '5', obraId: 'B', fornecedorId: 's3', valido: true },
    { id: '6', obraId: 'B', fornecedorId: 's3', valido: true },
    { id: '7', obraId: '', fornecedorId: 's1', valido: true }, // pedido sem obra
  ],
  totalPeriodo: 7,
  obras: [{ id: 'A', nome: 'Aurora' }, { id: 'B', nome: 'Bela Vista' }, { id: 'C', nome: 'Centro' }],
  paginasObras: 1,
  itensSalvos: new Set(['1']),
  fornecedoresConhecidos: new Set(['s1']),
  credores: 450,
  plano: PLANO,
  hoje: { rest: 3, bulk: 10 },
  reservaRest: 5,
  gastoNaEstimativa: 1,
  listaGuardada: false,
  mock: false,
  ...o,
});

test('estimativa com todas as obras: itens que faltam, credores, financeiro e Insumos da Obra', () => {
  const e = estimar(entrada());
  // REST: obras 1 + lista 1 página + itens 5 (2, 3, 5, 6, 7; o 1 já veio; o 4 é cancelado) + credores 1+min(2 páginas, 2 faltando) + financeiro 2
  assert.deepEqual(e.rest, { obras: 1, listagem: 1, itens: 5, fornecedores: 3, financeiro: 2, total: 12 });
  // bulk: Insumos da Obra das 2 obras com pedido + 3 do financeiro
  assert.deepEqual(e.bulk, { insumosObra: 2, financeiro: 3, total: 5 });
  assert.equal(e.pedidos, 6);
  assert.equal(e.semObra, 1);
  // com todas as obras, a lista por obra traz as que têm pedido no período
  assert.deepEqual(e.porObra.map(o => [o.id, o.pedidos, o.pendentes]), [['A', 3, 2], ['B', 2, 2]]);
  // hoje restam 3; depois 95 por dia (100 − reserva 5): 12 cabem em 2 dias
  assert.equal(e.dias, 2);
});

test('estimativa com obras escolhidas e módulos desligados', () => {
  const e = estimar(entrada({ obras: ['B'], fornecedores: false, financeiro: false }, { listaGuardada: true, hoje: { rest: 50, bulk: 10 } }));
  // lista já guardada (feita pela estimativa): não gasta de novo; só os 2 pedidos da obra B; pedido sem obra fica de fora
  assert.deepEqual(e.rest, { obras: 1, listagem: 0, itens: 2, fornecedores: 0, financeiro: 0, total: 3 });
  assert.deepEqual(e.bulk, { insumosObra: 1, financeiro: 0, total: 1 });
  assert.equal(e.pedidos, 2);
  assert.equal(e.dias, 1, 'cabe na cota de hoje');
  // cada atualização: listar obras (1) + pedidos obra a obra (1 página da obra B)
  assert.deepEqual(e.porAtualizacao, { rest: 2, bulk: 0 });
  // a lista por obra mostra as escolhidas, mesmo sem pedido no período
  assert.deepEqual(estimar(entrada({ obras: ['C', 'B'] })).porObra.map(o => [o.id, o.pedidos]), [['B', 2], ['C', 0]]);
});

test('listagem: obra a obra quando a empresa tem muitos pedidos no período', () => {
  // 2.000 pedidos na empresa = 10 páginas; 2 obras escolhidas = 2 requisições (uma por obra)
  assert.equal(estimar(entrada({ obras: ['A', 'B'] }, { totalPeriodo: 2000 })).rest.listagem, 2);
  // com todas as obras, a lista completa
  assert.equal(estimar(entrada({}, { totalPeriodo: 2000 })).rest.listagem, 10);
});

test('sem plano não dá para calcular os dias; sem saber quantos credores, conta 1 por fornecedor que falta', () => {
  const e = estimar(entrada({}, { plano: null, hoje: { rest: null, bulk: null }, credores: null }));
  assert.equal(e.dias, 0);
  assert.equal(e.rest.fornecedores, 1 + 2); // 1ª página + s2 e s3
});
