// Tipos de domínio e contratos da API (importados também pelo frontend, apenas como tipo).

export interface Compra {
  data: string;
  pedido: string;
  fornecedorId: string;
  fornecedor: string;
  insumoId: string;
  insumo: string;
  un: string;
  qtd: number;
  preco: number;
  valor: number;
  prazoEntrega: number | null;
}

export interface Consumo {
  data: string;
  obraId: string;
  obra: string;
  insumoId: string;
  insumo: string;
  un: string;
  qtd: number;
  valor: number;
}

export interface Obra { id: string; nome: string }

export interface Dados { compras: Compra[]; consumos: Consumo[]; obras: Obra[] }

export interface Filtros { from: string; to: string; obraId?: string }

// ---------- respostas do dashboard ----------
export interface PontoMensal { mes: string; valor: number }

export interface Resumo {
  comprado: number; consumido: number; saldo: number; pctConsumido: number;
  fornecedores: number; insumos: number; pedidos: number; obras: number;
  compradoMensal: PontoMensal[]; consumidoMensal: PontoMensal[];
}

export interface ConsumoMaterial {
  insumoId: string; insumo: string; un: string; qtd: number; valor: number; mensal: PontoMensal[];
}

export interface RankingFornecedor {
  fornecedorId: string; fornecedor: string; valor: number; participacao: number;
  pedidos: number; itens: number; prazoMedio: number | null;
}

export interface ConsumoObra {
  obraId: string; obra: string; valor: number; participacao: number;
  mensal: PontoMensal[]; topInsumos: { insumo: string; valor: number }[];
}

export interface ItemABC {
  insumoId: string; insumo: string; un: string; qtd: number; valor: number;
  participacao: number; acumulado: number; classe: 'A' | 'B' | 'C';
}

export interface UsoPorObra { obraId: string; obra: string; qtd: number; valor: number; pctDoComprado: number }

export interface CompradoVsConsumido {
  insumoId: string; insumo: string; un: string;
  comprado: number; consumido: number; saldo: number; pctUso: number; valorComprado: number;
  porObra: UsoPorObra[];
}

export interface VariacaoPreco {
  insumo: string; un: string; min: number; max: number; medio: number; variacao: number;
  melhorFornecedor?: string; economiaPotencial: number;
}

export interface DashboardData {
  resumo: Resumo;
  consumoMaterial: ConsumoMaterial[];
  fornecedores: RankingFornecedor[];
  obras: ConsumoObra[];
  abc: ItemABC[];
  compradoVsConsumido: CompradoVsConsumido[];
  variacaoPreco: VariacaoPreco[];
}

export interface DashboardResponse extends DashboardData {
  mock: boolean;
  aviso: string | null;    // sincronização com o Sienge falhou ou ficou parcial (cota, conexão...)
  usuario: string;
  atualizado: string;
  obrasDisponiveis: Obra[];
  quota: QuotaInfo;
}

export interface Sincronizacao {
  id: number; em: string; de: string; ate: string;
  compras: number; consumos: number; comprado: number; consumido: number;
}

// ---------- módulo financeiro (contas a pagar, a receber, caixa e bancos) ----------
export type SituacaoParcela = 'aberta' | 'vencida' | 'quitada';

/** Rateio de um lançamento (plano financeiro, centro de custo ou obra), em % do valor. */
export interface Rateio { id: string; nome: string; pct: number }

interface ParcelaBase {
  empresaId: string; empresa: string;
  tituloId: string; parcelaId: string;
  documento: string;           // tipo + número, ex.: "NF 1234"
  emissao: string;             // AAAA-MM-DD
  vencimento: string;
  competencia: string;
  valor: number;               // valor original da parcela
  saldo: number;               // em aberto
  situacao: SituacaoParcela;
  planos: Rateio[];            // plano financeiro (categoria)
  centrosCusto: Rateio[];
  obras: Rateio[];             // apropriação por obra (filtro e análise por obra)
}

export interface ContaPagar extends ParcelaBase {
  credorId: string; credor: string;
  pago: number;                // soma líquida dos pagamentos
  ultimoPagamento: string | null;
  autorizada: boolean;
}

export interface ContaReceber extends ParcelaBase {
  clienteId: string; cliente: string;
  recebido: number;            // soma líquida dos recebimentos
  ultimoRecebimento: string | null;
  inadimplencia: string;       // situação de inadimplência como vem do Sienge (valores não documentados)
  unidade: string;             // unidade principal (imóvel)
}

export interface MovimentoBancario {
  id: string;
  data: string;
  empresaId: string; empresa: string;
  conta: string;               // número da conta corrente
  valor: number;               // positivo = entrada, negativo = saída
  operacao: string;            // nome da operação
  historico: string;
  conciliado: boolean;
  tituloId: string | null;     // título vinculado (a pagar ou a receber)
  parceiro: string;            // credor ou cliente
  planos: Rateio[];
  obras: Rateio[];
}

export interface ContaCorrente {
  conta: string; nome: string;
  banco: string; agencia: string; tipo: string;
  empresaId: string; empresa: string;
  ativa: boolean;
}

export interface SaldoConta {
  conta: string; empresaId: string;
  data: string;
  saldo: number;
  conciliado: number;          // saldo conciliado
}

export interface DadosFinanceiros {
  pagar: ContaPagar[];
  receber: ContaReceber[];
  movimentos: MovimentoBancario[];
  contas: ContaCorrente[];
  saldos: SaldoConta[];
  obras: Obra[];
}

export type Agrupamento = 'mes' | 'semana';

export interface FiltrosFinanceiro extends Filtros { agrupar: Agrupamento }

/** Um ponto da série mensal/semanal. `periodo` = AAAA-MM (mês) ou AAAA-MM-DD da segunda-feira (semana). */
export interface PontoFinanceiro {
  periodo: string;
  aPagar: number; pago: number;          // parcelas a pagar com vencimento no período
  aReceber: number; recebido: number;    // parcelas a receber com vencimento no período
  entradas: number; saidas: number;      // movimentos de caixa e bancos no período
  saldoAcumulado: number;                // entradas − saídas acumulado desde o início do filtro
}

export interface ResumoFinanceiro {
  aPagar: number; pago: number; pagarAberto: number; pagarVencido: number; parcelasPagar: number;
  aReceber: number; recebido: number; receberAberto: number; receberVencido: number; parcelasReceber: number;
  entradas: number; saidas: number; resultadoCaixa: number;
  saldoBancos: number | null;            // null com filtro de obra (saldo de conta não é por obra)
}

export interface FinanceiroObra {
  obraId: string; obra: string;
  aPagar: number; pagarAberto: number; pagarVencido: number;
  aReceber: number; receberAberto: number; receberVencido: number;
  entradas: number; saidas: number; resultado: number;   // entradas − saídas
}

export interface TotalParceiro { nome: string; total: number; aberto: number; vencido: number; parcelas: number }
export interface TotalPlano { plano: string; entradas: number; saidas: number }

export interface ParcelaResumo {
  tipo: 'pagar' | 'receber';
  parceiro: string; documento: string; obra: string;
  vencimento: string; valor: number; saldo: number; situacao: SituacaoParcela;
}

export interface SaldoContaDetalhe extends SaldoConta { nome: string; banco: string; empresa: string }

export interface FinanceiroData {
  resumo: ResumoFinanceiro;
  serie: PontoFinanceiro[];
  porObra: FinanceiroObra[];
  credores: TotalParceiro[];
  clientes: TotalParceiro[];
  planos: TotalPlano[];
  vencidas: ParcelaResumo[];             // maiores parcelas vencidas (pagar e receber)
  proximos: ParcelaResumo[];             // vencimentos dos próximos 30 dias
  saldos: SaldoContaDetalhe[];
  movimentos: MovimentoBancario[];       // últimos movimentos do período
}

export interface FinanceiroResponse extends FinanceiroData {
  mock: boolean;
  aviso: string | null;
  atualizado: string | null;             // última sincronização financeira
  agrupar: Agrupamento;
  de: string; ate: string;
}

// ---------- configuração do Sienge e cota diária da API ----------
export interface PlanoSienge {
  id: string;
  nome: string;
  rest: number;            // requisições REST por dia
  bulk: number;            // requisições bulk-data por dia
}

export interface ConfigPublica {
  usarMock: boolean;       // preferência salva
  mockEfetivo: boolean;    // true se estiver mostrando dados de demonstração agora
  subdominio: string;
  usuario: string;
  senhaDefinida: boolean;  // a senha nunca volta para o navegador
  endpointConsumo: string;
  plano: string;           // id do plano contratado ('' = não informado)
  planos: PlanoSienge[];   // opções disponíveis
}

export interface ConfigEntrada {
  usarMock?: boolean;
  subdominio?: string;
  usuario?: string;
  senha?: string;          // vazio/ausente = mantém a senha salva
  endpointConsumo?: string;
  plano?: string;
}

/** Plano escolhido no painel × limite que o Sienge informa nos cabeçalhos. */
export interface VerificacaoPlano {
  escolhido: PlanoSienge | null;
  limiteApi: number | null;           // x-ratelimit-limit-day da última resposta (null = ainda não visto)
  planoApi: PlanoSienge | null;       // plano que corresponde a esse limite
  confere: boolean | null;            // null = não dá para conferir ainda
  mensagem: string;
}

export interface QuotaInfo {
  conectado: boolean;        // há usuário de API configurado (sem ele, não há cota a mostrar)
  dia: string;
  usadas: number;
  erros: number;
  limite: number;            // 0 = sem limite definido
  restante: number | null;   // null quando não há limite
  pct: number;               // 0–100 (0 sem limite)
  bulkUsadas: number;        // requisições bulk-data hoje (cota separada)
  bulkLimite: number;        // 0 = sem plano definido
  headers: Record<string, string> | null; // cabeçalhos de rate limit devolvidos pela API, se houver
  plano: VerificacaoPlano;
  serie: { dia: string; requisicoes: number; erros: number }[];
}

export interface TesteConexao { ok: boolean; mensagem: string }

// ---------- importação de relatórios (PDF do Sienge) ----------
export interface ItemApropriacao {
  insumoId: string; insumo: string; un: string;
  qtd: number; precoMedio: number; total: number; participacao: number; acumulado: number;
}

export interface RelatorioApropriacoes {
  tipo: 'curva-abc-apropriacoes';
  de: string;              // AAAA-MM-DD
  ate: string;
  itens: ItemApropriacao[];
  totalGeral: number | null; // "Total geral" impresso no relatório
  somaItens: number;
  confere: boolean;          // soma dos itens bate com o total geral
  avisos: string[];
}

export interface ImportPreview {
  token: string;
  arquivo: string;
  tipo: RelatorioApropriacoes['tipo'];
  tituloTipo: string;
  de: string; ate: string;
  linhas: number;
  totalGeral: number | null;
  somaItens: number;
  confere: boolean;
  avisos: string[];
  amostra: ItemApropriacao[];
}

export interface Importacao {
  id: number; criado: string; tipo: string; arquivo: string;
  obraId: string; obra: string; de: string; ate: string;
  linhas: number; total: number; distribuido: boolean;
}

export interface ImportConfirmacao {
  token: string;
  obraId?: string;     // obra existente
  obraNova?: string;   // ou nome de uma obra nova
  distribuir: boolean; // distribui o consumo pelos meses do período (proporcional aos dias)
}

export interface ImportResultado {
  importacao: Importacao;
  substituiu: Importacao | null;   // importação anterior da mesma obra e período, que foi trocada
  demoDesativado: boolean;         // o modo demonstração foi desligado para mostrar os dados importados
}

export interface ImportListagem { importacoes: Importacao[]; obras: Obra[] }
