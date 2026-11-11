// Dados de demonstração (modo demonstração em Configurações), no mesmo formato que o Sienge devolve.
import { janelaFinanceira } from './financeiro.service';
import type {
  ApropriacaoInsumo, Compra, Consumo, ContaCorrente, ContaPagar, ContaReceber, Dados, DadosFinanceiros, FornecedorCadastro, InsumoObra,
  MovimentoBancario, Obra, Rateio, SaldoConta, TituloInfo,
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

// `servicos`: itens do orçamento (EDT) em que o insumo entra — usado nos Insumos da Obra
const INSUMOS = [
  { id: '101', nome: 'Cimento CP-II 50kg', un: 'sc', preco: 36, codigo: 'MA-0101', marca: 'Votoran', detalhe: 'CP II E 32', servicos: ['01.001.001', '02.001.001', '03.001.001'] },
  { id: '102', nome: 'Areia média', un: 'm³', preco: 120, codigo: 'MA-0102', marca: '', detalhe: 'Lavada', servicos: ['02.001.001', '03.001.001', '05.001.001'] },
  { id: '103', nome: 'Brita 1', un: 'm³', preco: 135, codigo: 'MA-0103', marca: '', detalhe: '', servicos: ['01.001.001', '02.001.001'] },
  { id: '104', nome: 'Aço CA-50 10mm', un: 'kg', preco: 8.4, codigo: 'MA-0104', marca: 'Gerdau', detalhe: 'Barra 12m', servicos: ['01.001.001', '02.001.001'] },
  { id: '105', nome: 'Bloco cerâmico 14x19x29', un: 'un', preco: 2.1, codigo: 'MA-0105', marca: 'Santa Rita', detalhe: '', servicos: ['03.001.001'] },
  { id: '106', nome: 'Argamassa AC-II', un: 'sc', preco: 28, codigo: 'MA-0106', marca: 'Quartzolit', detalhe: 'Interna/externa', servicos: ['05.001.001'] },
  { id: '107', nome: 'Porcelanato 60x60', un: 'm²', preco: 74, codigo: 'MA-0107', marca: 'Portobello', detalhe: 'Acetinado', servicos: ['05.001.001'] },
  { id: '108', nome: 'Tubo PVC 100mm', un: 'br', preco: 62, codigo: 'MA-0108', marca: 'Tigre', detalhe: 'Esgoto', servicos: ['04.001.001'] },
  { id: '109', nome: 'Fio flexível 2,5mm', un: 'rl', preco: 285, codigo: 'MA-0109', marca: 'Sil', detalhe: 'Rolo 100m', servicos: ['04.002.001'] },
  { id: '110', nome: 'Tinta acrílica 18L', un: 'lt', preco: 340, codigo: 'MA-0110', marca: 'Suvinil', detalhe: 'Fosca branca', servicos: ['06.001.001'] },
  { id: '111', nome: 'Madeira p/ forma', un: 'm²', preco: 55, codigo: 'MA-0111', marca: '', detalhe: 'Compensado 14mm', servicos: ['01.001.001', '02.001.001'] },
  { id: '112', nome: 'Impermeabilizante', un: 'lt', preco: 190, codigo: 'MA-0112', marca: 'Vedacit', detalhe: '', servicos: ['07.001.001'] },
];

// Insumos de mão de obra e equipamento (só nos Insumos da Obra: chegam por contratos/medições, não por pedido)
const INSUMOS_SERVICO = [
  { id: '201', nome: 'Pedreiro (empreitada)', un: 'h', preco: 32, categoria: 'LABOR', grupo: 'Mão de obra civil', servicos: ['02.001.001', '03.001.001', '05.001.001'] },
  { id: '202', nome: 'Armador', un: 'h', preco: 34, categoria: 'LABOR', grupo: 'Mão de obra civil', servicos: ['01.001.001', '02.001.001'] },
  { id: '203', nome: 'Eletricista', un: 'h', preco: 38, categoria: 'LABOR', grupo: 'Mão de obra de instalações', servicos: ['04.002.001'] },
  { id: '204', nome: 'Encanador', un: 'h', preco: 36, categoria: 'LABOR', grupo: 'Mão de obra de instalações', servicos: ['04.001.001'] },
  { id: '205', nome: 'Pintor', un: 'h', preco: 30, categoria: 'LABOR', grupo: 'Mão de obra de acabamento', servicos: ['06.001.001'] },
  { id: '301', nome: 'Locação de betoneira 400L', un: 'mês', preco: 650, categoria: 'EQUIPMENT', grupo: 'Equipamentos', servicos: ['02.001.001'] },
  { id: '302', nome: 'Andaime fachadeiro', un: 'm²', preco: 9, categoria: 'EQUIPMENT', grupo: 'Equipamentos', servicos: ['05.001.001', '06.001.001'] },
];

const SERVICOS: Record<string, string> = {
  '01.001.001': 'Fundações — estacas e blocos',
  '02.001.001': 'Estrutura de concreto armado',
  '03.001.001': 'Alvenaria de vedação',
  '04.001.001': 'Instalações hidráulicas',
  '04.002.001': 'Instalações elétricas',
  '05.001.001': 'Revestimentos e pisos',
  '06.001.001': 'Pintura',
  '07.001.001': 'Impermeabilização',
};

const FORNECEDORES = [
  { id: '1', nome: 'Depósito Central Materiais', fator: 1.0, prazo: 4, cnpj: '12.345.678/0001-90', cidade: 'São Paulo' },
  { id: '2', nome: 'Votorantim Cimentos', fator: 0.97, prazo: 6, cnpj: '01.637.895/0001-32', cidade: 'São Paulo' },
  { id: '3', nome: 'Gerdau Aços', fator: 1.02, prazo: 9, cnpj: '33.611.500/0001-19', cidade: 'Porto Alegre' },
  { id: '4', nome: 'Cerâmica Santa Rita', fator: 0.95, prazo: 5, cnpj: '45.987.321/0001-04', cidade: 'Tatuí' },
  { id: '5', nome: 'Casa do Construtor', fator: 1.08, prazo: 2, cnpj: '22.456.789/0001-55', cidade: 'Campinas' },
  { id: '6', nome: 'Tigre Tubos e Conexões', fator: 1.0, prazo: 7, cnpj: '84.684.182/0001-57', cidade: 'Joinville' },
  { id: '7', nome: 'Eletro Obras', fator: 1.05, prazo: 3, cnpj: '31.222.333/0001-77', cidade: 'Guarulhos' },
  { id: '8', nome: 'Madeireira Pinheiro', fator: 0.98, prazo: 5, cnpj: '09.876.543/0001-21', cidade: 'Curitiba' },
];

const CADASTRO_FORNECEDORES: FornecedorCadastro[] = FORNECEDORES.map((f, i) => ({
  id: f.id, nome: f.nome.toUpperCase() + ' LTDA', fantasia: f.nome, cnpj: f.cnpj, cidade: f.cidade,
  telefone: `(11) 3${String(100 + i * 37).padStart(3, '0')}-${String(2000 + i * 113).slice(0, 4)}`,
  email: `vendas@${f.nome.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').split(' ')[0]}.com.br`, ativo: true,
}));
const COMPRADORES = ['ana.compras', 'bruno.suprimentos', 'carla.compras'];
const CONDICOES = ['30 DDL', '28/56 DDL', 'À vista', '30/60/90 DDL'];

let cache: Dados | null = null;
let cacheFin: DadosFinanceiros | null = null;
let cacheInsumos: InsumoObra[] | null = null;

const EMPREITEIROS = ['Empreiteira Silva & Filhos', 'Instaladora Elétrica Luz', 'Hidráulica Fonseca', 'Locadora de Equipamentos Forte', 'Escritório Contábil Prisma'];
const CLIENTES = ['Ana Paula Ribeiro', 'Carlos Henrique Souza', 'Fernanda Lima', 'João Pedro Martins', 'Juliana Costa', 'Marcos Vinícius Rocha',
  'Patrícia Almeida', 'Rafael Gomes', 'Renata Carvalho', 'Thiago Barbosa', 'Vanessa Nunes', 'Gustavo Pereira'];
const PLANOS_DESPESA: Rateio[] = [
  { id: '2.01', nome: 'Materiais de construção', pct: 100 }, { id: '2.02', nome: 'Mão de obra empreitada', pct: 100 },
  { id: '2.03', nome: 'Locação de equipamentos', pct: 100 }, { id: '2.04', nome: 'Serviços de instalação', pct: 100 },
  { id: '2.05', nome: 'Despesas administrativas', pct: 100 },
];
const DOCUMENTOS = [
  { tipo: 'NF', nome: 'NOTA FISCAL', origem: 'Administração de Compras' },
  { tipo: 'NFS', nome: 'NOTA FISCAL DE SERVIÇO', origem: 'Contratos e Medições' },
  { tipo: 'RPA', nome: 'RECIBO DE PAGAMENTO AUTÔNOMO', origem: 'Contas a Pagar' },
  { tipo: 'BOL', nome: 'BOLETO', origem: 'Contas a Pagar' },
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
  // começa 12 meses antes da janela sincronizada: o comparativo anual da demonstração tem o ano anterior
  const base = new Date(vencDe + 'T00:00:00Z');
  base.setUTCMonth(base.getUTCMonth() - 12);
  const pagar: ContaPagar[] = [];
  const titulos: TituloInfo[] = [];
  const titulosReceber: TituloInfo[] = [];
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

  for (let m = 0; m < 31; m++) {
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
      const doc = pick(DOCUMENTOS);
      const numero = String(1000 + titulo);
      pagar.push({
        empresaId: '1', empresa: 'Construtora Demo', tituloId: id, parcelaId: '1', documento: `${doc.tipo} ${numero}`,
        documentoTipo: doc.tipo, documentoNome: doc.nome, numeroDocumento: numero,
        emissao: somarDias(venc, -30), vencimento: venc, competencia: somarDias(venc, -30),
        dataBase: somarDias(venc, -30), indexador: 'REAL',
        valor, desconto: 0, impostos: doc.tipo === 'NFS' ? +(valor * 0.11).toFixed(2) : 0,
        saldo, situacao: saldo === 0 ? 'quitada' : passado ? 'vencida' : 'aberta',
        apropriacoes: obras.map(o => ({ centroCustoId: o.id, centroCusto: o.nome, planoId: plano.id, plano: plano.nome, pct: o.pct })),
        planos: [plano], centrosCusto: obras, obras,
        credorId: credor, credor, pago: +(valor - saldo).toFixed(2), ultimoPagamento: pagou, autorizada: true,
      });
      titulos.push({
        id, observacao: `REFERENTE A ${plano.nome.toUpperCase()} — ${obras.map(o => o.nome.toUpperCase()).join(' / ')}`,
        valorTotal: valor, desconto: 0, parcelas: 1, pedidoCompra: doc.tipo === 'NF' ? String(3000 + titulo) : '',
        contrato: doc.tipo === 'NFS' ? `CT-${100 + (titulo % 40)}` : '', origem: doc.origem,
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
        documentoTipo: 'CT', documentoNome: 'CONTRATO', numeroDocumento: id,
        emissao: somarDias(venc, -60), vencimento: venc, competencia: venc, dataBase: somarDias(venc, -60), indexador: 'INCC',
        valor, desconto: 0, impostos: 0, saldo, situacao: saldo === 0 ? 'quitada' : passado ? 'vencida' : 'aberta',
        apropriacoes: [{ centroCustoId: o.id, centroCusto: o.nome, planoId: PLANO_RECEITA.id, plano: PLANO_RECEITA.nome, pct: 100 }],
        planos: [PLANO_RECEITA], centrosCusto: obras, obras,
        clienteId: cliente, cliente, recebido: +(valor - saldo).toFixed(2), ultimoRecebimento: recebeu,
        inadimplencia: inadimplente ? 'S' : 'N', origem: 'Medições', condicao: 'PM', parcelaNumero: '1', unidade: `${o.nome.split(' ')[0]} — Apto ${100 + Math.floor(r() * 12) * 10 + Math.floor(r() * 4) + 1}`,
      });
      titulosReceber.push({
        id, observacao: `Caução referente à medição Nº. ${1 + (m % 12)} da obra ${o.nome}`, valorTotal: valor,
        desconto: 0, parcelas: 0, pedidoCompra: '', contrato: '', origem: '',
      });
      if (recebeu && recebeu <= hoje) movimento(recebeu, valor, cliente, id, [PLANO_RECEITA], obras, '98765-4');
    }
  }
  const saldos: SaldoConta[] = [
    { conta: '12345-6', empresaId: '1', data: hoje, saldo: 412_380.55, conciliado: 398_120.1 },
    { conta: '98765-4', empresaId: '1', data: hoje, saldo: 1_235_904.2, conciliado: 1_235_904.2 },
    { conta: 'CAIXA', empresaId: '1', data: hoje, saldo: 18_450, conciliado: 18_450 },
  ];
  return { pagar, receber, movimentos, contas: CONTAS, saldos, titulos, titulosReceber, obras: OBRAS };
}

/** Insumos da Obra (bulk-data building/resources) de demonstração: orçado, pendente (pedidos/contratos) e atendido (NF/medições). */
function gerarInsumosObra(): InsumoObra[] {
  const r = rng(99);
  const hoje = new Date();
  const dataNoAno = () => isoDia(new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() - Math.floor(r() * 12), 1 + Math.floor(r() * 27))));
  const out: InsumoObra[] = [];
  let doc = 100;
  OBRAS.forEach((o, iObra) => {
    const escala = [1.4, 1, 0.75, 1.15][iObra] ?? 1;
    const todos = [
      ...INSUMOS.map(i => ({ ...i, categoria: 'MATERIAL', grupo: 'Materiais de construção' })),
      ...INSUMOS_SERVICO.map(i => ({ ...i, codigo: `SV-0${i.id}`, marca: '', detalhe: '' })),
    ];
    for (const ins of todos) {
      const material = ins.categoria === 'MATERIAL';
      const orcamento = ins.servicos.map(edt => {
        const qtd = Math.round((material ? 400 : 900) * escala * (0.5 + r()) * (ins.preco > 200 ? 0.15 : ins.preco > 60 ? 0.5 : 1));
        return { edt, servico: SERVICOS[edt], unidade: 'Torre A', qtd, valor: +(qtd * ins.preco).toFixed(2) };
      });
      const apropriar = (orc: (typeof orcamento)[number], fracao: number, tipo: 'NF' | 'CT' | 'PC'): ApropriacaoInsumo => {
        const qtd = +(orc.qtd * fracao).toFixed(2);
        return {
          documento: `${tipo}/${String(++doc).padStart(4, '0')}`, data: dataNoAno(), edt: orc.edt, servico: orc.servico,
          unidade: orc.unidade, qtd, pct: 100, valor: +(qtd * ins.preco * (0.9 + r() * 0.3)).toFixed(2),
        };
      };
      // realizado entre 30% e 105% do orçado; algumas apropriações estouram o orçamento
      const atendidas = orcamento.flatMap(orc => {
        const total = 0.3 + r() * 0.75;
        const partes = 1 + Math.floor(r() * 3);
        return Array.from({ length: partes }, () => apropriar(orc, total / partes, material ? 'NF' : 'CT'));
      });
      const pendentes = orcamento.filter(() => r() < 0.55).map(orc => apropriar(orc, 0.05 + r() * 0.25, material ? 'PC' : 'CT'));
      out.push({
        obraId: o.id, obra: o.nome, insumoId: ins.id, insumo: ins.nome, codigo: ins.codigo, un: ins.un,
        categoria: ins.categoria, grupo: ins.grupo, detalhe: ins.detalhe, marca: ins.marca, precoUnitario: ins.preco,
        orcamento, pendentes, atendidas,
      });
    }
  });
  return out;
}

export const MockService = {
  financeiro(): DadosFinanceiros {
    return (cacheFin ??= gerarFinanceiro());
  },

  insumosObra(): InsumoObra[] {
    return (cacheInsumos ??= gerarInsumosObra());
  },

  carregar(): Dados {
    if (cache) return cache;
    const r = rng(42);
    const compras: Compra[] = [];
    const consumos: Consumo[] = [];
    const hoje = new Date();
    let pedido = 1000;
    const hojeIso = isoDia(hoje);

    // 24 meses: o comparativo anual (e "mesmo mês do ano passado") da demonstração tem com o que comparar
    for (let m = 23; m >= 0; m--) {
      const base = new Date(hoje.getFullYear(), hoje.getMonth() - m, 1);
      for (const ins of INSUMOS) {
        const nCompras = 1 + Math.floor(r() * 2);
        for (let c = 0; c < nCompras; c++) {
          const f = FORNECEDORES[Math.floor(r() * FORNECEDORES.length)];
          const obra = OBRAS[Math.floor(r() * OBRAS.length)];
          const qtd = Math.round((40 + r() * 260) * (ins.preco > 200 ? 0.2 : ins.preco > 60 ? 0.6 : 1.5));
          const precoUnitario = +(ins.preco * f.fator * (0.92 + r() * 0.16)).toFixed(2);
          const desconto = r() < 0.3 ? 0.03 : 0;
          const preco = +(precoUnitario * (1 - desconto)).toFixed(2);
          const d = 1 + Math.floor(r() * 26);
          const data = new Date(base.getFullYear(), base.getMonth(), d);
          const dataIso = data.toISOString().slice(0, 10);
          const recente = Date.parse(hojeIso) - data.getTime() < 45 * 864e5;
          compras.push({
            pedido: String(++pedido),
            data: dataIso,
            fornecedorId: f.id, fornecedor: CADASTRO_FORNECEDORES.find(x => x.id === f.id)!.nome,
            insumoId: ins.id, insumo: ins.nome, un: ins.un,
            qtd, preco, valor: +(qtd * preco).toFixed(2),
            prazoEntrega: Math.max(1, Math.round(f.prazo + (r() - 0.5) * 4)),
            obraId: obra.id, obra: obra.nome,
            item: 1, codigo: ins.codigo, detalhe: ins.detalhe, marca: ins.marca, precoUnitario,
            situacao: recente ? (r() < 0.5 ? 'PENDING' : 'PARTIALLY_DELIVERED') : 'FULLY_DELIVERED',
            autorizado: !recente || r() > 0.15,
            atrasado: recente && r() < 0.35,
            comprador: COMPRADORES[Math.floor(r() * COMPRADORES.length)],
            condicaoPagamento: CONDICOES[Math.floor(r() * CONDICOES.length)],
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
    return (cache = { compras, consumos, obras: OBRAS, fornecedores: CADASTRO_FORNECEDORES });
  },
};
