import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// carrega .env da raiz do projeto
try {
  for (const l of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* sem .env */ }

const e = process.env;

export const env = {
  port: Number(e.PORT) || 3000,
  // por padrão só a própria máquina acessa; use HOST=0.0.0.0 para abrir na rede (de preferência atrás de HTTPS)
  host: e.HOST || '127.0.0.1',
  confiarProxy: e.TRUST_PROXY === 'true',
  cacheMs: (Number(e.CACHE_MINUTOS) || 15) * 60 * 1000,
  sessaoMs: 12 * 60 * 60 * 1000,
  painelUsuario: e.PAINEL_USUARIO || 'admin',
  painelSenha: e.PAINEL_SENHA,
  sienge: {
    subdominio: e.SIENGE_SUBDOMINIO,
    usuario: e.SIENGE_USUARIO,
    senha: e.SIENGE_SENHA,
    baseUrl: e.SIENGE_BASE_URL || `https://api.sienge.com.br/${e.SIENGE_SUBDOMINIO}/public/api/v1`,
    endpointConsumo: e.SIENGE_ENDPOINT_CONSUMO || '/stock-movements',
  },
};
