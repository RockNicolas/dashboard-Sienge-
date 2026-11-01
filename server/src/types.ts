// Tipos de domínio e contratos da API (importados também pelo frontend, apenas como tipo).

/**
 * Item de pedido de compra do Sienge (GET /purchase-orders + /purchase-orders/{id}/items, spec purchase-orders-v1).
 * Ao lado de cada campo, o nome original na API.
 */
export interface Compra {
  data: string;            // date (data do pedido)
  pedido: string;          // formattedPurchaseOrderId (parâmetro 415) ou id
  fornecedorId: string;    // supplierId
  fornecedor: string;      // nome do credor (/creditors/{supplierId}); o pedido não traz o nome
  insumoId: string;        // resourceId (Id do insumo = número/código do insumo no Sienge)
  insumo: string;          // resourceDescription
  un: string;              // unitOfMeasure
  qtd: number;             // quantity
  preco: number;           // netPrice (preço unitário líquido); sem ele, unitPrice
  valor: number;           // quantity × preço líquido (a API não manda o total do item)
  prazoEntrega: number | null;
  obraId: string;          // buildingId do pedido ('' = pedido sem obra)
  obra: string;            // nome da obra (/enterprises)
  item: number;            // itemNumber
  codigo: string;          // resourceCode (código auxiliar do insumo)
  detalhe: string;         // detailDescription
  marca: string;           // trademarkDescription
  precoUnitario: number;   // unitPrice (antes de desconto/acréscimo)
  situacao: string;        // status: PENDING | PARTIALLY_DELIVERED | FULLY_DELIVERED | CANCELED
  autorizado: boolean;     // authorized
  atrasado: boolean;       // deliveryLate (algum item com entrega em atraso)
  comprador: string;       // buyerId (usuário do Sienge)
  condicaoPagamento: string; // paymentCondition
}

/** Credor do Sienge (GET /creditors, spec creditor-v1). Campos vazios quando o Sienge não mandou. */
export interface FornecedorCadastro {
  id: string;              // id
  nome: string;            // name
  fantasia: string;        // tradeName
  cnpj: string;            // cnpj (ou cpf)
  cidade: string;          // address.cityName (o endereço do credor não traz UF)
  telefone: string;        // phones[] (o principal): ddd + number
  email: string;           // contacts[].email (o primeiro)
  ativo: boolean;          // active
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

export interface Dados { compras: Compra[]; consumos: Consumo[]; obras: Obra[]; fornecedores?: FornecedorCadastro[] }

export interface Filtros { from: string; to: string; obraId?: string }

// ---------- respostas do dashboard ----------
export interface PontoMensal { mes: string; valor: number }

export interface Resumo {
  comprado: number; consumido: number; saldo: number; pctConsumido: number;
  fornecedores: number; insumos: number; pedidos: number; obras: number;
  obrasComCompra: number;  // obras com pedido de compra no período
  ticketMedio: number;     // valor médio por pedido
  compradoMensal: PontoMensal[]; consumidoMensal: PontoMensal[];
}

export interface ConsumoMaterial {
  insumoId: string; insumo: string; un: string; qtd: number; valor: number; mensal: PontoMensal[];
}

export interface RankingFornecedor {
  fornecedorId: string; fornecedor: string; valor: number; participacao: number;
  pedidos: number; itens: number; prazoMedio: number | null;
  acumulado: number;              // % acumulado no ranking (curva ABC de fornecedores)
  classe: 'A' | 'B' | 'C';
  ticketMedio: number;            // valor médio por pedido
  obras: number;                  // obras atendidas
  atrasados: number;              // pedidos com entrega em atraso (deliveryLate)
  ultimaCompra: string;           // AAAA-MM-DD
  topInsumos: { insumo: string; valor: number }[];
  cadastro: FornecedorCadastro | null;   // credor no Sienge (null enquanto não foi buscado)
}

/** Histórico de compras de um material (insumo) no período. */
export interface HistoricoMaterial {
  insumoId: string; insumo: string; un: string;   // insumoId = número do insumo no Sienge (resourceId)
  codigo: string;                 // código auxiliar do insumo (resourceCode), quando cadastrado
  compras: number;                // linhas de pedido
  pedidos: number;
  fornecedores: number;
  qtd: number; valor: number;
  precoMin: number; precoMedio: number; precoMax: number;
  variacao: number;               // (máx − mín) / mín, em %
  ultimoPreco: number; ultimaData: string; ultimoFornecedor: string;
  precoMensal: PontoMensal[];     // preço médio ponderado de cada mês
}

/** Material comprado por obra (pela obra do pedido de compra). */
export interface CompraObra {
  obraId: string; obra: string; valor: number; participacao: number;
  pedidos: number; fornecedores: number; insumos: number;
  mensal: PontoMensal[]; topInsumos: { insumo: string; valor: number }[];
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
  historico: HistoricoMaterial[];
  compras: Compra[];              // linhas de compra do período, mais recentes primeiro (até LIMITE_COMPRAS)
  comprasTotal: number;           // total de linhas no período (pode passar do que veio em `compras`)
  comprasObra: CompraObra[];
}

// ---------- sincronização: o que puxar do Sienge (escolhido ao cadastrar o usuário de API) ----------
/** Período puxado do Sienge: atalhos relativos a hoje (andam com o calendário) ou datas fixas. */
export type PeriodoSync = 'mes' | 'mes-passado' | '3m' | '6m' | 'ano' | '12m' | 'personalizado';

export interface ConfigSync {
  periodo: PeriodoSync;
  de: string; ate: string;          // só no personalizado (ate '' = até hoje)
  obras: string[] | null;           // null = todas as obras que o usuário de API enxerga
  fornecedores: boolean;            // cadastro de credores (/creditors) → nome, CNPJ, contato
  insumosObra: boolean;             // Insumos da Obra (bulk building/resources) → Custos por obra
  financeiro: boolean;              // contas a pagar/receber e caixa (bulk outcome/income/bank-movement) → Resultado da obra
}

/** Datas (data do pedido) que o período escolhido representa hoje. */
export interface JanelaSync { de: string; ate: string }

export interface OpcoesSync {
  config: ConfigSync | null;        // null = ainda não escolhido
  obras: Obra[];                    // obras que o usuário de API enxerga no Sienge (/enterprises)
  aviso: string | null;             // ex.: não conseguiu listar as obras
  mock: boolean;
}

/** Requisições que as escolhas vão gastar (REST e bulk-data têm cotas diárias separadas). */
export interface EstimativaSync {
  janela: JanelaSync;
  pedidos: number;                  // pedidos (válidos) das obras escolhidas no período
  porObra: { id: string; nome: string; pedidos: number; pendentes: number }[]; // pendentes = itens ainda não baixados
  semObra: number;                  // pedidos sem obra (entram só com "todas as obras")
  rest: { obras: number; listagem: number; itens: number; fornecedores: number; financeiro: number; total: number };
  bulk: { insumosObra: number; financeiro: number; total: number };
  porAtualizacao: { rest: number; bulk: number }; // depois da 1ª carga, a cada atualização
  gastoNaEstimativa: number;        // REST que esta estimativa gastou listando os pedidos (a sincronização reaproveita)
  plano: PlanoSienge | null;
  hoje: { rest: number | null; bulk: number | null }; // quanto ainda dá para usar hoje (null = sem plano)
  dias: number;                     // dias para terminar a 1ª carga (1 = cabe hoje; 0 = sem plano para calcular)
  mock: boolean;
}

export interface DashboardResponse extends DashboardData {
  mock: boolean;
  de: string; ate: string; // período usado (sem filtro de datas: o período sincronizado ou os últimos 12 meses)
  janela: (JanelaSync & { periodo: PeriodoSync }) | null; // o que vem do Sienge (null = sem escolha: segue o filtro)
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

// ---------- custos por obra: Insumos da Obra (bulk-data/v1/building/resources, spec bulk-data-building-resource-v1) ----------
// Mesma regra do "Relatório de Apropriações de Insumos" do Sienge.

/** Apropriação de obra de um insumo (pendente: saldo de pedido/contrato; atendida: NF de compra/medição). */
export interface ApropriacaoInsumo {
  documento: string;       // documentLabel, ex.: "NF/001", "CT/0001"
  data: string;            // date (emissão do título; para medições, data da medição)
  edt: string;             // costEstimationItemReference (item do orçamento na EDT)
  servico: string;         // costEstimationItemDescription
  unidade: string;         // buildingUnitName (unidade construtiva)
  qtd: number;             // quantity
  pct: number;             // percentage
  valor: number;           // value
}

/** Item do orçamento em que o insumo está (buildingCostEstimationItems). */
export interface OrcamentoInsumo {
  edt: string;             // wbsCode
  servico: string;         // description
  unidade: string;         // buildingUnitName
  qtd: number;             // quantity (orçada)
  valor: number;           // totalPrice (orçado, sem BDI e sem encargos)
}

export interface InsumoObra {
  obraId: string; obra: string;                 // buildingId, buildingName
  insumoId: string; insumo: string;             // id, description
  codigo: string;                               // resourceCode
  un: string;                                   // unitOfMeasure
  categoria: string;                            // category: MATERIAL, LABOR, EQUIPMENT, OTHER…
  grupo: string;                                // resourceGroup
  detalhe: string; marca: string;               // detailDescription, trademarkDescription
  precoUnitario: number;                        // unitPrice
  orcamento: OrcamentoInsumo[];
  pendentes: ApropriacaoInsumo[];               // buildingAppropriations.pending
  atendidas: ApropriacaoInsumo[];               // buildingAppropriations.attended
}

/** Orçado × pendente × atendido. `saldo` = orçado − atendido − pendente (negativo = passou do orçamento). */
export interface TotaisCusto {
  orcado: number;
  pendente: number;        // comprometido: saldos de pedidos e contratos
  atendido: number;        // realizado até hoje: NFs de compra e medições
  atendidoPeriodo: number; // realizado com data no período do filtro
  saldo: number;
}

export interface CustoCategoria extends TotaisCusto { categoria: string; nome: string }
export interface CustoServico extends TotaisCusto { edt: string; servico: string }
export interface CustoInsumo extends TotaisCusto {
  insumoId: string; insumo: string; un: string; categoria: string;   // insumoId = código do insumo (id)
  codigo: string;                                                     // código auxiliar (resourceCode)
  qtdOrcada: number; qtdPendente: number; qtdAtendida: number;
}

export interface CustoObra extends TotaisCusto {
  obraId: string; obra: string;
  categorias: CustoCategoria[];
  servicos: CustoServico[];
  insumos: CustoInsumo[];
  atualizado: string | null;   // quando os insumos desta obra vieram do Sienge
}

export interface CustosObraResponse {
  mock: boolean;
  aviso: string | null;
  obras: CustoObra[];
  aguardando: Obra[];          // obras do filtro ainda não sincronizadas (cota bulk-data do dia)
}

// ---------- módulo financeiro (contas a pagar, a receber, caixa e bancos) ----------
export type SituacaoParcela = 'aberta' | 'vencida' | 'quitada';

/** Rateio de um lançamento (plano financeiro, centro de custo ou obra), em % do valor. */
export interface Rateio { id: string; nome: string; pct: number }

/** Linha da "Apropriação de despesas por centro de custo" do Sienge: centro de custo + plano financeiro + %. */
export interface Apropriacao { centroCustoId: string; centroCusto: string; planoId: string; plano: string; pct: number }

interface ParcelaBase {
  empresaId: string; empresa: string;
  tituloId: string; parcelaId: string;
  documento: string;           // tipo + número, ex.: "TRCT ISADORA MARQUES"
  documentoTipo: string;       // ex.: "TRCT"
  documentoNome: string;       // ex.: "TERMO DE RESCISÃO DO CONTRATO DE TRABALHO"
  numeroDocumento: string;
  emissao: string;             // AAAA-MM-DD
  vencimento: string;
  competencia: string;
  dataBase: string;            // data base da parcela
  indexador: string;           // ex.: "REAL"
  valor: number;               // valor original da parcela
  desconto: number;
  impostos: number;            // impostos retidos
  saldo: number;               // em aberto
  situacao: SituacaoParcela;
  apropriacoes: Apropriacao[];
  planos: Rateio[];            // plano financeiro (categoria)
  centrosCusto: Rateio[];
  obras: Rateio[];             // apropriação por obra (filtro e análise por obra)
}

/** Dados do título que só o REST /bills traz (o bulk de parcelas não tem). */
export interface TituloInfo {
  id: string;
  observacao: string;
  valorTotal: number;          // valor bruto do título (soma impostos e desconto)
  desconto: number;
  parcelas: number;
  pedidoCompra: string;
  contrato: string;
  origem: string;              // ex.: "Contas a Pagar", "Folha de Pagamento"
}

/** Título (a pagar ou a receber) como no cadastro de títulos do Sienge: parcelas agrupadas + dados do título. */
export interface Titulo {
  tipo: 'pagar' | 'receber';
  tituloId: string;
  documentoTipo: string; documentoNome: string; numeroDocumento: string;
  empresa: string; parceiroId: string; parceiro: string;   // credor (pagar) ou cliente (receber)
  emissao: string; competencia: string;
  valorTotal: number; desconto: number; impostos: number;
  parcelas: number; parcelasQuitadas: number;
  quitado: number; saldo: number;                         // pago/recebido e em aberto
  proximoVencimento: string | null;
  situacao: SituacaoParcela;   // quitada = todas baixadas; vencida = alguma parcela atrasada
  autorizado: boolean;         // a pagar: todas as parcelas autorizadas (a receber: sempre true)
  apropriacoes: Apropriacao[];
  obras: Rateio[];
  observacao: string; origem: string;
  pedidoCompra: string; contrato: string;                 // a pagar
  unidade: string; condicao: string;                      // a receber: unidade principal e condição de pagamento
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
  origem: string;              // módulo de origem, ex.: "Medições"
  condicao: string;            // condição de pagamento (TC), ex.: "PM"
  parcelaNumero: string;       // "1", ou "1/2" conforme parâmetro 651 do Sienge
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
  titulos: TituloInfo[];          // a pagar (/bills)
  titulosReceber: TituloInfo[];   // a receber (/accounts-receivable/receivable-bills, por cliente)
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
  aPagar: number; pagarAberto: number; pagarVencido: number; pago: number;
  aReceber: number; receberAberto: number; receberVencido: number; recebido: number;
  entradas: number; saidas: number; resultado: number;   // entradas − saídas
}

/** Despesas (contas a pagar) de uma obra abertas pelo plano financeiro: material, mão de obra, serviços… */
export interface DespesaObra {
  obraId: string; obra: string; total: number;
  planos: { plano: string; valor: number }[];             // maior primeiro
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
  despesasObra: DespesaObra[];
  credores: TotalParceiro[];
  clientes: TotalParceiro[];
  planos: TotalPlano[];
  vencidas: ParcelaResumo[];             // maiores parcelas vencidas (pagar e receber)
  proximos: ParcelaResumo[];             // vencimentos dos próximos 30 dias
  saldos: SaldoContaDetalhe[];
  movimentos: MovimentoBancario[];       // últimos movimentos do período
  titulosPagar: Titulo[];                // títulos com parcela vencendo no período (mais recentes primeiro)
  titulosReceber: Titulo[];
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
  sincronizacao: ConfigSync | null; // o que puxar do Sienge (null = ainda não escolhido)
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
