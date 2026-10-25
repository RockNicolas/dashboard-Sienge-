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
  usuario: string;
  atualizado: string;
  obrasDisponiveis: Obra[];
  quota: QuotaInfo;
}

export interface Sincronizacao {
  id: number; em: string; de: string; ate: string;
  compras: number; consumos: number; comprado: number; consumido: number;
}

// ---------- configuração do Sienge e cota diária da API ----------
export interface ConfigPublica {
  usarMock: boolean;       // preferência salva
  mockEfetivo: boolean;    // true se estiver mostrando dados de demonstração agora
  subdominio: string;
  usuario: string;
  senhaDefinida: boolean;  // a senha nunca volta para o navegador
  endpointConsumo: string;
  limiteDiario: number;    // 0 = sem limite definido
}

export interface ConfigEntrada {
  usarMock?: boolean;
  subdominio?: string;
  usuario?: string;
  senha?: string;          // vazio/ausente = mantém a senha salva
  endpointConsumo?: string;
  limiteDiario?: number;
}

export interface QuotaInfo {
  dia: string;
  usadas: number;
  erros: number;
  limite: number;            // 0 = sem limite definido
  restante: number | null;   // null quando não há limite
  pct: number;               // 0–100 (0 sem limite)
  headers: Record<string, string> | null; // cabeçalhos de rate limit devolvidos pela API, se houver
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
