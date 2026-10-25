// Dados financeiros sincronizados do Sienge. Parcelas e movimentos ficam como JSON normalizado, indexados pela data
// (vencimento da parcela / data do movimento); contas correntes e saldos são uma "foto" da última sincronização.
import { db, transacao } from './db';
import type { ContaCorrente, ContaPagar, ContaReceber, DadosFinanceiros, MovimentoBancario, Obra, SaldoConta } from '../types';

type Tipo = 'pagar' | 'receber' | 'movimento';

function substituir<T>(tipo: Tipo, rows: T[], de: string, ate: string, chave: (r: T) => string, data: (r: T) => string): void {
  db.prepare('DELETE FROM fin_registros WHERE tipo = ? AND data >= ? AND data <= ?').run(tipo, de, ate);
  const ins = db.prepare('INSERT OR REPLACE INTO fin_registros VALUES (?,?,?,?)');
  rows.forEach(r => ins.run(tipo, chave(r), data(r), JSON.stringify(r)));
}

function ler<T>(tipo: Tipo, de: string, ate: string): T[] {
  return (db.prepare('SELECT json FROM fin_registros WHERE tipo = ? AND data >= ? AND data <= ?').all(tipo, de, ate) as { json: string }[])
    .map(r => JSON.parse(r.json) as T);
}

function foto<T>(tipo: string): T[] {
  const r = db.prepare('SELECT json FROM fin_snapshot WHERE tipo = ?').get(tipo) as { json: string } | undefined;
  return r ? (JSON.parse(r.json) as T[]) : [];
}

export interface JanelaFinanceira { vencDe: string; vencAte: string; movDe: string; movAte: string }

export const FinanceiroModel = {
  /**
   * Grava a sincronização: substitui as janelas (captura baixas, edições e exclusões feitas no Sienge).
   * Cada módulo é opcional — o que falhou na busca fica com os dados anteriores.
   */
  salvar(d: Partial<Omit<DadosFinanceiros, 'obras'>>, j: JanelaFinanceira): void {
    transacao(() => {
      if (d.pagar) substituir('pagar', d.pagar, j.vencDe, j.vencAte, r => `${r.tituloId}/${r.parcelaId}`, r => r.vencimento);
      if (d.receber) substituir('receber', d.receber, j.vencDe, j.vencAte, r => `${r.tituloId}/${r.parcelaId}`, r => r.vencimento);
      if (d.movimentos) substituir('movimento', d.movimentos, j.movDe, j.movAte, r => r.id, r => r.data);
      const em = new Date().toISOString();
      const snap = db.prepare('INSERT OR REPLACE INTO fin_snapshot VALUES (?,?,?)');
      if (d.contas) snap.run('contas', JSON.stringify(d.contas), em);
      if (d.saldos) snap.run('saldos', JSON.stringify(d.saldos), em);
      snap.run('sync', '[]', em);
    });
  },

  ler(de: string, ate: string, obras: Obra[]): DadosFinanceiros {
    return {
      pagar: ler<ContaPagar>('pagar', de, ate),
      receber: ler<ContaReceber>('receber', de, ate),
      movimentos: ler<MovimentoBancario>('movimento', de, ate),
      contas: foto<ContaCorrente>('contas'),
      saldos: foto<SaldoConta>('saldos'),
      obras,
    };
  },

  /** Quando foi a última sincronização financeira (null = nunca). */
  ultima(): string | null {
    const r = db.prepare("SELECT em FROM fin_snapshot WHERE tipo = 'sync'").get() as { em: string } | undefined;
    return r?.em ?? null;
  },

  limpar(): void {
    db.exec('DELETE FROM fin_registros; DELETE FROM fin_snapshot;');
  },
};
