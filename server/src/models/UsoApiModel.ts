import { db } from './db';

export interface UsoDia { dia: string; requisicoes: number; bulk: number; erros: number; headers: Record<string, string> | null }

const hoje = () => new Date().toISOString().slice(0, 10);

type Linha = { dia: string; requisicoes: number; bulk: number; erros: number; headers: string | null };
const parse = (r: Linha): UsoDia => ({
  dia: r.dia, requisicoes: r.requisicoes, bulk: r.bulk ?? 0, erros: r.erros,
  headers: r.headers ? (JSON.parse(r.headers) as Record<string, string>) : null,
});

export const UsoApiModel = {
  /** Conta uma requisição à API do Sienge no dia de hoje (REST ou bulk-data, que têm cotas separadas). */
  registrar(opts: { erro?: boolean; headers?: Record<string, string>; bulk?: boolean }): void {
    const dia = hoje();
    db.prepare('INSERT OR IGNORE INTO api_uso (dia) VALUES (?)').run(dia);
    const coluna = opts.bulk ? 'bulk' : 'requisicoes';
    db.prepare(`UPDATE api_uso SET ${coluna} = ${coluna} + 1, erros = erros + ? WHERE dia = ?`).run(opts.erro ? 1 : 0, dia);
    // só os cabeçalhos REST: são eles que informam o limite diário do plano
    if (!opts.bulk && opts.headers && Object.keys(opts.headers).length)
      db.prepare('UPDATE api_uso SET headers = ? WHERE dia = ?').run(JSON.stringify(opts.headers), dia);
  },

  hoje(): UsoDia {
    const r = db.prepare('SELECT * FROM api_uso WHERE dia = ?').get(hoje()) as Linha | undefined;
    return r ? parse(r) : { dia: hoje(), requisicoes: 0, bulk: 0, erros: 0, headers: null };
  },

  /** Apaga a contagem e os cabeçalhos (pertencem ao usuário de API desconectado). */
  limpar(): void {
    db.exec('DELETE FROM api_uso');
  },

  /** Cabeçalhos de rate limit mais recentes já recebidos (de qualquer dia). */
  ultimosHeaders(): Record<string, string> | null {
    const r = db.prepare('SELECT headers FROM api_uso WHERE headers IS NOT NULL ORDER BY dia DESC LIMIT 1').get() as { headers: string } | undefined;
    return r ? (JSON.parse(r.headers) as Record<string, string>) : null;
  },

  ultimosDias(n: number): UsoDia[] {
    return (db.prepare('SELECT * FROM api_uso ORDER BY dia DESC LIMIT ?').all(n) as unknown as Linha[]).map(parse).reverse();
  },
};
