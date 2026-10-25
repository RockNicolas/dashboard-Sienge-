import { createBrowserRouter, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import GeralPage from './pages/GeralPage';
import UsoPage from './pages/UsoPage';
import MaterialPage from './pages/MaterialPage';
import FornecedoresPage from './pages/FornecedoresPage';
import ObrasPage from './pages/ObrasPage';
import AbcPage from './pages/AbcPage';
import PrecosPage from './pages/PrecosPage';
import HistoricoPage from './pages/HistoricoPage';
import ConfigPage from './pages/ConfigPage';
import ImportPage from './pages/ImportPage';
import ErroPage from './pages/ErroPage';

// Menu lateral/abas: uma rota por indicador
export const MENU = [
  { to: '/', label: 'Visão geral', icone: 'home', end: true },
  { to: '/comprado-consumido', label: 'Comprado × Consumido', icone: 'compare' },
  { to: '/material', label: 'Consumo de material', icone: 'box' },
  { to: '/fornecedores', label: 'Fornecedores', icone: 'truck' },
  { to: '/obras', label: 'Consumo por obra', icone: 'building' },
  { to: '/abc', label: 'Insumos que mais gastam', icone: 'chart' },
  { to: '/precos', label: 'Oportunidades de preço', icone: 'tag' },
  { to: '/historico', label: 'Histórico', icone: 'clock' },
  { to: '/importar', label: 'Importar relatórios', icone: 'upload' },
  { to: '/configuracoes', label: 'Configurações', icone: 'gear' },
];

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <ErroPage /> },
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErroPage />,
    children: [
      { index: true, element: <GeralPage /> },
      { path: 'comprado-consumido', element: <UsoPage /> },
      { path: 'material', element: <MaterialPage /> },
      { path: 'fornecedores', element: <FornecedoresPage /> },
      { path: 'obras', element: <ObrasPage /> },
      { path: 'abc', element: <AbcPage /> },
      { path: 'precos', element: <PrecosPage /> },
      { path: 'historico', element: <HistoricoPage /> },
      { path: 'importar', element: <ImportPage /> },
      { path: 'configuracoes', element: <ConfigPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
