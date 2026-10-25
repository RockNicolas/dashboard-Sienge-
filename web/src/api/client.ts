import type {
  Agrupamento, ConfigEntrada, ConfigPublica, DashboardResponse, FinanceiroResponse, ImportConfirmacao, ImportListagem, ImportPreview, ImportResultado,
  QuotaInfo, Sincronizacao, TesteConexao,
} from '@server/types';

export class NaoAutenticado extends Error {}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (r.status === 401 && !url.endsWith('/login')) throw new NaoAutenticado();
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.erro ?? r.statusText);
  return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

export interface FiltrosUI { from: string; to: string; obra: string }

export const api = {
  login: (usuario: string, senha: string) =>
    req<{ ok: true }>('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario, senha }),
    }),
  logout: () => req<{ ok: true }>('/api/logout', { method: 'POST' }),
  dashboard: (f: FiltrosUI, forcar = false) => {
    const q = new URLSearchParams();
    if (f.from) q.set('from', f.from);
    if (f.to) q.set('to', f.to);
    if (f.obra) q.set('obra', f.obra);
    if (forcar) q.set('forcar', '1');
    return req<DashboardResponse>('/api/dashboard?' + q);
  },
  historico: () => req<Sincronizacao[]>('/api/historico'),
  financeiro: (f: FiltrosUI, agrupar: Agrupamento, forcar = false) => {
    const q = new URLSearchParams({ agrupar });
    if (f.from) q.set('from', f.from);
    if (f.to) q.set('to', f.to);
    if (f.obra) q.set('obra', f.obra);
    if (forcar) q.set('forcar', '1');
    return req<FinanceiroResponse>('/api/financeiro?' + q);
  },
  config: () => req<ConfigPublica>('/api/config'),
  salvarConfig: (c: ConfigEntrada) => req<ConfigPublica>('/api/config', json('PUT', c)),
  testarConfig: (c: ConfigEntrada) => req<TesteConexao>('/api/config/testar', json('POST', c)),
  desconectarSienge: () => req<ConfigPublica>('/api/config/conexao', { method: 'DELETE' }),
  quota: () => req<QuotaInfo>('/api/quota'),
  importacoes: () => req<ImportListagem>('/api/importar'),
  importarPreview: (arq: File) =>
    req<ImportPreview>('/api/importar/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-Arquivo': encodeURIComponent(arq.name) }, body: arq,
    }),
  importarConfirmar: (c: ImportConfirmacao) => req<ImportResultado>('/api/importar/confirmar', json('POST', c)),
  importarExcluir: (id: number) => req<{ ok: true }>(`/api/importar/${id}`, { method: 'DELETE' }),
};
