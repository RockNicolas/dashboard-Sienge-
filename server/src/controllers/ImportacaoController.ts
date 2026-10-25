import type { Request, Response } from 'express';
import { ImportacaoService } from '../services/importacao.service';
import type { ImportConfirmacao } from '../types';

export const ImportacaoController = {
  listar(_req: Request, res: Response): void {
    res.json(ImportacaoService.listar());
  },

  /** Recebe o PDF cru no corpo da requisição (Content-Type: application/pdf), nome em X-Arquivo. */
  async preview(req: Request, res: Response): Promise<void> {
    const buf = req.body as Buffer;
    if (!Buffer.isBuffer(buf) || buf.length < 100 || buf.subarray(0, 4).toString() !== '%PDF') {
      res.status(400).json({ erro: 'Envie um arquivo PDF do Sienge.' });
      return;
    }
    const nome = decodeURIComponent(String(req.headers['x-arquivo'] ?? 'relatorio.pdf'));
    try {
      res.json(await ImportacaoService.preview(buf, nome));
    } catch (e) {
      res.status(422).json({ erro: (e as Error).message });
    }
  },

  confirmar(req: Request, res: Response): void {
    const b = (req.body ?? {}) as Partial<ImportConfirmacao>;
    try {
      res.json(ImportacaoService.confirmar({
        token: String(b.token ?? ''), obraId: b.obraId, obraNova: b.obraNova, distribuir: b.distribuir !== false,
      }));
    } catch (e) {
      res.status(422).json({ erro: (e as Error).message });
    }
  },

  excluir(req: Request, res: Response): void {
    try {
      ImportacaoService.excluir(Number(req.params.id));
      res.json({ ok: true });
    } catch (e) {
      res.status(404).json({ erro: (e as Error).message });
    }
  },
};
