import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limiteDaApi, planoPorId, planoPorLimite } from '../src/services/planos';

// cabeçalhos reais devolvidos pelo Sienge para um usuário do plano Free
const headersFree = {
  'ratelimit-limit': '100', 'ratelimit-remaining': '4', 'x-ratelimit-limit-day': '100',
  'x-ratelimit-limit-second': '100', 'x-ratelimit-remaining-day': '4',
};

test('lê o limite diário dos cabeçalhos do Sienge', () => {
  assert.equal(limiteDaApi(headersFree), 100);
  assert.equal(limiteDaApi(null), null);
  assert.equal(limiteDaApi({ 'ratelimit-limit': '100' }), null); // sem o cabeçalho diário não dá para afirmar
});

test('identifica o plano pelo limite diário', () => {
  assert.equal(planoPorLimite(100)?.nome, 'Free');
  assert.equal(planoPorLimite(10_000)?.nome, 'Enterprise');
  assert.equal(planoPorLimite(1234), null);
});

test('planos por id', () => {
  assert.equal(planoPorId('start')?.rest, 1_000);
  assert.equal(planoPorId(''), null);
});
