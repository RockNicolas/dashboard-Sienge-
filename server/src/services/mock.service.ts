// Dados de demonstração (USE_MOCK=true), no mesmo formato que o Sienge devolve.
import type { Compra, Consumo, Dados, Obra } from '../types';

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

const OBRAS: Obra[] = [
  { id: '1', nome: 'Residencial Aurora' },
  { id: '2', nome: 'Edifício Horizonte' },
  { id: '3', nome: 'Condomínio Vila Verde' },
  { id: '4', nome: 'Centro Comercial Plaza' },
];

const INSUMOS = [
  { id: '101', nome: 'Cimento CP-II 50kg', un: 'sc', preco: 36 },
  { id: '102', nome: 'Areia média', un: 'm³', preco: 120 },
  { id: '103', nome: 'Brita 1', un: 'm³', preco: 135 },
  { id: '104', nome: 'Aço CA-50 10mm', un: 'kg', preco: 8.4 },
  { id: '105', nome: 'Bloco cerâmico 14x19x29', un: 'un', preco: 2.1 },
  { id: '106', nome: 'Argamassa AC-II', un: 'sc', preco: 28 },
  { id: '107', nome: 'Porcelanato 60x60', un: 'm²', preco: 74 },
  { id: '108', nome: 'Tubo PVC 100mm', un: 'br', preco: 62 },
  { id: '109', nome: 'Fio flexível 2,5mm', un: 'rl', preco: 285 },
  { id: '110', nome: 'Tinta acrílica 18L', un: 'lt', preco: 340 },
  { id: '111', nome: 'Madeira p/ forma', un: 'm²', preco: 55 },
  { id: '112', nome: 'Impermeabilizante', un: 'lt', preco: 190 },
];

const FORNECEDORES = [
  { id: '1', nome: 'Depósito Central Materiais', fator: 1.0, prazo: 4 },
  { id: '2', nome: 'Votorantim Cimentos', fator: 0.97, prazo: 6 },
  { id: '3', nome: 'Gerdau Aços', fator: 1.02, prazo: 9 },
  { id: '4', nome: 'Cerâmica Santa Rita', fator: 0.95, prazo: 5 },
  { id: '5', nome: 'Casa do Construtor', fator: 1.08, prazo: 2 },
  { id: '6', nome: 'Tigre Tubos e Conexões', fator: 1.0, prazo: 7 },
  { id: '7', nome: 'Eletro Obras', fator: 1.05, prazo: 3 },
  { id: '8', nome: 'Madeireira Pinheiro', fator: 0.98, prazo: 5 },
];

let cache: Dados | null = null;

export const MockService = {
  carregar(): Dados {
    if (cache) return cache;
    const r = rng(42);
    const compras: Compra[] = [];
    const consumos: Consumo[] = [];
    const hoje = new Date();
    let pedido = 1000;

    for (let m = 11; m >= 0; m--) {
      const base = new Date(hoje.getFullYear(), hoje.getMonth() - m, 1);
      for (const ins of INSUMOS) {
        const nCompras = 1 + Math.floor(r() * 2);
        for (let c = 0; c < nCompras; c++) {
          const f = FORNECEDORES[Math.floor(r() * FORNECEDORES.length)];
          const qtd = Math.round((40 + r() * 260) * (ins.preco > 200 ? 0.2 : ins.preco > 60 ? 0.6 : 1.5));
          const preco = +(ins.preco * f.fator * (0.92 + r() * 0.16)).toFixed(2);
          const d = 1 + Math.floor(r() * 26);
          const data = new Date(base.getFullYear(), base.getMonth(), d);
          compras.push({
            pedido: String(++pedido),
            data: data.toISOString().slice(0, 10),
            fornecedorId: f.id, fornecedor: f.nome,
            insumoId: ins.id, insumo: ins.nome, un: ins.un,
            qtd, preco, valor: +(qtd * preco).toFixed(2),
            prazoEntrega: Math.max(1, Math.round(f.prazo + (r() - 0.5) * 4)),
          });
          // consumo derivado: 55–95% do comprado, repartido entre as obras
          const usado = qtd * (0.55 + r() * 0.4);
          const pesos = OBRAS.map(() => r() ** 1.5);
          const soma = pesos.reduce((a, b) => a + b, 0);
          OBRAS.forEach((o, i) => {
            const q = +(usado * pesos[i] / soma).toFixed(2);
            if (q <= 0.5) return;
            const dc = new Date(base.getFullYear(), base.getMonth(), Math.min(28, d + 2 + Math.floor(r() * 10)));
            consumos.push({
              data: dc.toISOString().slice(0, 10),
              obraId: o.id, obra: o.nome,
              insumoId: ins.id, insumo: ins.nome, un: ins.un,
              qtd: q, valor: +(q * preco).toFixed(2),
            });
          });
        }
      }
    }
    return (cache = { compras, consumos, obras: OBRAS });
  },
};
