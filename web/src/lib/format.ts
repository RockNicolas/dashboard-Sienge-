import type { Scale } from 'chart.js';

export const brl = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
/** Preço unitário: sempre com centavos (R$ 2,10). */
export const brlPreco = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = (n: number | null | undefined) => (n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** Situação do pedido de compra (campo `status` do Sienge). */
export const SITUACAO_PEDIDO: Record<string, string> = {
  PENDING: 'Pendente', PARTIALLY_DELIVERED: 'Parcialmente entregue', FULLY_DELIVERED: 'Totalmente atendido', CANCELED: 'Cancelado',
};
export const pct = (n: number) => num(n) + '%';
export const dataHora = (s: string) => new Date(s).toLocaleString('pt-BR');

// Preenchidas por aplicarTema() (lib/tema.ts) conforme claro/escuro.
/** Cores de categoria (diferenciar séries/fatias): vivas, mas sem verde, amarelo, laranja e vermelho, que são de status. */
export const PALETA: string[] = ['#4f46e5', '#0891b2', '#9333ea', '#0284c7', '#c026d3', '#6366f1', '#7c3aed', '#0e7490'];
/**
 * Cores dos gráficos. Status (bom, melhorar, atencao, ruim) = as mesmas dos cards (lib/status.ts).
 * Séries sem bom/ruim: principal (anil), secundaria (roxo), terciaria (azul-céu), referencia (anil claro: orçado, ano anterior).
 * neutro: só linhas de referência (média).
 */
export const COR = {
  principal: '#4f46e5', secundaria: '#9333ea', terciaria: '#0284c7', referencia: '#c7d2fe',
  neutro: '#64748b', neutroMedio: '#94a3b8', neutroClaro: '#cbd5e1',
  bom: '#16a34a', melhorar: '#eab308', atencao: '#ea580c', ruim: '#dc2626',
};
/** Cor do gráfico para um status; sem status, a cor da série (padrão: principal). */
export const corStatus = (s: { nivel: 'bom' | 'melhorar' | 'atencao' | 'ruim' } | null | undefined, semStatus = COR.principal) => (s ? COR[s.nivel] : semStatus);

/** Valor curto para eixos de gráfico: "R$ 200 mil", "R$ 2,3 mi" (não encavala no celular). */
export const brlCurto = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

export const eixoBRL = { ticks: { callback: (v: string | number) => brlCurto(Number(v)) } };

/** Listas longas começam menores no celular (cada linha vira um cartão). */
export const celular = () => innerWidth < 760;

/** Abaixo desta largura (celular e tablet) as tabelas longas viram cartões, bem mais altos: as listas começam menores. */
export const listaCurta = () => innerWidth < 1000;

export const meses = (...series: { mes: string }[][]) => [...new Set(series.flat().map(x => x.mes))].sort();
export const porMes = (serie: { mes: string; valor: number }[], ms: string[]) =>
  ms.map(m => serie.find(x => x.mes === m)?.valor ?? 0);

export const dataBR = (iso: string) => iso.split('-').reverse().join('/');

/** Encurta nomes longos (fornecedor, obra) conforme a largura da tela: no celular cabem menos letras. */
export const encurtar = (s: string, max = innerWidth < 760 ? 16 : 30) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/** Rótulo de eixo de categorias encurtado (o nome inteiro continua no tooltip). Uso: `ticks: { callback: rotuloEixo }`. */
export function rotuloEixo(this: Scale, valor: string | number): string {
  return encurtar(String(this.getLabelForValue(Number(valor))));
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** Rótulo do período do financeiro: "out/26" (mês) ou "19/10" (semana que começa nesse dia). */
export const rotuloPeriodo = (p: string) =>
  p.length === 7 ? `${MESES[Number(p.slice(5, 7)) - 1]}/${p.slice(2, 4)}` : `${p.slice(8, 10)}/${p.slice(5, 7)}`;

/** Palavras certas para o período: "do mês" / "da semana", "último mês" / "última semana", "3 meses" / "3 semanas". */
export function falaPeriodo(nome: string) {
  const fem = nome === 'semana';
  return {
    do: fem ? 'da' : 'do', ao: fem ? 'à' : 'ao', ultimo: fem ? 'última' : 'último', igual: fem ? 'igual à' : 'igual ao',
    comparado: fem ? 'comparada' : 'comparado', dos: fem ? 'das' : 'dos',
    plural: (n: number) => (n === 1 ? nome : nome === 'mês' ? 'meses' : `${nome}s`),
  };
}
