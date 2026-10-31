// Insumos de cada obra (bulk-data/v1/building/resources) já normalizados. Cada obra custa 1 requisição bulk-data,
// então o que veio fica guardado e só é buscado de novo depois do intervalo (ou no "↻ Sienge").
import { db } from './db';
import type { InsumoObra } from '../types';

export interface InsumosSalvos { obra: string; insumos: InsumoObra[]; em: string }

export const ObraInsumosModel = {
  salvar(obraId: string, obra: string, insumos: InsumoObra[]): void {
    db.prepare('INSERT OR REPLACE INTO obra_insumos (obraId, obra, json, em) VALUES (?,?,?,?)')
      .run(obraId, obra, JSON.stringify(insumos), new Date().toISOString());
  },

  ler(ids: string[]): Map<string, InsumosSalvos> {
    const q = db.prepare('SELECT obra, json, em FROM obra_insumos WHERE obraId = ?');
    const out = new Map<string, InsumosSalvos>();
    for (const id of ids) {
      const r = q.get(id) as { obra: string; json: string; em: string } | undefined;
      if (r) out.set(id, { obra: r.obra, insumos: JSON.parse(r.json) as InsumoObra[], em: r.em });
    }
    return out;
  },

  /** obraId → quando foi atualizada. */
  atualizacoes(): Map<string, string> {
    const rows = db.prepare('SELECT obraId, em FROM obra_insumos').all() as { obraId: string; em: string }[];
    return new Map(rows.map(r => [r.obraId, r.em]));
  },

  limpar(): void {
    db.exec('DELETE FROM obra_insumos');
  },
};
