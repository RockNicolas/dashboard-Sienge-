import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import { router } from './routes';
import { ajustarFonte, aplicarTema, lerTema } from './lib/tema';
import './styles.css';

Chart.register(...registerables);
aplicarTema(lerTema());
window.addEventListener('resize', ajustarFonte);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
