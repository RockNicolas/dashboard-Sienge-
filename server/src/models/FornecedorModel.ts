// Cadastro de credores do Sienge (fornecedores dos pedidos de compra). O pedido de compra só traz o supplierId,
// então o nome, CNPJ e contato vêm de /creditors e ficam guardados aqui. Quem o Sienge não encontrou fica marcado
// (nome vazio) e só é buscado de novo depois de alguns dias, para não gastar cota toda sincronização.
import { db } from './db';
import type { FornecedorCadastro } from '../types';

const DIAS_PARA_REPETIR = 7;

interface Linha extends Omit<FornecedorCadastro, 'ativo'> { ativo: number | null }

export const FornecedorModel = {
  /** Credores com cadastro encontrado. */
  todos(): FornecedorCadastro[] {
    const rows = db.prepare("SELECT id, nome, fantasia, cnpj, cidade, telefone, email, ativo FROM fornecedores WHERE nome <> ''")
      .all() as unknown as Linha[];
    return rows.map(r => ({ ...r, ativo: r.ativo !== 0 }));
  },

  /** Ids que não precisam ser buscados agora: já têm cadastro ou não foram encontrados há pouco tempo. */
  conhecidos(agora = new Date()): Set<string> {
    const limite = new Date(agora.getTime() - DIAS_PARA_REPETIR * 864e5).toISOString();
    const rows = db.prepare("SELECT id FROM fornecedores WHERE nome <> '' OR em > ?").all(limite) as { id: string }[];
    return new Set(rows.map(r => r.id));
  },

  salvar(lista: FornecedorCadastro[]): void {
    const em = new Date().toISOString();
    const st = db.prepare(`INSERT OR REPLACE INTO fornecedores (id, nome, fantasia, cnpj, cidade, telefone, email, ativo, em)
      VALUES (?,?,?,?,?,?,?,?,?)`);
    for (const f of lista) st.run(f.id, f.nome, f.fantasia, f.cnpj, f.cidade, f.telefone, f.email, f.ativo ? 1 : 0, em);
  },

  /** O Sienge não encontrou o credor (404): marca para não buscar de novo por alguns dias. */
  marcarAusente(id: string): void {
    db.prepare(`INSERT OR REPLACE INTO fornecedores (id, nome, fantasia, cnpj, cidade, telefone, email, ativo, em)
      VALUES (?, '', '', '', '', '', '', NULL, ?)`).run(id, new Date().toISOString());
  },

  limpar(): void {
    db.exec('DELETE FROM fornecedores');
  },
};
