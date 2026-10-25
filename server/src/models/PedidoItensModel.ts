// Itens de pedido de compra já baixados do Sienge (resposta crua da API). Cada pedido custa 1 requisição,
// então o que já veio fica guardado e a sincronização seguinte só busca os pedidos novos.
import { db } from './db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

export const PedidoItensModel = {
  obter(pedidos: string[]): Map<string, Raw[]> {
    const q = db.prepare('SELECT itens FROM pedido_itens WHERE pedido = ?');
    const out = new Map<string, Raw[]>();
    for (const p of pedidos) {
      const r = q.get(p) as { itens: string } | undefined;
      if (r) out.set(p, JSON.parse(r.itens) as Raw[]);
    }
    return out;
  },

  limpar(): void {
    db.exec('DELETE FROM pedido_itens');
  },

  salvar(pedido: string, itens: Raw[]): void {
    db.prepare('INSERT OR REPLACE INTO pedido_itens VALUES (?,?,?)').run(pedido, JSON.stringify(itens), new Date().toISOString());
  },
};
