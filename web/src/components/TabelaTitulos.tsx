import { useState } from 'react';
import type { Titulo } from '@server/types';
import { brl, dataBR } from '../lib/format';
import { Situacao } from './financeiro';

const LIMITE = 100;
const pctBR = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

/** Títulos (a pagar ou a receber) como no cadastro de títulos do Sienge, com busca e apropriação por centro de custo. */
export function TabelaTitulos({ titulos, parceiro }: { titulos: Titulo[]; parceiro: 'Credor' | 'Cliente' }) {
  const [busca, setBusca] = useState('');
  const termo = busca.trim().toLowerCase();
  const filtrados = termo
    ? titulos.filter(t => [t.tituloId, t.parceiro, t.documentoTipo, t.documentoNome, t.numeroDocumento, t.observacao, t.unidade,
      ...t.apropriacoes.flatMap(a => [a.plano, a.centroCusto])].some(v => v.toLowerCase().includes(termo)))
    : titulos;

  return (
    <>
      <div className="busca">
        <input type="search" placeholder={`Buscar por título, ${parceiro.toLowerCase()}, documento, plano financeiro…`} value={busca} onChange={e => setBusca(e.target.value)} />
        <span className="muted">{filtrados.length > LIMITE ? `mostrando ${LIMITE} de ${filtrados.length}` : `${filtrados.length} títulos`}</span>
      </div>
      {filtrados.length ? (
        <div className="tabela-rolagem">
          <table className="titulos">
            <thead>
              <tr>
                <th>Título</th><th>Documento</th><th>{parceiro}</th><th>Emissão</th><th>Competência</th>
                <th>Valor total</th><th>Parcelas</th><th>Saldo</th><th>Próx. venc.</th><th>Situação</th><th>Apropriação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.slice(0, LIMITE).map(t => (
                <tr key={t.tituloId}>
                  <td><b>{t.tituloId}</b>{t.origem && <small className="muted bloco">{t.origem}</small>}</td>
                  <td>
                    <span title={t.documentoNome}>{t.documentoTipo}</span> {t.numeroDocumento}
                    {t.documentoNome && <small className="muted bloco">{t.documentoNome}</small>}
                  </td>
                  <td>
                    {t.parceiro}
                    {t.unidade && <small className="muted bloco">{t.unidade}</small>}
                    {t.observacao && <small className="muted bloco obs" title={t.observacao}>{t.observacao}</small>}
                  </td>
                  <td>{dataBR(t.emissao)}</td>
                  <td>{dataBR(t.competencia)}</td>
                  <td>{brl(t.valorTotal)}{t.desconto > 0 && <small className="muted bloco">desc. {brl(t.desconto)}</small>}</td>
                  <td>{t.parcelasQuitadas}/{t.parcelas}{t.condicao && <small className="muted bloco">{t.condicao}</small>}</td>
                  <td className={t.situacao === 'vencida' ? 'neg' : ''}>{brl(t.saldo)}</td>
                  <td>{t.proximoVencimento ? dataBR(t.proximoVencimento) : '—'}</td>
                  <td><Situacao s={t.situacao} />{!t.autorizado && <small className="muted bloco">não autorizado</small>}</td>
                  <td>
                    {t.apropriacoes.map((a, i) => (
                      <small key={i} className="bloco">
                        {a.centroCustoId && `${a.centroCustoId} – ${a.centroCusto}`} · {a.planoId} – {a.plano}{t.apropriacoes.length > 1 && ` (${pctBR(a.pct)})`}
                      </small>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="muted">Nenhum título.</p>}
    </>
  );
}
