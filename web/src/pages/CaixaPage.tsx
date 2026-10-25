import { Bar } from 'react-chartjs-2';
import { BarraFinanceiro, GraficoCaixa, nomeAgrupar } from '../components/financeiro';
import { Card, Grafico, Kpi, Kpis, Tabela } from '../components/ui';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { brl, dataBR, eixoBRL, PALETA } from '../lib/format';

export default function CaixaPage() {
  const { dados: d, erro, agrupar, setAgrupar } = useFinanceiro();
  if (erro) return <div className="erro">Erro: {erro}</div>;
  if (!d) return <p className="muted">Carregando financeiro…</p>;
  const r = d.resumo;
  return (
    <>
      <BarraFinanceiro d={d} agrupar={agrupar} setAgrupar={setAgrupar} />
      <Kpis>
        <Kpi cor={PALETA[0]} titulo="Saldo em bancos" valor={r.saldoBancos == null ? '—' : brl(r.saldoBancos)}
          sub={r.saldoBancos == null ? 'saldo de conta não é por obra' : `${d.saldos.length} contas`} />
        <Kpi cor={PALETA[2]} titulo="Entradas no período" valor={brl(r.entradas)} sub="recebimentos e créditos" />
        <Kpi cor={PALETA[7]} titulo="Saídas no período" valor={brl(r.saidas)} sub="pagamentos e débitos" />
        <Kpi cor={PALETA[6]} titulo="Resultado" valor={<span className={r.resultadoCaixa < 0 ? 'neg' : ''}>{brl(r.resultadoCaixa)}</span>} sub="entradas − saídas" />
      </Kpis>

      <div className="cols">
        <Card titulo={`Entradas × Saídas por ${nomeAgrupar(agrupar)}`}>
          <GraficoCaixa serie={d.serie} />
        </Card>
        <Card titulo="Por plano financeiro">
          <Grafico>
            <Bar
              data={{
                labels: d.planos.map(p => p.plano),
                datasets: [
                  { label: 'Saídas', data: d.planos.map(p => p.saidas), backgroundColor: PALETA[7] },
                  { label: 'Entradas', data: d.planos.map(p => p.entradas), backgroundColor: PALETA[2] },
                ],
              }}
              options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: eixoBRL, y: { grid: { display: false } } } }}
            />
          </Grafico>
        </Card>
      </div>

      <div className="cols">
        <Card titulo="Saldo por conta">
          {d.saldos.length ? (
            <Tabela linhas={d.saldos} colunas={[
              { t: 'Conta', f: s => s.nome },
              { t: 'Banco', f: s => s.banco || '—' },
              { t: 'Saldo', f: s => <span className={s.saldo < 0 ? 'neg' : ''}>{brl(s.saldo)}</span> },
              { t: 'Conciliado', f: s => brl(s.conciliado) },
              { t: 'Data', f: s => dataBR(s.data) },
            ]} />
          ) : <p className="muted">Sem saldos sincronizados.</p>}
        </Card>
        <Card titulo="Últimos movimentos">
          {d.movimentos.length ? (
            <Tabela linhas={d.movimentos} colunas={[
              { t: 'Data', f: m => dataBR(m.data) },
              { t: 'Histórico', f: m => m.parceiro || m.historico || m.operacao },
              { t: 'Obra', f: m => m.obras.map(o => o.nome).join(', ') || '—' },
              { t: 'Valor', f: m => <span className={m.valor < 0 ? 'neg' : 'pos'}>{brl(m.valor)}</span> },
              { t: 'Conciliado', f: m => (m.conciliado ? 'Sim' : 'Não') },
            ]} />
          ) : <p className="muted">Sem movimentos no período.</p>}
        </Card>
      </div>
    </>
  );
}
