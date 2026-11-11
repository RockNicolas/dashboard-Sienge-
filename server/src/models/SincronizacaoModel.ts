import { db } from './db';
import type { Dados, Sincronizacao } from '../types';

export const SincronizacaoModel = {
  registrar(d: Dados, de: string, ate: string): void {
    db.prepare('INSERT INTO sincronizacoes (em,de,ate,compras,consumos,comprado,consumido) VALUES (?,?,?,?,?,?,?)')
      .run(new Date().toISOString(), de, ate, d.compras.length, d.consumos.length,
        d.compras.reduce((a, c) => a + c.valor, 0), d.consumos.reduce((a, c) => a + c.valor, 0));
  },

  historico(n = 20): Sincronizacao[] {
    return db.prepare('SELECT * FROM sincronizacoes ORDER BY id DESC LIMIT ?').all(n) as unknown as Sincronizacao[];
  },

  /** Do começo ao fim do que já foi sincronizado do Sienge (null = nunca sincronizou). */
  cobertura(): { de: string; ate: string } | null {
    const r = db.prepare('SELECT MIN(de) de, MAX(ate) ate FROM sincronizacoes').get() as { de: string | null; ate: string | null };
    return r.de && r.ate ? { de: r.de, ate: r.ate } : null;
  },

  ultima(): Sincronizacao | undefined {
    return db.prepare('SELECT * FROM sincronizacoes ORDER BY id DESC LIMIT 1').get() as unknown as Sincronizacao | undefined;
  },
};
