// Dados de demonstração (modo demonstração em Configurações), no mesmo formato que o Sienge devolve.
import { janelaFinanceira } from './financeiro.service';
import type {
  Compra, Consumo, ContaCorrente, ContaPagar, ContaReceber, Dados, DadosFinanceiros, MovimentoBancario, Obra, Rateio, SaldoConta,
} from '../types';

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

const OBRAS: Obra[] = [
  { id: '1', nome: 'Residencial Aurora' },
  { id: '2', nome: 'Edifício Horizonte' },
  { id: '3', nome: 'Condomínio Vila Verde' },
  { id: '4', nome: 'Centro Comercial Plaza' },
];

const INSUMOS = [
  { id: '101', nome: 'Cimento CP-II 50kg', un: 'sc', preco: 36 },
  { id: '102', nome: 'Areia média', un: 'm³', preco: 120 },
  { id: '103', nome: 'Brita 1', un: 'm³', preco: 135 },
  { id: '104', nome: 'Aço CA-50 10mm', un: 'kg', preco: 8.4 },
  { id: '105', nome: 'Bloco cerâmico 14x19x29', un: 'un', preco: 2.1 },
  { id: '106', nome: 'Argamassa AC-II', un: 'sc', preco: 28 },
  { id: '107', nome: 'Porcelanato 60x60', un: 'm²', preco: 74 },
  { id: '108', nome: 'Tubo PVC 100mm', un: 'br', preco: 62 },
  { id: '109', nome: 'Fio flexível 2,5mm', un: 'rl', preco: 285 },
  { id: '110', nome: 'Tinta acrílica 18L', un: 'lt', preco: 340 },
  { id: '111', nome: 'Madeira p/ forma', un: 'm²', preco: 55 },
  { id: '112', nome: 'Impermeabilizante', un: 'lt', preco: 190 },
];

const FORNECEDORES = [
  { id: '1', nome: 'Depósito Central Materiais', fator: 1.0, prazo: 4 },
  { id: '2', nome: 'Votorantim Cimentos', fator: 0.97, prazo: 6 },
  { id: '3', nome: 'Gerdau Aços', fator: 1.02, prazo: 9 },
  { id: '4', nome: 'Cerâmica Santa Rita', fator: 0.95, prazo: 5 },
  { id: '5', nome: 'Casa do Construtor', fator: 1.08, prazo: 2 },
  { id: '6', nome: 'Tigre Tubos e Conexões', fator: 1.0, prazo: 7 },
  { id: '7', nome: 'Eletro Obras', fator: 1.05, prazo: 3 },
  { id: '8', nome: 'Madeireira Pinheiro', fator: 0.98, prazo: 5 },
];

let cache: Dados | null = null;
let cacheFin: DadosFinanceiros | null = null;

const EMPREITEIROS = ['Empreiteira Silva & Filhos', 'Instaladora Elétrica Luz', 'Hidráulica Fonseca', 'Locadora de Equipamentos Forte', 'Escritório Contábil Prisma'];
const CLIENTES = ['Ana Paula Ribeiro', 'Carlos Henrique Souza', 'Fernanda Lima', 'João Pedro Martins', 'Juliana Costa', 'Marcos Vinícius Rocha',
  'Patrícia Almeida', 'Rafael Gomes', 'Renata Carvalho', 'Thiago Barbosa', 'Vanessa Nunes', 'Gustavo Pereira'];
const PLANOS_DESPESA: Rateio[] = [
  { id: '2.01', nome: 'Materiais de construção', pct: 100 }, { id: '2.02', nome: 'Mão de obra empreitada', pct: 100 },
  { id: '2.03', nome: 'Locação de equipamentos', pct: 100 }, { id: '2.04', nome: 'Serviços de instalação', pct: 100 },
  { id: '2.05', nome: 'Despesas administrativas', pct: 100 },
];
const PLANO_RECEITA: Rateio = { id: '1.01', nome: 'Venda de unidades', pct: 100 };
const CONTAS: ContaCorrente[] = [
  { conta: '12345-6', nome: 'Itaú — Pagamentos de obra', banco: 'Itaú Unibanco', agencia: '0123', tipo: 'Bancária', empresaId: '1', empresa: 'Construtora Demo', ativa: true },
  { conta: '98765-4', nome: 'Bradesco — Recebimentos', banco: 'Bradesco', agencia: '4567', tipo: 'Bancária', empresaId: '1', empresa: 'Construtora Demo', ativa: true },
  { conta: 'CAIXA', nome: 'Caixa da obra', banco: '', agencia: '', tipo: 'Caixa', empresaId: '1', empresa: 'Construtora Demo', ativa: true },
];

const isoDia = (d: Date) => d.toISOString().slice(0, 10);
const somarDias = (s: string, n: number) => isoDia(new Date(Date.parse(s + 'T00:00:00Z') + n * 864e5));

function gerarFinanceiro(): DadosFinanceiros {
  const r = rng(7);
  const hoje = isoDia(new Date());
  const { vencDe } = janelaFinanceira();
  const base = new Date(vencDe + 'T00:00:00Z');
  const pagar: ContaPagar[] = [];
  const receber: ContaReceber[] = [];
  const movimentos: MovimentoBancario[] = [];
  const credores = [...FORNECEDORES.map(f => f.nome), ...EMPREITEIROS];
  let titulo = 5000;
  let mov = 1;
  const pick = <T>(l: T[]) => l[Math.floor(r() * l.length)];
  const rateioObra = (): Rateio[] => {
    const o = pick(OBRAS);
    if (r() > 0.15) return [{ id: o.id, nome: o.nome, pct: 100 }];
    const o2 = OBRAS.find(x => x.id !== o.id)!;
    return [{ id: o.id, nome: o.nome, pct: 60 }, { id: o2.id, nome: o2.nome, pct: 40 }];
  };
  const movimento = (data: string, valor: number, parceiro: string, tituloId: string, planos: Rateio[], obras: Rateio[], conta: string) =>
    movimentos.push({
      id: String(mov++), data, empresaId: '1', empresa: 'Construtora Demo', conta, valor: +valor.toFixed(2),
      operacao: valor < 0 ? 'Pagamento' : 'Recebimento', historico: valor < 0 ? 'Pagamento de título' : 'Recebimento de parcela',
      conciliado: r() > 0.1, tituloId, parceiro, planos, obras,
    });

  for (let m = 0; m < 19; m++) {
    const ano = base.getUTCFullYear();
    const mes = base.getUTCMonth() + m;
    // contas a pagar: ~6 títulos por obra no mês
    for (let i = 0; i < OBRAS.length * 6; i++) {
      const venc = isoDia(new Date(Date.UTC(ano, mes, 1 + Math.floor(r() * 28))));
      const valor = +(4000 + r() ** 2 * 70000).toFixed(2);
      const passado = venc < hoje;
      const saldo = passado ? (r() < 0.1 ? valor : 0) : valor;
      const obras = rateioObra();
      const plano = pick(PLANOS_DESPESA);
      const credor = pick(credores);
      const id = String(++titulo);
      const pagou = saldo === 0 ? somarDias(venc, Math.floor(r() * 4) - 1) : null;
      pagar.push({
        empresaId: '1', empresa: 'Construtora Demo', tituloId: id, parcelaId: '1', documento: `NF ${1000 + titulo}`,
        emissao: somarDias(venc, -30), vencimento: venc, competencia: somarDias(venc, -30),
        valor, saldo, situacao: saldo === 0 ? 'quitada' : passado ? 'vencida' : 'aberta',
        planos: [plano], centrosCusto: obras, obras,
        credorId: credor, credor, pago: +(valor - saldo).toFixed(2), ultimoPagamento: pagou, autorizada: true,
      });
      if (pagou && pagou <= hoje) movimento(pagou, -valor, credor, id, [plano], obras, r() > 0.15 ? '12345-6' : 'CAIXA');
    }
    // contas a receber: parcelas de venda de unidades
    for (let i = 0; i < OBRAS.length * 4; i++) {
      const venc = isoDia(new Date(Date.UTC(ano, mes, 5 + Math.floor(r() * 20))));
      const valor = +(9000 + r() * 45000).toFixed(2);
      const passado = venc < hoje;
      const inadimplente = passado && r() < 0.08;
      const saldo = passado && !inadimplente ? 0 : valor;
      const o = pick(OBRAS);
      const obras = [{ id: o.id, nome: o.nome, pct: 100 }];
      const cliente = pick(CLIENTES);
      const id = String(++titulo);
      const recebeu = saldo === 0 ? somarDias(venc, Math.floor(r() * 5)) : null;
      receber.push({
        empresaId: '1', empresa: 'Construtora Demo', tituloId: id, parcelaId: String(1 + (m % 12)), documento: `CT ${id}`,
        emissao: somarDias(venc, -60), vencimento: venc, competencia: venc,
        valor, saldo, situacao: saldo === 0 ? 'quitada' : passado ? 'vencida' : 'aberta',
        planos: [PLANO_RECEITA], centrosCusto: obras, obras,
        clienteId: cliente, cliente, recebido: +(valor - saldo).toFixed(2), ultimoRecebimento: recebeu,
        inadimplencia: inadimplente ? 'S' : 'N', unidade: `${o.nome.split(' ')[0]} — Apto ${100 + Math.floor(r() * 12) * 10 + Math.floor(r() * 4) + 1}`,
      });
      if (recebeu && recebeu <= hoje) movimento(recebeu, valor, cliente, id, [PLANO_RECEITA], obras, '98765-4');
    }
  }
  const saldos: SaldoConta[] = [
    { conta: '12345-6', empresaId: '1', data: hoje, saldo: 412_380.55, conciliado: 398_120.1 },
    { conta: '98765-4', empresaId: '1', data: hoje, saldo: 1_235_904.2, conciliado: 1_235_904.2 },
    { conta: 'CAIXA', empresaId: '1', data: hoje, saldo: 18_450, conciliado: 18_450 },
  ];
  return { pagar, receber, movimentos, contas: CONTAS, saldos, obras: OBRAS };
}

export const MockService = {
  financeiro(): DadosFinanceiros {
    return (cacheFin ??= gerarFinanceiro());
  },

  carregar(): Dados {
    if (cache) return cache;
    const r = rng(42);
    const compras: Compra[] = [];
    const consumos: Consumo[] = [];
    const hoje = new Date();
    let pedido = 1000;

    for (let m = 11; m >= 0; m--) {
      const base = new Date(hoje.getFullYear(), hoje.getMonth() - m, 1);
      for (const ins of INSUMOS) {
        const nCompras = 1 + Math.floor(r() * 2);
        for (let c = 0; c < nCompras; c++) {
          const f = FORNECEDORES[Math.floor(r() * FORNECEDORES.length)];
          const qtd = Math.round((40 + r() * 260) * (ins.preco > 200 ? 0.2 : ins.preco > 60 ? 0.6 : 1.5));
          const preco = +(ins.preco * f.fator * (0.92 + r() * 0.16)).toFixed(2);
          const d = 1 + Math.floor(r() * 26);
          const data = new Date(base.getFullYear(), base.getMonth(), d);
          compras.push({
            pedido: String(++pedido),
            data: data.toISOString().slice(0, 10),
            fornecedorId: f.id, fornecedor: f.nome,
            insumoId: ins.id, insumo: ins.nome, un: ins.un,
            qtd, preco, valor: +(qtd * preco).toFixed(2),
            prazoEntrega: Math.max(1, Math.round(f.prazo + (r() - 0.5) * 4)),
          });
          // consumo derivado: 55–95% do comprado, repartido entre as obras
          const usado = qtd * (0.55 + r() * 0.4);
          const pesos = OBRAS.map(() => r() ** 1.5);
          const soma = pesos.reduce((a, b) => a + b, 0);
          OBRAS.forEach((o, i) => {
            const q = +(usado * pesos[i] / soma).toFixed(2);
            if (q <= 0.5) return;
            const dc = new Date(base.getFullYear(), base.getMonth(), Math.min(28, d + 2 + Math.floor(r() * 10)));
            consumos.push({
              data: dc.toISOString().slice(0, 10),
              obraId: o.id, obra: o.nome,
              insumoId: ins.id, insumo: ins.nome, un: ins.un,
              qtd: q, valor: +(q * preco).toFixed(2),
            });
          });
        }
      }
    }
    return (cache = { compras, consumos, obras: OBRAS });
  },
};
