import { db } from './db';
import type { Compra, Consumo, Dados, Obra } from '../types';

// chave estável; duplicatas idênticas dentro do mesmo lote ganham sufixo
function chaves<T>(rows: T[], base: (r: T) => string): string[] {
  const vistos = new Map<string, number>();
  return rows.map(r => {
    const b = base(r);
    const n = (vistos.get(b) ?? 0) + 1;
    vistos.set(b, n);
    return `${b}#${n}`;
  });
}

export const DadosModel = {
  /** Substitui o período [de, ate] (captura edições e cancelamentos feitos no Sienge). */
  substituirPeriodo({ compras, consumos, obras }: Dados, de: string, ate: string): void {
    const kc = chaves(compras, c => `${c.pedido}|${c.insumoId}|${c.data}|${c.qtd}|${c.preco}`);
    const ku = chaves(consumos, c => `${c.data}|${c.obraId}|${c.insumoId}|${c.qtd}|${c.valor}`);

    db.prepare('DELETE FROM compras WHERE data >= ? AND data <= ?').run(de, ate);
    db.prepare("DELETE FROM consumos WHERE data >= ? AND data <= ? AND (origem IS NULL OR origem = 'api')").run(de, ate);

    const ic = db.prepare('INSERT OR REPLACE INTO compras VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    compras.forEach((c, i) => ic.run(kc[i], c.data, c.pedido, c.fornecedorId, c.fornecedor,
      c.insumoId, c.insumo, c.un, c.qtd, c.preco, c.valor, c.prazoEntrega));

    const iu = db.prepare('INSERT OR REPLACE INTO consumos (chave,data,obraId,obra,insumoId,insumo,un,qtd,valor) VALUES (?,?,?,?,?,?,?,?,?)');
    consumos.forEach((c, i) => iu.run(ku[i], c.data, c.obraId, c.obra,
      c.insumoId, c.insumo, c.un, c.qtd, c.valor));

    const io = db.prepare('INSERT OR REPLACE INTO obras VALUES (?,?)');
    obras.forEach(o => io.run(o.id, o.nome));
  },

  temDados(): boolean {
    return !!db.prepare('SELECT 1 FROM compras LIMIT 1').get() || !!db.prepare('SELECT 1 FROM consumos LIMIT 1').get();
  },

  garantirObra(o: Obra): void {
    db.prepare('INSERT OR REPLACE INTO obras VALUES (?,?)').run(o.id, o.nome);
  },

  obras(): Obra[] {
    return db.prepare('SELECT * FROM obras ORDER BY nome').all() as unknown as Obra[];
  },

  adicionarConsumos(rows: Consumo[], origem: string): void {
    const iu = db.prepare('INSERT OR REPLACE INTO consumos (chave,data,obraId,obra,insumoId,insumo,un,qtd,valor,origem) VALUES (?,?,?,?,?,?,?,?,?,?)');
    rows.forEach((c, i) => iu.run(`${origem}#${i}`, c.data, c.obraId, c.obra, c.insumoId, c.insumo, c.un, c.qtd, c.valor, origem));
  },

  removerOrigem(origem: string): void {
    db.prepare('DELETE FROM consumos WHERE origem = ?').run(origem);
  },

  ler(de: string, ate: string): Dados {
    const q = (t: string) => db.prepare(`SELECT * FROM ${t} WHERE data >= ? AND data <= ?`).all(de, ate);
    return {
      compras: q('compras') as unknown as Compra[],
      consumos: q('consumos') as unknown as Consumo[],
      obras: db.prepare('SELECT * FROM obras').all() as unknown as Obra[],
    };
  },
};
