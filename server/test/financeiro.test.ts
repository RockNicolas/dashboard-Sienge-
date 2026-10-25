import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarContaCorrente, normalizarContaPagar, normalizarContaReceber, normalizarMovimento, normalizarSaldo,
} from '../src/services/financeiro.service';

// payloads no formato das especificações oficiais do Sienge (bulk-data-outcome-v1, income, bank-movement...)
const HOJE = '2026-10-25';

const parcelaPagar = {
  companyId: 1, companyName: 'Construtora', creditorId: 55, creditorName: 'Cimento SA',
  billId: 900, installmentId: 2, documentIdentificationId: 'NF', documentNumber: '1234',
  originalAmount: 1000, balanceAmount: 400, dueDate: '2026-10-20', issueDate: '2026-09-01', billDate: '2026-09-01',
  authorizationStatus: 'S',
  paymentsCategories: [{ costCenterId: 10, costCenterName: 'Obra A', financialCategoryId: '2.01', financialCategoryName: 'Materiais', financialCategoryRate: 100 }],
  buildingsCosts: [{ buildingId: 7, buildingName: 'Residencial X', rate: 100 }],
  payments: [
    { netAmount: 350, paymentDate: '2026-10-01' },
    { netAmount: 250, paymentDate: '2026-10-10' },
  ],
};

test('contas a pagar: valores, pagamentos, rateios e situação', () => {
  const c = normalizarContaPagar(parcelaPagar, HOJE);
  assert.equal(c.credor, 'Cimento SA');
  assert.equal(c.documento, 'NF 1234');
  assert.equal(c.valor, 1000);
  assert.equal(c.saldo, 400);
  assert.equal(c.pago, 600);
  assert.equal(c.ultimoPagamento, '2026-10-10');
  assert.equal(c.situacao, 'vencida'); // saldo > 0 e venceu em 20/10
  assert.equal(c.autorizada, true);
  assert.deepEqual(c.planos, [{ id: '2.01', nome: 'Materiais', pct: 100 }]);
  assert.deepEqual(c.centrosCusto, [{ id: '10', nome: 'Obra A', pct: 100 }]);
  assert.deepEqual(c.obras, [{ id: '7', nome: 'Residencial X', pct: 100 }]);
});

test('situação: quitada sem saldo, aberta antes do vencimento', () => {
  assert.equal(normalizarContaPagar({ ...parcelaPagar, balanceAmount: 0 }, HOJE).situacao, 'quitada');
  assert.equal(normalizarContaPagar({ ...parcelaPagar, dueDate: '2026-11-05' }, HOJE).situacao, 'aberta');
});

test('contas a receber: cliente, recebimentos e unidade', () => {
  const c = normalizarContaReceber({
    companyId: 1, clientId: 3, clientName: 'Maria', billId: 77, installmentId: 5,
    originalAmount: 2500, balanceAmount: 2500, dueDate: '2026-11-10', defaulterSituation: 'N', mainUnit: 'Apto 101',
    receipts: [], receiptsCategories: [{ financialCategoryId: '1.01', financialCategoryName: 'Venda de unidades', financialCategoryRate: 100 }],
  }, HOJE);
  assert.equal(c.cliente, 'Maria');
  assert.equal(c.recebido, 0);
  assert.equal(c.ultimoRecebimento, null);
  assert.equal(c.situacao, 'aberta');
  assert.equal(c.unidade, 'Apto 101');
  assert.equal(c.planos[0].nome, 'Venda de unidades');
});

test('movimento bancário: saída fica negativa', () => {
  const base = { bankMovementId: 1, bankMovementDate: '2026-10-02', accountNumber: '123-4', bankMovementAmount: 600, bankMovementReconcile: 'S' };
  assert.equal(normalizarMovimento({ ...base, bankMovementOperationType: 'D' }).valor, -600);
  assert.equal(normalizarMovimento({ ...base, bankMovementOperationType: 'C' }).valor, 600);
  const m = normalizarMovimento({ ...base, billId: 900, creditorName: 'Cimento SA' });
  assert.equal(m.conciliado, true);
  assert.equal(m.tituloId, '900');
  assert.equal(m.parceiro, 'Cimento SA');
});

test('contas correntes e saldos', () => {
  const c = normalizarContaCorrente({
    accountNumber: '123-4', accountName: 'Itaú obra', bankName: 'Itaú', agencyNumber: '0001',
    accountType: { id: 'B', description: 'Bancária' }, companyId: 1, accountStatus: 'DISABLED',
  });
  assert.equal(c.tipo, 'Bancária');
  assert.equal(c.ativa, false);
  const s = normalizarSaldo({ accountNumber: 'CAIXA', companyId: 1000, balanceDate: '2026-10-25', amount: 1500.5, reconciledAmount: 1200 });
  assert.deepEqual(s, { conta: 'CAIXA', empresaId: '1000', data: '2026-10-25', saldo: 1500.5, conciliado: 1200 });
});
