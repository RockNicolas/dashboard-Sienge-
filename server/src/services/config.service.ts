// Configuração do Sienge editável pelo painel. Valores salvos no SQLite têm prioridade sobre o .env;
// a senha é gravada criptografada (AES-256-GCM) com uma chave local em data/secret.key.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { env, ROOT } from '../config/env';
import { ConfigModel } from '../models/ConfigModel';
import { DadosModel } from '../models/DadosModel';
import type { ConfigEntrada, ConfigPublica } from '../types';

const KEY_FILE = path.join(ROOT, 'data', 'secret.key');

function chave(): Buffer {
  if (!fs.existsSync(KEY_FILE)) fs.writeFileSync(KEY_FILE, crypto.randomBytes(32), { mode: 0o600 });
  return fs.readFileSync(KEY_FILE);
}

function cifrar(txt: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chave(), iv);
  const enc = Buffer.concat([c.update(txt, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join(':');
}

function decifrar(s: string): string {
  try {
    const [iv, tag, enc] = s.split(':').map(p => Buffer.from(p, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', chave(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export interface SiengeCfg {
  usarMock: boolean;
  subdominio: string;
  usuario: string;
  senha: string;
  endpointConsumo: string;
  limiteDiario: number;
  baseUrl: string;
}

const base = (sub: string) => process.env.SIENGE_BASE_URL ?? `https://api.sienge.com.br/${sub}/public/api/v1`;

export const ConfigService = {
  /** Configuração efetiva (painel > .env), com a senha em claro — só para uso interno do servidor. */
  efetiva(): SiengeCfg {
    const subdominio = ConfigModel.obter('subdominio') ?? env.sienge.subdominio ?? '';
    const senhaSalva = ConfigModel.obter('senha');
    const mockSalvo = ConfigModel.obter('usarMock');
    return {
      usarMock: mockSalvo != null ? mockSalvo === '1' : process.env.USE_MOCK === 'true',
      subdominio,
      usuario: ConfigModel.obter('usuario') ?? env.sienge.usuario ?? '',
      senha: senhaSalva != null ? decifrar(senhaSalva) : env.sienge.senha ?? '',
      endpointConsumo: ConfigModel.obter('endpointConsumo') ?? env.sienge.endpointConsumo,
      limiteDiario: Number(ConfigModel.obter('limiteDiario') ?? process.env.SIENGE_LIMITE_DIARIO ?? 0) || 0,
      baseUrl: base(subdominio),
    };
  },

  completa(c: SiengeCfg = ConfigService.efetiva()): boolean {
    return !!(c.subdominio && c.usuario && c.senha);
  },

  /** true = o painel está mostrando dados de demonstração. */
  mock(): boolean {
    const c = ConfigService.efetiva();
    // sem credenciais: demonstração, a não ser que já existam dados locais (ex.: relatórios importados)
    return c.usarMock || (!ConfigService.completa(c) && !DadosModel.temDados());
  },

  publica(): ConfigPublica {
    const c = ConfigService.efetiva();
    return {
      usarMock: c.usarMock, mockEfetivo: ConfigService.mock(), subdominio: c.subdominio, usuario: c.usuario,
      senhaDefinida: !!c.senha, endpointConsumo: c.endpointConsumo, limiteDiario: c.limiteDiario,
    };
  },

  salvar(e: ConfigEntrada): void {
    if (typeof e.usarMock === 'boolean') ConfigModel.definir('usarMock', e.usarMock ? '1' : '0');
    if (typeof e.subdominio === 'string') ConfigModel.definir('subdominio', e.subdominio.trim().toLowerCase());
    if (typeof e.usuario === 'string') ConfigModel.definir('usuario', e.usuario.trim());
    if (typeof e.senha === 'string' && e.senha) ConfigModel.definir('senha', cifrar(e.senha));
    if (typeof e.endpointConsumo === 'string' && e.endpointConsumo.trim())
      ConfigModel.definir('endpointConsumo', e.endpointConsumo.trim().startsWith('/') ? e.endpointConsumo.trim() : `/${e.endpointConsumo.trim()}`);
    if (e.limiteDiario != null) ConfigModel.definir('limiteDiario', String(Math.max(0, Math.floor(Number(e.limiteDiario)) || 0)));
  },

  /** Aplica campos do formulário sobre a configuração salva, sem gravar (usado no "Testar conexão"). */
  simular(e: ConfigEntrada): SiengeCfg {
    const c = ConfigService.efetiva();
    const sub = (e.subdominio ?? c.subdominio).trim().toLowerCase();
    return {
      ...c,
      subdominio: sub,
      usuario: (e.usuario ?? c.usuario).trim(),
      senha: e.senha ? e.senha : c.senha,
      baseUrl: base(sub),
    };
  },
};
