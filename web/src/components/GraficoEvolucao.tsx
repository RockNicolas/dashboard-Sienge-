import type { ScriptableLineSegmentContext } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { brl, COR, corStatus, eixoBRL, falaPeriodo } from '../lib/format';
import { statusMargem, textoStatus, type Status } from '../lib/status';
import { Sinal } from './Status';
import { Grafico } from './ui';

export interface PontoEvolucao { rotulo: string; receitas: number; despesas: number }

/** Quantos períodos seguidos o resultado vem subindo (positivo) ou caindo (negativo), contando do último para trás. */
export function tendencia(valores: number[]): number {
  let n = 0;
  for (let i = valores.length - 1; i > 0; i--) {
    const d = valores[i] - valores[i - 1];
    if (d === 0 || (n > 0 && d < 0) || (n < 0 && d > 0)) break;
    n += d > 0 ? 1 : -1;
  }
  return n;
}

/**
 * Evolução do resultado (receitas − despesas) período a período: a linha sobe e desce, verde acima de zero (lucro)
 * e vermelha abaixo (prejuízo), com o acumulado tracejado — para ver quando saiu do prejuízo ou entrou nele.
 */
export function GraficoEvolucao({ pontos: todos, nomePeriodo = 'mês', inicioPrevisao }: {
  pontos: PontoEvolucao[]; nomePeriodo?: string;
  inicioPrevisao?: number;   // índice do primeiro período futuro (parcelas que ainda vão vencer): linha tracejada, fora do resumo
}) {
  const f = falaPeriodo(nomePeriodo);
  // períodos vazios no fim (ainda sem lançamento) ficam de fora: pareceriam "lucro de R$ 0" e mudariam a tendência
  let fim = todos.length;
  while (fim > 0 && !todos[fim - 1].receitas && !todos[fim - 1].despesas) fim--;
  const pontos = todos.slice(0, fim);
  const resultado = pontos.map(p => p.receitas - p.despesas);
  let soma = 0;
  const acumulado = resultado.map(v => (soma += v));
  const status = pontos.map((p, i) => statusMargem(resultado[i], p.receitas) ?? (resultado[i] >= 0 ? null : { nivel: 'ruim', motivo: 'Prejuízo' } as Status));
  // o resumo (tendência, último, virada, acumulado) olha só até o período atual; o futuro é previsão
  const nReal = inicioPrevisao != null ? Math.min(inicioPrevisao, resultado.length) : resultado.length;
  const real = resultado.slice(0, nReal);
  const previsao = (i: number) => inicioPrevisao != null && i >= inicioPrevisao;
  const t = tendencia(real);
  const sinalTendencia: Status | null = t === 0 ? null
    : t > 0 ? { nivel: 'bom', motivo: `O resultado subiu ${t} ${f.plural(t)} seguidos` }
      : { nivel: 'ruim', motivo: `O resultado caiu ${-t} ${f.plural(-t)} seguidos` };
  const ultimo = real.at(-1) ?? 0;
  // último período em que o resultado trocou de lado (prejuízo → lucro ou o contrário)
  let virou = -1;
  for (let i = real.length - 1; i > 0 && virou < 0; i--) {
    if (real[i] !== 0 && Math.sign(real[i]) !== Math.sign(real[i - 1])) virou = i;
  }
  const cor = (v: number) => (v >= 0 ? COR.bom : COR.ruim);

  if (!pontos.length) return <p className="muted">Sem lançamentos no período.</p>;
  return (
    <>
      <div className="evolucao-resumo">
        {sinalTendencia && <Sinal s={sinalTendencia} />}
        <span>{t > 0 ? `↗ Melhorando há ${t} ${f.plural(t)}` : t < 0 ? `↘ Piorando há ${-t} ${f.plural(-t)}` : '→ Estável'}</span>
        <span className="muted">
          · {f.ultimo} {nomePeriodo}: <b className={ultimo > 0 ? 'txt-bom' : ultimo < 0 ? 'txt-ruim' : ''}>{ultimo > 0 ? `lucro de ${brl(ultimo)}` : ultimo < 0 ? `prejuízo de ${brl(-ultimo)}` : 'zerado'}</b>
          {virou > 0 && ` · virou para ${resultado[virou] >= 0 ? 'lucro' : 'prejuízo'} em ${pontos[virou].rotulo}`}
          {' · acumulado até agora: '}<b className={(acumulado[nReal - 1] ?? 0) >= 0 ? 'txt-bom' : 'txt-ruim'}>{brl(acumulado[nReal - 1] ?? 0)}</b>
          {nReal < resultado.length && <>{' · previsão até '}{pontos.at(-1)!.rotulo}: <b className={(acumulado.at(-1) ?? 0) >= 0 ? 'txt-bom' : 'txt-ruim'}>{brl(acumulado.at(-1) ?? 0)}</b></>}
        </span>
      </div>
      <Grafico>
        <Line
          data={{
            labels: pontos.map(p => p.rotulo),
            datasets: [
              {
                label: `Resultado ${f.do} ${nomePeriodo}`, data: resultado, tension: 0.3, borderWidth: 2.5,
                // acima de zero verde (lucro), abaixo vermelho (prejuízo): na linha e na área
                fill: { target: 'origin', above: `${COR.bom}2e`, below: `${COR.ruim}2e` },
                segment: {
                  borderColor: (c: ScriptableLineSegmentContext) => cor(((c.p0.parsed.y ?? 0) + (c.p1.parsed.y ?? 0)) / 2),
                  borderDash: (c: ScriptableLineSegmentContext) => (previsao(c.p1DataIndex) ? [6, 5] : undefined),
                },
                borderColor: COR.bom,
                pointRadius: 5, pointHoverRadius: 7,
                // previsão: ponto vazado (só o contorno)
                pointBackgroundColor: status.map((s, i) => (previsao(i) ? 'transparent' : corStatus(s, cor(resultado[i])))),
                pointBorderColor: status.map((s, i) => corStatus(s, cor(resultado[i]))),
              },
              {
                label: 'Acumulado', data: acumulado, borderColor: COR.principal, borderDash: [6, 4], borderWidth: 1.5,
                pointRadius: 0, pointHoverRadius: 4, tension: 0.3, fill: false,
              },
            ],
          }}
          options={{
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            plugins: {
              tooltip: {
                callbacks: {
                  label: c => (c.datasetIndex === 0
                    ? `${Number(c.parsed.y) >= 0 ? 'Lucro' : 'Prejuízo'} ${f.do} ${nomePeriodo}: ${brl(Math.abs(Number(c.parsed.y)))}`
                    : `Acumulado: ${brl(Number(c.parsed.y))}`),
                  afterLabel: c => {
                    if (c.datasetIndex !== 0) return '';
                    const i = c.dataIndex;
                    const linhas = [`Receitas ${brl(pontos[i].receitas)} − despesas ${brl(pontos[i].despesas)}`, ...(previsao(i) ? ['previsão: parcelas que ainda vão vencer'] : [])];
                    if (i > 0) {
                      const dif = resultado[i] - resultado[i - 1];
                      linhas.push(dif === 0 ? `${f.igual} ${nomePeriodo} anterior` : `${dif > 0 ? '↗ subiu' : '↘ caiu'} ${brl(Math.abs(dif))} em relação ${f.ao} ${nomePeriodo} anterior`);
                    }
                    const s = textoStatus(status[i]);
                    return s ? [...linhas, s] : linhas;
                  },
                },
              },
            },
            scales: {
              y: { ...eixoBRL, grid: { color: c => (c.tick.value === 0 ? COR.neutro : undefined), lineWidth: c => (c.tick.value === 0 ? 2 : 1) } },
              x: { grid: { display: false } },
            },
          }}
        />
      </Grafico>
      <div className="regra-grafico">
        <span className="sinal bom"><i aria-hidden="true">✓</i>acima da linha do zero = lucro</span>
        <span className="sinal ruim"><i aria-hidden="true">✕</i>abaixo = prejuízo</span>
        <span className="muted">
          · pontos com a cor da margem {f.do} {nomePeriodo} · tracejado anil = resultado acumulado
          {nReal < pontos.length && ` · a partir de ${pontos[nReal].rotulo}: previsão (parcelas que ainda vão vencer), linha tracejada e pontos vazados`}
        </span>
      </div>
    </>
  );
}
