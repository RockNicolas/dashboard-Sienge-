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
CREATE INDEX IF NOT EXISTS i_compras_data ON compras(data);
CREATE INDEX IF NOT EXISTS i_consumos_data ON consumos(data);
`);

// consumos importados de relatórios ficam marcados com origem 'rel:<id>'; os da API com 'api'
try { db.exec("ALTER TABLE consumos ADD COLUMN origem TEXT DEFAULT 'api'"); } catch { /* coluna já existe */ }

export function transacao(fn: () => void): void {
  db.exec('BEGIN');
  try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
}
