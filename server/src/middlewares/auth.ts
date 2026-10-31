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

export const tratarErros = (err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction): void => {
  // erros de validação trazem status 4xx (ex.: parâmetro inválido); o resto é 500
  const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ erro: err.message });
};
