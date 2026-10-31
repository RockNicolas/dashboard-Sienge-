// Normalizadores de suprimentos com payloads no formato das especificações oficiais do Sienge
// (purchase-orders-v1, creditor-v1, bulk-data-building-resource-v1) e cálculos de custo por obra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarCredor, normalizarItemCompra, pedidoValido } from '../src/services/sienge.service';
import { normalizarInsumoObra } from '../src/services/custos-obra.service';
import { CustosObraAnalytics } from '../src/services/custos-obra-analytics.service';

// PurchaseOrder (exemplos da spec purchase-orders-v1)
const pedido = {
  id: 1, formattedPurchaseOrderId: '1', status: 'PENDING', authorized: true, disapproved: false, deliveryLate: true,
  consistent: 'CONSISTENT', supplierId: 10, buildingId: 15, buyerId: 'comprador', date: '2018-03-11', costCenterId: 100,
  totalAmount: 15200.85, paymentCondition: 'À vista',
};
// PurchaseOrderItem
const item = {
  itemNumber: 1, resourceId: 1, resourceDescription: 'Cimento', resourceCode: 'M0012', detailId: 1, detailDescription: 'Detalhe X',
  trademarkId: 1, trademarkDescription: 'Marca X', unitOfMeasure: 'kg', quantity: 100, unitPrice: 10.99, netPrice: 10.5,
};

test('item do pedido de compra: campos do Sienge e valor = quantidade × preço líquido', () => {
  const c = normalizarItemCompra(pedido, item, new Map([['15', 'Residencial Aurora']]));
  assert.deepEqual(c, {
    data: '2018-03-11', pedido: '1', fornecedorId: '10', fornecedor: 'Fornecedor 10',
    insumoId: '1', insumo: 'Cimento', un: 'kg', qtd: 100, preco: 10.5, valor: 1050, prazoEntrega: null,
    obraId: '15', obra: 'Residencial Aurora', item: 1, codigo: 'M0012', detalhe: 'Detalhe X', marca: 'Marca X',
    precoUnitario: 10.99, situacao: 'PENDING', autorizado: true, atrasado: true, comprador: 'comprador', condicaoPagamento: 'À vista',
  });
});

test('item sem preço líquido usa o preço unitário; pedido sem obra fica sem obra', () => {
  const c = normalizarItemCompra({ ...pedido, buildingId: null }, { ...item, netPrice: undefined });
  assert.equal(c.preco, 10.99);
  assert.equal(c.valor, 1099);
  assert.deepEqual([c.obraId, c.obra], ['', '']);
});

test('pedidos cancelados e reprovados não contam como compra', () => {
  assert.equal(pedidoValido(pedido), true);
  assert.equal(pedidoValido({ ...pedido, status: 'CANCELED' }), false);
  assert.equal(pedidoValido({ ...pedido, disapproved: true }), false);
});

test('credor: nome, fantasia, CNPJ/CPF, cidade, telefone principal e e-mail', () => {
  const f = normalizarCredor({
    id: 10, name: 'CIMENTOS DO SUL LTDA', tradeName: 'Cimentos do Sul', cpf: null, cnpj: '12345678000190', active: true,
    address: { cityId: 1, cityName: 'Florianópolis', streetName: 'Rua dos Acarás', number: '321' },
    phones: [{ ddd: '48', number: '3333-1111', main: false }, { ddd: '48', number: '99999-8888', main: true }],
    contacts: [{ name: 'João', email: '' }, { name: 'Maria', email: 'maria@cimentos.com' }],
  });
  assert.deepEqual(f, {
    id: '10', nome: 'CIMENTOS DO SUL LTDA', fantasia: 'Cimentos do Sul', cnpj: '12345678000190', cidade: 'Florianópolis',
    telefone: '(48) 99999-8888', email: 'maria@cimentos.com', ativo: true,
  });
  assert.equal(normalizarCredor({ id: 2, name: 'José', cpf: '12345678900' }).cnpj, '12345678900');
});

// BuildingResourceDto (exemplos da spec bulk-data-building-resource-v1)
const insumo = (o: Record<string, unknown> = {}) => normalizarInsumoObra({
  id: 1, buildingId: 7, buildingName: 'Condomínio da Felicidade', description: 'Cimento', unitOfMeasure: 'kg', unitPrice: 40.1236,
  resourceCode: 'MA001', category: 'MATERIAL', resourceGroup: 'Materiais de Consumo', detailDescription: 'CP II E 32', trademarkDescription: 'ACME',
  buildingCostEstimationItems: [
    { buildingUnitName: 'Salão de Festas', wbsCode: '01.001.000.001', description: 'Alvenaria de Tijolo Furado', totalPrice: 1800.5, quantity: 560.3205 },
  ],
  buildingAppropriations: {
    pending: [{ documentLabel: 'CT/0001', date: '2026-02-01', costEstimationItemReference: '01.001.000.001', costEstimationItemDescription: 'Alvenaria de Tijolo Furado', quantity: 10, percentage: 25, value: 200 }],
    attended: [
      { documentLabel: 'NF/001', date: '2025-12-20', movementDate: '2025-12-21', costEstimationItemReference: '01.001.000.001', costEstimationItemDescription: 'Alvenaria de Tijolo Furado', quantity: 20, percentage: 25, value: 500 },
      { documentLabel: 'NF/002', date: '2026-03-10', costEstimationItemReference: '01.001.000.001', costEstimationItemDescription: 'Alvenaria de Tijolo Furado', quantity: 30, percentage: 25, value: 900 },
    ],
  },
  ...o,
});

test('insumo da obra: orçado, pendentes e atendidas como o Sienge manda', () => {
  const i = insumo();
  assert.deepEqual([i.obraId, i.obra, i.insumoId, i.categoria, i.codigo], ['7', 'Condomínio da Felicidade', '1', 'MATERIAL', 'MA001']);
  assert.deepEqual(i.orcamento, [{ edt: '01.001.000.001', servico: 'Alvenaria de Tijolo Furado', unidade: 'Salão de Festas', qtd: 560.3205, valor: 1800.5 }]);
  assert.equal(i.pendentes[0].documento, 'CT/0001');
  assert.deepEqual(i.atendidas.map(a => [a.documento, a.data, a.valor]), [['NF/001', '2025-12-20', 500], ['NF/002', '2026-03-10', 900]]);
});

test('custo da obra: orçado × pendente × atendido, por tipo, serviço e insumo', () => {
  const mo = insumo({
    id: 2, description: 'Pedreiro', category: 'LABOR', unitOfMeasure: 'h',
    buildingCostEstimationItems: [{ wbsCode: '02.001', description: 'Estrutura', totalPrice: 1000, quantity: 100 }],
    buildingAppropriations: { pending: [], attended: [{ documentLabel: 'ME/1', date: '2026-01-15', costEstimationItemReference: '02.001', costEstimationItemDescription: 'Estrutura', quantity: 120, value: 1200 }] },
  });
  const [o] = CustosObraAnalytics.custos([insumo(), mo], { from: '2026-01-01', to: '2026-12-31' });
  assert.deepEqual([o.orcado, o.pendente, o.atendido, o.atendidoPeriodo, o.saldo], [2800.5, 200, 2600, 2100, 0.5]);
  assert.deepEqual(o.categorias.map(c => [c.nome, c.atendido, c.saldo]), [['Material', 1400, 200.5], ['Mão de obra', 1200, -200]]);
  assert.deepEqual(o.servicos.map(s => [s.edt, s.servico, s.atendido]), [['01.001.000.001', 'Alvenaria de Tijolo Furado', 1400], ['02.001', 'Estrutura', 1200]]);
  const cimento = o.insumos.find(x => x.insumoId === '1')!;
  assert.deepEqual([cimento.qtdOrcada, cimento.qtdPendente, cimento.qtdAtendida], [560.32, 10, 50]);
});

test('apropriação sem item de orçamento entra em "Sem item de orçamento"', () => {
  const i = insumo({
    buildingCostEstimationItems: [],
    buildingAppropriations: { pending: [], attended: [{ documentLabel: 'NF/9', date: '2026-05-01', value: 300 }] },
  });
  const [o] = CustosObraAnalytics.custos([i], { from: '2026-01-01', to: '2026-12-31' });
  assert.deepEqual(o.servicos.map(s => [s.edt, s.servico, s.atendido, s.saldo]), [['', 'Sem item de orçamento', 300, -300]]);
});
