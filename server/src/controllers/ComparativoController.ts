import type { Request, Response } from 'express';
import { DadosModel } from '../models/DadosModel';
import { FinanceiroModel } from '../models/FinanceiroModel';
import { SincronizacaoModel } from '../models/SincronizacaoModel';
import { ComparativoService, type Cobertura } from '../services/comparativo.service';
import { ConfigService } from '../services/config.service';
import { janelaFinanceira } from '../services/financeiro.service';
import { MockService } from '../services/mock.service';
import type { ComparativoResponse, GrupoComparativo } from '../types';

const diaLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const param = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const GRUPOS: GrupoComparativo[] = ['semana', 'mes', 'ano'];

/** Até onde vão os dados salvos (compras e financeiro). Na demonstração: o que o gerador cria. */
export function cobertura(): Cobertura {
  if (ConfigService.mock()) {
    const h = new Date();
    const vencs = MockService.financeiro().pagar.map(p => p.vencimento).sort();
    return {
      compras: { de: diaLocal(new Date(h.getFullYear(), h.getMonth() - 23, 1)), ate: diaLocal(h) },
      financeiro: vencs.length ? { de: vencs[0], ate: vencs[vencs.length - 1] } : null,
    };
  }
  const fin = FinanceiroModel.ultima();
  const j = fin ? janelaFinanceira(new Date(fin)) : null;
  return { compras: SincronizacaoModel.cobertura(), financeiro: j ? { de: j.vencDe, ate: j.vencAte } : null };
}

export const ComparativoController = {
  /**
   * GET /api/comparativos?agrupar=semana|mes|ano&ref=AAAA-MM-DD&obra=
   * Só lê o que já está salvo: comparar períodos antigos não gasta cota do Sienge.
   */
  comparativo(req: Request, res: Response): void {
    const hoje = diaLocal();
    const agrupar = GRUPOS.find(g => g === req.query.agrupar) ?? 'mes';
    const ref = param(req.query.ref)?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ?? hoje;
    // o suficiente para a série (12 meses/semanas ou 5 anos) e o mesmo período do ano anterior
    const de = `${Number(ref.slice(0, 4)) - (agrupar === 'ano' ? 5 : 2)}-01-01`;
    const mock = ConfigService.mock();
    const dados = mock ? MockService.carregar() : DadosModel.ler(de, hoje);
    const fin = mock ? MockService.financeiro() : FinanceiroModel.ler(de, hoje, DadosModel.obras());

    const body: ComparativoResponse = {
      mock,
      ...ComparativoService.calcular(dados, fin, { agrupar, ref, hoje, obraId: param(req.query.obra), cobertura: cobertura() }),
    };
    res.json(body);
  },
};
