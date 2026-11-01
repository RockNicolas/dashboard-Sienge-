import type { MouseEvent } from 'react';

/**
 * O clique foi mesmo fora da caixa do <dialog>, no fundo escuro? Cliques que caem nos cantos arredondados
 * ou na borda da própria caixa também chegam com target = dialog. Esses não contam, para a modal não
 * fechar sem querer (ex.: ao clicar na seta da barra de rolagem perto do canto).
 */
export function cliqueFora(e: MouseEvent<HTMLDialogElement>): boolean {
  const d = e.currentTarget;
  if (e.target !== d) return false;
  const r = d.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}
