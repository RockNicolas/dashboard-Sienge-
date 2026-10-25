import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AuthService } from '../services/auth.service';

declare module 'express-serve-static-core' {
  interface Request { usuario?: string }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const s = AuthService.sessao(req.cookies?.sid);
  if (!s) { res.status(401).json({ erro: 'Não autenticado' }); return; }
  req.usuario = s.usuario;
  next();
};

/** Repassa erros de handlers async para o middleware de erro do Express. */
export const asyncHandler = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next: NextFunction) => { fn(req, res).catch(next); };

export const tratarErros = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error(err);
  res.status(500).json({ erro: err.message });
};
