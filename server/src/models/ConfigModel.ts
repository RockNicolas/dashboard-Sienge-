import { db } from './db';

export const ConfigModel = {
  obter(chave: string): string | undefined {
    const r = db.prepare('SELECT valor FROM config WHERE chave = ?').get(chave) as { valor: string } | undefined;
    return r?.valor;
  },

  definir(chave: string, valor: string): void {
    db.prepare('INSERT OR REPLACE INTO config VALUES (?,?)').run(chave, valor);
  },
};
