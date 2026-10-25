import { db } from './db';
import type { Importacao } from '../types';

type Linha = Omit<Importacao, 'distribuido'> & { distribuido: number };
const paraImportacao = (r: Linha): Importacao => ({ ...r, distribuido: !!r.distribuido });

export const ImportacaoModel = {
  criar(i: Omit<Importacao, 'id' | 'criado'>): Importacao {
    const criado = new Date().toISOString();
    const r = db.prepare('INSERT INTO importacoes (criado,tipo,arquivo,obraId,obra,de,ate,linhas,total,distribuido) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(criado, i.tipo, i.arquivo, i.obraId, i.obra, i.de, i.ate, i.linhas, i.total, i.distribuido ? 1 : 0);
    return { ...i, id: Number(r.lastInsertRowid), criado };
  },

  listar(): Importacao[] {
    return (db.prepare('SELECT * FROM importacoes ORDER BY id DESC').all() as unknown as Linha[]).map(paraImportacao);
  },

  obter(id: number): Importacao | undefined {
    const r = db.prepare('SELECT * FROM importacoes WHERE id = ?').get(id) as unknown as Linha | undefined;
    return r && paraImportacao(r);
  },

  mesmoPeriodo(tipo: string, obraId: string, de: string, ate: string): Importacao | undefined {
    const r = db.prepare('SELECT * FROM importacoes WHERE tipo = ? AND obraId = ? AND de = ? AND ate = ?').get(tipo, obraId, de, ate) as unknown as Linha | undefined;
    return r && paraImportacao(r);
  },

  excluir(id: number): void {
    db.prepare('DELETE FROM importacoes WHERE id = ?').run(id);
  },
};
