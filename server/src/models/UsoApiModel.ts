import { db } from './db';

export interface UsoDia { dia: string; requisicoes: number; erros: number; headers: Record<string, string> | null }

const hoje = () => new Date().toISOString().slice(0, 10);

type Linha = { dia: string; requisicoes: number; erros: number; headers: string | null };
const parse = (r: Linha): UsoDia => ({
  dia: r.dia, requisicoes: r.requisicoes, erros: r.erros,
  headers: r.headers ? (JSON.parse(r.headers) as Record<string, string>) : null,
});

export const UsoApiModel = {
  /** Conta uma requisição à API do Sienge no dia de hoje. */
  registrar(opts: { erro?: boolean; headers?: Record<string, string> }): void {
    const dia = hoje();
    db.prepare('INSERT OR IGNORE INTO api_uso (dia) VALUES (?)').run(dia);
    db.prepare('UPDATE api_uso SET requisicoes = requisicoes + 1, erros = erros + ? WHERE dia = ?').run(opts.erro ? 1 : 0, dia);
    if (opts.headers && Object.keys(opts.headers).length)
      db.prepare('UPDATE api_uso SET headers = ? WHERE dia = ?').run(JSON.stringify(opts.headers), dia);
  },

  hoje(): UsoDia {
    const r = db.prepare('SELECT * FROM api_uso WHERE dia = ?').get(hoje()) as Linha | undefined;
    return r ? parse(r) : { dia: hoje(), requisicoes: 0, erros: 0, headers: null };
  },

  ultimosDias(n: number): UsoDia[] {
    return (db.prepare('SELECT * FROM api_uso ORDER BY dia DESC LIMIT ?').all(n) as unknown as Linha[]).map(parse).reverse();
  },
};
