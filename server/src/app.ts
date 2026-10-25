import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import { env, ROOT } from './config/env';
import { tratarErros } from './middlewares/auth';
import { routes } from './routes';

export const app = express();

app.disable('x-powered-by');
if (env.confiarProxy) app.set('trust proxy', 1);
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'");
  next();
});
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use('/api', routes);
app.use('/api', (_req, res) => { res.status(404).json({ erro: 'Rota não encontrada' }); });

// Em produção serve o frontend compilado (npm run build); em dev o Vite cuida disso.
const dist = path.join(ROOT, 'web', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(tratarErros);
