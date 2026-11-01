// O que puxar do Sienge (abre ao cadastrar o usuário de API): período, informações, obras e a cota que isso gasta.
import type { Request, Response } from 'express';
import { DadosModel } from '../models/DadosModel';
import { ConfigService } from '../services/config.service';
import { EstimativaService } from '../services/estimativa.service';
import { MockService } from '../services/mock.service';
import { explicarErro, listarObras } from '../services/sienge.service';
import { janelaSync, lerConfigSync, SyncConfigService } from '../services/sync-config.service';
import { SyncService } from '../services/sync.service';
import type { OpcoesSync } from '../types';

const txt = (v: unknown) => (v == null ? '' : String(v).trim());

export const SincronizacaoController = {
  /** GET /api/sincronizacao — escolha salva + obras que o usuário de API enxerga (1 requisição, guardada 30 min). */
  async opcoes(_req: Request, res: Response): Promise<void> {
    const config = SyncConfigService.obter();
    const responder = (o: Omit<OpcoesSync, 'config'>) => res.json({ config, ...o } satisfies OpcoesSync);
    if (ConfigService.mock()) return void responder({ obras: MockService.carregar().obras, aviso: null, mock: true });
    const cfg = ConfigService.efetiva();
    if (!ConfigService.completa(cfg))
      return void responder({ obras: DadosModel.obras(), aviso: 'Cadastre o usuário de API do Sienge para listar as obras.', mock: false });
    try {
      const obras = (await listarObras(cfg)).map(e => ({ id: txt(e.id), nome: txt(e.name ?? e.commercialName) || `Obra ${txt(e.id)}` }));
      obras.forEach(o => DadosModel.garantirObra(o)); // nomes ficam salvos para o filtro de obra e as telas
      responder({ obras, aviso: null, mock: false });
    } catch (e) {
      responder({ obras: DadosModel.obras(), aviso: `Não deu para listar as obras do Sienge: ${explicarErro((e as Error).message)}`, mock: false });
    }
  },

  /** POST /api/sincronizacao/estimar — quanto as escolhas gastam da cota (lista os pedidos do período no Sienge). */
  async estimar(req: Request, res: Response): Promise<void> {
    const escolha = lerConfigSync(req.body);
    try {
      res.json(await EstimativaService.estimar(escolha));
    } catch (e) {
      const err = e as Error & { status?: number };
      // erro do Sienge (credencial, cota do dia, fora do ar): 424 = depende de outro serviço; a mensagem vai para a tela
      throw err.status ? err : Object.assign(new Error(explicarErro(err.message)), { status: 424 });
    }
  },

  /** PUT /api/sincronizacao — salva a escolha; a próxima consulta já busca do Sienge desse jeito. */
  salvar(req: Request, res: Response): void {
    const c = lerConfigSync(req.body);
    SyncConfigService.salvar(c);
    SyncService.invalidar();
    res.json({ config: c, janela: janelaSync(c) });
  },
};
