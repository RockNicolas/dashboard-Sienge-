import { Chart } from 'chart.js';
import { PALETA } from './format';

export type Tema = 'auto' | 'light' | 'dark';

// Paleta categórica validada (ordem fixa, passos próprios para claro/escuro)
const CLARO = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const ESCURO = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

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
