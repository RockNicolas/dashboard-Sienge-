import { Card, Tabela } from '../components/ui';
import { useDados } from '../hooks/useDashboard';
import { brl, num, pct } from '../lib/format';

export default function PrecosPage() {
  const d = useDados();
  if (!d) return null;
  return (
    <Card titulo="Variação de preço unitário e economia potencial">
      <p className="muted">Economia potencial = quanto se pouparia se todas as compras do período tivessem saído ao menor preço pago.</p>
      <Tabela linhas={d.variacaoPreco} colunas={[
        { t: 'Insumo', f: r => r.insumo },
        { t: 'Menor preço', f: r => `R$ ${num(r.min)}/${r.un}` },
        { t: 'Médio', f: r => `R$ ${num(r.medio)}` },
        { t: 'Maior preço', f: r => `R$ ${num(r.max)}` },
        { t: 'Variação', f: r => <span className={r.variacao > 20 ? 'neg' : ''}>{pct(r.variacao)}</span> },
        { t: 'Fornecedor mais barato', f: r => r.melhorFornecedor },
        { t: 'Economia potencial', f: r => <b className="pos">{brl(r.economiaPotencial)}</b> },
      ]} />
    </Card>
  );
}
