import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import { ROOT } from './config/env';
import { tratarErros } from './middlewares/auth';
import { routes } from './routes';

export const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use('/api', routes);

// Em produção serve o frontend compilado (npm run build); em dev o Vite cuida disso.
const dist = path.join(ROOT, 'web', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(tratarErros);
