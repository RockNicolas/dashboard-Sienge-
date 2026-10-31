// SQLite embutido do Node (node:sqlite): usuários do painel + histórico do Sienge.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../config/env';

const DIR = path.join(ROOT, 'data');
fs.mkdirSync(DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DIR, 'painel.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (usuario TEXT PRIMARY KEY, hash TEXT NOT NULL, criado TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS obras (id TEXT PRIMARY KEY, nome TEXT);
CREATE TABLE IF NOT EXISTS compras (
  chave TEXT PRIMARY KEY, data TEXT, pedido TEXT, fornecedorId TEXT, fornecedor TEXT,
  insumoId TEXT, insumo TEXT, un TEXT, qtd REAL, preco REAL, valor REAL, prazoEntrega REAL);
CREATE TABLE IF NOT EXISTS consumos (
  chave TEXT PRIMARY KEY, data TEXT, obraId TEXT, obra TEXT,
  insumoId TEXT, insumo TEXT, un TEXT, qtd REAL, valor REAL);
CREATE TABLE IF NOT EXISTS sincronizacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, em TEXT, de TEXT, ate TEXT,
  compras INTEGER, consumos INTEGER, comprado REAL, consumido REAL);
CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT);
CREATE TABLE IF NOT EXISTS api_uso (
  dia TEXT PRIMARY KEY, requisicoes INTEGER NOT NULL DEFAULT 0, erros INTEGER NOT NULL DEFAULT 0, headers TEXT);
CREATE TABLE IF NOT EXISTS importacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, criado TEXT, tipo TEXT, arquivo TEXT, obraId TEXT, obra TEXT,
  de TEXT, ate TEXT, linhas INTEGER, total REAL, distribuido INTEGER);
CREATE TABLE IF NOT EXISTS pedido_itens (pedido TEXT PRIMARY KEY, itens TEXT NOT NULL, em TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS fin_registros (tipo TEXT NOT NULL, chave TEXT NOT NULL, data TEXT, json TEXT NOT NULL, PRIMARY KEY (tipo, chave));
CREATE TABLE IF NOT EXISTS fin_snapshot (tipo TEXT PRIMARY KEY, json TEXT NOT NULL, em TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS obra_insumos (obraId TEXT PRIMARY KEY, obra TEXT, json TEXT NOT NULL, em TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS i_fin_data ON fin_registros(tipo, data);
CREATE INDEX IF NOT EXISTS i_compras_data ON compras(data);
CREATE INDEX IF NOT EXISTS i_consumos_data ON consumos(data);
`);

// consumos importados de relatórios ficam marcados com origem 'rel:<id>'; os da API com 'api'
try { db.exec("ALTER TABLE consumos ADD COLUMN origem TEXT DEFAULT 'api'"); } catch { /* coluna já existe */ }
// requisições bulk-data têm cota diária própria
try { db.exec('ALTER TABLE api_uso ADD COLUMN bulk INTEGER NOT NULL DEFAULT 0'); } catch { /* coluna já existe */ }
// campos do pedido/item de compra do Sienge (compras gravadas antes disso ficam vazias até a próxima sincronização do período)
for (const col of [
  "obraId TEXT DEFAULT ''", "obra TEXT DEFAULT ''", 'item INTEGER DEFAULT 0', "codigo TEXT DEFAULT ''",
  "detalhe TEXT DEFAULT ''", "marca TEXT DEFAULT ''", 'precoUnitario REAL DEFAULT 0', "situacao TEXT DEFAULT ''",
  'autorizado INTEGER DEFAULT 1', 'atrasado INTEGER DEFAULT 0', "comprador TEXT DEFAULT ''", "condicaoPagamento TEXT DEFAULT ''",
]) {
  try { db.exec(`ALTER TABLE compras ADD COLUMN ${col}`); } catch { /* coluna já existe */ }
}

// cadastro de credores (cache: pode ser apagado e buscado de novo). Versão antiga tinha "uf", que o Sienge não manda.
const colsFornecedores = (db.prepare('PRAGMA table_info(fornecedores)').all() as { name: string }[]).map(c => c.name);
if (colsFornecedores.includes('uf')) db.exec('DROP TABLE fornecedores');
db.exec(`CREATE TABLE IF NOT EXISTS fornecedores (
  id TEXT PRIMARY KEY, nome TEXT, fantasia TEXT, cnpj TEXT, cidade TEXT, telefone TEXT, email TEXT, ativo INTEGER, em TEXT NOT NULL)`);

export function transacao(fn: () => void): void {
  db.exec('BEGIN');
  try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
}
