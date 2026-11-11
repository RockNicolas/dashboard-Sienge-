import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarContaCorrente, normalizarContaPagar, normalizarContaReceber, normalizarMovimento, normalizarSaldo, normalizarTitulo, normalizarTituloReceber,
} from '../src/services/financeiro.service';
import { agruparTitulos } from '../src/services/financeiro-analytics.service';

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
  // tipos reais do Sienge: S = saída, E = entrada; valor negativo = estorno (efeito contrário)
  assert.equal(normalizarMovimento({ ...base, bankMovementOperationType: 'S' }).valor, -600);
  assert.equal(normalizarMovimento({ ...base, bankMovementOperationType: 'E' }).valor, 600);
  assert.equal(normalizarMovimento({ ...base, bankMovementOperationType: 'S', bankMovementAmount: -150 }).valor, 150);
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

// título 25050 do Sienge (tela "Cadastro de títulos a pagar"), no formato do bulk /outcome + REST /bills
const tituloTRCT = {
  companyId: 1, companyName: 'CONSTRUTORA MONTE CRISTO LTDA', creditorId: 2457, creditorName: 'ISADORA MARQUES LINS DDE OLIVEIRA',
  billId: 25050, installmentId: 1, documentIdentificationId: 'TRCT', documentIdentificationName: 'TERMO DE RESCISÃO DO CONTRATO DE TRABALH',
  documentNumber: 'ISADORA MARQUES', issueDate: '2026-09-28', billDate: '2026-09-28', installmentBaseDate: '2026-09-01', dueDate: '2026-10-08',
  indexerId: 0, indexerName: 'REAL', originalAmount: 3225.23, discountAmount: 0, taxAmount: 0, balanceAmount: 0, authorizationStatus: 'S',
  paymentsCategories: [{ costCenterId: 9000, costCenterName: 'ADM CENTRAL - MONTE CRISTO', financialCategoryId: '2.03.02.06', financialCategoryName: 'Rescisões', financialCategoryRate: 100 }],
  buildingsCosts: [],
  payments: [{ netAmount: 3225.23, paymentDate: '2026-10-08' }],
};

test('título a pagar 25050 (TRCT): campos do cadastro do Sienge', () => {
  const p = normalizarContaPagar(tituloTRCT, HOJE);
  assert.equal(p.tituloId, '25050');
  assert.equal(p.documentoTipo, 'TRCT');
  assert.equal(p.documentoNome, 'TERMO DE RESCISÃO DO CONTRATO DE TRABALH');
  assert.equal(p.numeroDocumento, 'ISADORA MARQUES');
  assert.equal(p.credor, 'ISADORA MARQUES LINS DDE OLIVEIRA');
  assert.equal(p.emissao, '2026-09-28');
  assert.equal(p.competencia, '2026-09-28');
  assert.equal(p.dataBase, '2026-09-01');
  assert.equal(p.vencimento, '2026-10-08');
  assert.equal(p.indexador, 'REAL');
  assert.equal(p.valor, 3225.23);
  assert.equal(p.situacao, 'quitada'); // "PG" no Sienge
  assert.equal(p.autorizada, true);
  assert.deepEqual(p.apropriacoes, [{ centroCustoId: '9000', centroCusto: 'ADM CENTRAL - MONTE CRISTO', planoId: '2.03.02.06', plano: 'Rescisões', pct: 100 }]);
  // sem apropriação por obra: entra pelo centro de custo
  assert.deepEqual(p.obras, [{ id: '9000', nome: 'ADM CENTRAL - MONTE CRISTO', pct: 100 }]);

  const t = normalizarTitulo({
    id: 25050, notes: 'REFERENTE A RESCISAO DE ISADORA MARQUES LINS DDE OLIVEIRA\nPIX: 85.9.8208.6874',
    totalInvoiceAmount: 3225.23, discount: 0, installmentsNumber: 1, originId: 'CP',
  });
  assert.equal(t.valorTotal, 3225.23);
  assert.equal(t.parcelas, 1);
  assert.equal(t.origem, 'Contas a Pagar');
  assert.match(t.observacao, /^REFERENTE A RESCISAO/);
});

test('títulos agrupam as parcelas e usam o /bills quando disponível', () => {
  const p1 = normalizarContaPagar({ ...parcelaPagar, installmentId: 1, balanceAmount: 0, payments: [{ netAmount: 500, paymentDate: '2026-09-20' }], dueDate: '2026-09-20' }, HOJE);
  const p2 = normalizarContaPagar({ ...parcelaPagar, installmentId: 2, originalAmount: 500, balanceAmount: 500, payments: [], dueDate: '2026-10-20' }, HOJE);
  const info = normalizarTitulo({ id: 900, totalInvoiceAmount: 1500, installmentsNumber: 3, notes: 'obs' });
  const [t] = agruparTitulos([p1, p2], new Set(['900']), new Map([['900', info]]), HOJE);
  assert.equal(t.parcelas, 3);          // do /bills (uma parcela ainda fora da janela)
  assert.equal(t.parcelasQuitadas, 1);
  assert.equal(t.valorTotal, 1500);
  assert.equal(t.saldo, 500);           // 1ª quitada, 2ª em aberto
  assert.equal(t.situacao, 'vencida');  // a 2ª venceu em 20/10
  assert.equal(t.proximoVencimento, '2026-10-20');
  assert.equal(t.observacao, 'obs');
});

// título a receber 277 do Sienge (caução de medição), no formato do bulk /income + REST receivable-bills
test('título a receber 277 (CAU): campos do cadastro do Sienge', () => {
  const p = normalizarContaReceber({
    companyId: 1, companyName: 'CONSTRUTORA MONTE CRISTO LTDA', clientId: 1, clientName: 'AMBIENTAL CEARA 2 SPE S.A',
    billId: 277, installmentId: 1, installmentNumber: '1', documentIdentificationId: 'CAU', documentIdentificationName: 'CAUÇÃO',
    documentNumber: 'PACAJUS', issueDate: '2026-09-25', billDate: '2026-09-25', installmentBaseDate: '2025-10-01', dueDate: '2026-09-25',
    indexerName: 'REAL', originalAmount: 41490.33, balanceAmount: 41490.33, originId: 'ME', paymentTerm: { id: 'PM', description: 'PARCELA MENSAL' },
    receiptsCategories: [{ costCenterId: 1, costCenterName: 'CT Nº 4600087643-2025 - PACAJUS - AMB 01', financialCategoryId: '1.02.01.01', financialCategoryName: 'Receita de Serviço', financialCategoryRate: 100 }],
    receipts: [],
  }, HOJE);
  assert.equal(p.documentoTipo, 'CAU');
  assert.equal(p.documentoNome, 'CAUÇÃO');
  assert.equal(p.numeroDocumento, 'PACAJUS');
  assert.equal(p.cliente, 'AMBIENTAL CEARA 2 SPE S.A');
  assert.equal(p.origem, 'Medições');
  assert.equal(p.condicao, 'PM');
  assert.equal(p.dataBase, '2025-10-01');
  assert.equal(p.situacao, 'vencida'); // "NP" no Sienge e já passou do vencimento
  assert.deepEqual(p.apropriacoes, [{ centroCustoId: '1', centroCusto: 'CT Nº 4600087643-2025 - PACAJUS - AMB 01', planoId: '1.02.01.01', plano: 'Receita de Serviço', pct: 100 }]);
  assert.deepEqual(p.obras, [{ id: '1', nome: 'CT Nº 4600087643-2025 - PACAJUS - AMB 01', pct: 100 }]);

  const info = normalizarTituloReceber({
    receivableBillId: 277, receivableBillValue: 41490.33, customerId: 1,
    note: 'Caução referente à medição Nº. 7 da obra 1 do contrato CREC/PACAJUS. Documento(s) origem: NFSE/890.',
  });
  const [t] = agruparTitulos([p], new Set(['277']), new Map([['277', info]]), HOJE);
  assert.equal(t.tipo, 'receber');
  assert.equal(t.parceiro, 'AMBIENTAL CEARA 2 SPE S.A');
  assert.equal(t.valorTotal, 41490.33);
  assert.equal(t.parcelas, 1);
  assert.equal(t.origem, 'Medições');
  assert.match(t.observacao, /^Caução referente à medição/);
});
