import crypto from 'node:crypto';
import { db } from './db';

const hashSenha = (senha: string, salt = crypto.randomBytes(16).toString('hex')) =>
  `${salt}:${crypto.scryptSync(senha, salt, 64).toString('hex')}`;

export const UsuarioModel = {
  criar(usuario: string, senha: string): void {
    db.prepare('INSERT OR REPLACE INTO usuarios VALUES (?,?,?)').run(usuario, hashSenha(senha), new Date().toISOString());
  },

  conferir(usuario: unknown, senha: unknown): boolean {
    const u = db.prepare('SELECT hash FROM usuarios WHERE usuario = ?').get(String(usuario)) as { hash: string } | undefined;
    const [salt, h] = (u?.hash ?? 'x:x').split(':');
    const calc = crypto.scryptSync(String(senha), salt, 64);
    const esperado = Buffer.from(h, 'hex');
    return !!u && esperado.length === calc.length && crypto.timingSafeEqual(esperado, calc);
  },

  total(): number {
    return (db.prepare('SELECT COUNT(*) n FROM usuarios').get() as { n: number }).n;
  },
};
