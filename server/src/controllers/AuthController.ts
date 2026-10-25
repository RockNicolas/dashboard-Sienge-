import type { Request, Response } from 'express';
import { env } from '../config/env';
import { UsuarioModel } from '../models/UsuarioModel';
import { AuthService } from '../services/auth.service';

const COOKIE = 'HttpOnly; SameSite=Strict; Path=/';

export const AuthController = {
  login(req: Request, res: Response): void {
    const ip = req.socket.remoteAddress ?? '?';
    if (AuthService.bloqueado(ip)) {
      res.status(429).json({ erro: 'Muitas tentativas. Aguarde alguns minutos.' });
      return;
    }
    const { usuario, senha } = req.body ?? {};
    if (!UsuarioModel.conferir(usuario, senha)) {
      AuthService.registrarFalha(ip);
      res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
      return;
    }
    AuthService.limparFalhas(ip);
    const sid = AuthService.criarSessao(String(usuario));
    res.setHeader('Set-Cookie', `sid=${sid}; ${COOKIE}; Max-Age=${env.sessaoMs / 1000}`);
    res.json({ ok: true });
  },

  logout(req: Request, res: Response): void {
    AuthService.encerrar(req.cookies?.sid);
    res.setHeader('Set-Cookie', `sid=; ${COOKIE}; Max-Age=0`);
    res.json({ ok: true });
  },

  me(req: Request, res: Response): void {
    res.json({ usuario: req.usuario });
  },
};
