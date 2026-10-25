// Sessões em memória (cookie HttpOnly) e limite de tentativas de login por IP.
import crypto from 'node:crypto';
import { env } from '../config/env';

const sessoes = new Map<string, { usuario: string; exp: number }>();
const falhas = new Map<string, { n: number; ate: number }>();
const MAX_FALHAS = 5;
const BLOQUEIO_MS = 5 * 60 * 1000;

export const AuthService = {
  criarSessao(usuario: string): string {
    const sid = crypto.randomBytes(32).toString('hex');
    sessoes.set(sid, { usuario, exp: Date.now() + env.sessaoMs });
    return sid;
  },

  sessao(sid?: string): { usuario: string } | null {
    const s = sid ? sessoes.get(sid) : undefined;
    return s && s.exp > Date.now() ? s : null;
  },

  encerrar(sid?: string): void {
    if (sid) sessoes.delete(sid);
  },

  bloqueado(ip: string): boolean {
    const f = falhas.get(ip);
    return !!f && f.n >= MAX_FALHAS && f.ate > Date.now();
  },

  registrarFalha(ip: string): void {
    const f = falhas.get(ip);
    falhas.set(ip, { n: (f && f.ate > Date.now() ? f.n : 0) + 1, ate: Date.now() + BLOQUEIO_MS });
  },

  limparFalhas(ip: string): void {
    falhas.delete(ip);
  },
};
