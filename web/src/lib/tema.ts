import { Chart } from 'chart.js';
import { COR, PALETA } from './format';

export type Tema = 'auto' | 'light' | 'dark';

// Paleta de categorias (ordem fixa, passos próprios para claro/escuro): começa no cinza e evita as cores de status
const CLARO = ['#4f46e5', '#0891b2', '#9333ea', '#0284c7', '#c026d3', '#6366f1', '#7c3aed', '#0e7490'];
const ESCURO = ['#818cf8', '#22d3ee', '#c084fc', '#38bdf8', '#e879f9', '#a5b4fc', '#a78bfa', '#67e8f9'];
// cores com significado nos gráficos (mesmas dos selos dos cards)
const COR_CLARO = { principal: '#4f46e5', secundaria: '#9333ea', terciaria: '#0284c7', referencia: '#c7d2fe', neutro: '#64748b', neutroMedio: '#94a3b8', neutroClaro: '#cbd5e1', bom: '#16a34a', melhorar: '#eab308', atencao: '#ea580c', ruim: '#dc2626' };
const COR_ESCURO = { principal: '#818cf8', secundaria: '#c084fc', terciaria: '#38bdf8', referencia: '#3730a3', neutro: '#94a3b8', neutroMedio: '#64748b', neutroClaro: '#475569', bom: '#3ecf9a', melhorar: '#facc15', atencao: '#fb923c', ruim: '#ff7b76' };

export function lerTema(): Tema {
  try {
    const t = localStorage.getItem('tema');
    if (t === 'light' || t === 'dark') return t;
  } catch { /* sem storage */ }
  return 'auto';
}

export const escuro = (t: Tema) => t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);

/** Aplica o tema no DOM, na paleta e nos defaults do Chart.js. */
export function aplicarTema(t: Tema): void {
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  try { localStorage.setItem('tema', t); } catch { /* sem storage */ }

  const dark = escuro(t);
  PALETA.splice(0, PALETA.length, ...(dark ? ESCURO : CLARO));
  Object.assign(COR, dark ? COR_ESCURO : COR_CLARO);

  const css = getComputedStyle(root);
  const txt = css.getPropertyValue('--muted').trim();
  const grade = css.getPropertyValue('--line').trim();
  const d = Chart.defaults;
  d.font.family = 'Inter, system-ui, Segoe UI, sans-serif';
  ajustarFonte();
  d.color = txt;
  d.borderColor = grade;
  d.elements.bar.borderRadius = 4;
  d.elements.bar.borderSkipped = false;
  d.elements.line.borderWidth = 2;
  d.elements.point.radius = 0;
  d.elements.point.hoverRadius = 4;
  d.elements.arc.borderColor = css.getPropertyValue('--surface').trim();
  d.elements.arc.borderWidth = 2;
  d.plugins.legend.position = 'top';
  d.plugins.legend.align = 'end';
  d.plugins.legend.labels.usePointStyle = true;
  d.plugins.legend.labels.boxWidth = 8;
  d.plugins.tooltip.padding = 10;
  d.plugins.tooltip.cornerRadius = 8;
  d.interaction.mode = 'index';
  d.interaction.intersect = false;
}

/** Fonte dos gráficos acompanha o tamanho-base fluido da página. */
export function ajustarFonte(): void {
  Chart.defaults.font.size = Math.round(parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.78);
}
