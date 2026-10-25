// Configuração do Sienge editável pelo painel (tela Configurações), salva no SQLite — não vem do .env;
// a senha é gravada criptografada (AES-256-GCM) com uma chave local em data/secret.key.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../config/env';
import { ConfigModel } from '../models/ConfigModel';
import { DadosModel } from '../models/DadosModel';
import { PedidoItensModel } from '../models/PedidoItensModel';
import { UsoApiModel } from '../models/UsoApiModel';
import { PLANOS, planoPorId, planoPorLimite } from './planos';
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
  plano: string;           // id do plano contratado ('' = não informado)
  limiteDiario: number;    // requisições REST/dia do plano (0 = sem plano)
  baseUrl: string;
}

// instalações antigas guardavam o número do limite; converte para o plano equivalente
const planoSalvo = () =>
  ConfigModel.obter('plano') ?? planoPorLimite(Number(ConfigModel.obter('limiteDiario')))?.id ?? '';

const base = (sub: string) => process.env.SIENGE_BASE_URL ?? `https://api.sienge.com.br/${sub}/public/api/v1`;

export const ConfigService = {
  /** Configuração efetiva salva no painel, com a senha em claro — só para uso interno do servidor. */
  efetiva(): SiengeCfg {
    const subdominio = ConfigModel.obter('subdominio') ?? '';
    const senhaSalva = ConfigModel.obter('senha');
    const plano = planoPorId(planoSalvo());
    return {
      usarMock: ConfigModel.obter('usarMock') === '1',
      subdominio,
      usuario: ConfigModel.obter('usuario') ?? '',
      senha: senhaSalva != null ? decifrar(senhaSalva) : '',
      endpointConsumo: ConfigModel.obter('endpointConsumo') ?? '/stock-movements',
      plano: plano?.id ?? '',
      limiteDiario: plano?.rest ?? 0,
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
      senhaDefinida: !!c.senha, endpointConsumo: c.endpointConsumo, plano: c.plano, planos: PLANOS,
    };
  },

  salvar(e: ConfigEntrada): void {
    if (typeof e.usarMock === 'boolean') ConfigModel.definir('usarMock', e.usarMock ? '1' : '0');
    if (typeof e.subdominio === 'string') ConfigModel.definir('subdominio', e.subdominio.trim().toLowerCase());
    if (typeof e.usuario === 'string') ConfigModel.definir('usuario', e.usuario.trim());
    if (typeof e.senha === 'string' && e.senha) ConfigModel.definir('senha', cifrar(e.senha));
    if (typeof e.endpointConsumo === 'string' && e.endpointConsumo.trim())
      ConfigModel.definir('endpointConsumo', e.endpointConsumo.trim().startsWith('/') ? e.endpointConsumo.trim() : `/${e.endpointConsumo.trim()}`);
    if (typeof e.plano === 'string' && (e.plano === '' || planoPorId(e.plano))) ConfigModel.definir('plano', e.plano);
  },

  /**
   * Esquece o usuário de API: credenciais, plano, contagem de cota/cabeçalhos e itens de pedido em cache.
   * Compras e consumos já sincronizados continuam salvos.
   */
  desconectar(): void {
    ConfigModel.remover('subdominio', 'usuario', 'senha', 'plano', 'limiteDiario');
    UsoApiModel.limpar();
    PedidoItensModel.limpar();
  },

  /** Aplica campos do formulário sobre a configuração salva, sem gravar (usado no "Testar conexão"). */
  simular(e: ConfigEntrada): SiengeCfg {
    const c = ConfigService.efetiva();
    const sub = (e.subdominio ?? c.subdominio).trim().toLowerCase();
    const plano = e.plano != null ? planoPorId(e.plano) : planoPorId(c.plano);
    return {
      ...c,
      plano: plano?.id ?? '',
      limiteDiario: plano?.rest ?? 0,
      subdominio: sub,
      usuario: (e.usuario ?? c.usuario).trim(),
      senha: e.senha ? e.senha : c.senha,
      baseUrl: base(sub),
    };
  },
};
