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
import FinanceiroPage from './pages/FinanceiroPage';
import ContasPagarPage from './pages/ContasPagarPage';
import ContasReceberPage from './pages/ContasReceberPage';
import CaixaPage from './pages/CaixaPage';

// Menu lateral/abas: uma rota por indicador; `secao` abre um grupo no menu
export const MENU: { to: string; label: string; icone: string; end?: boolean; secao?: string }[] = [
  { to: '/', label: 'Visão geral', icone: 'home', end: true, secao: 'Compras e consumo' },
  { to: '/comprado-consumido', label: 'Comprado × Consumido', icone: 'compare' },
  { to: '/material', label: 'Consumo de material', icone: 'box' },
  { to: '/fornecedores', label: 'Fornecedores', icone: 'truck' },
  { to: '/obras', label: 'Consumo por obra', icone: 'building' },
  { to: '/abc', label: 'Insumos que mais gastam', icone: 'chart' },
  { to: '/precos', label: 'Oportunidades de preço', icone: 'tag' },
  { to: '/financeiro', label: 'Financeiro geral', icone: 'money', secao: 'Financeiro' },
  { to: '/contas-pagar', label: 'Contas a pagar', icone: 'out' },
  { to: '/contas-receber', label: 'Contas a receber', icone: 'in' },
  { to: '/caixa', label: 'Caixa e bancos', icone: 'bank' },
  { to: '/historico', label: 'Histórico', icone: 'clock', secao: 'Sistema' },
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
      { path: 'financeiro', element: <FinanceiroPage /> },
      { path: 'contas-pagar', element: <ContasPagarPage /> },
      { path: 'contas-receber', element: <ContasReceberPage /> },
      { path: 'caixa', element: <CaixaPage /> },
      { path: 'historico', element: <HistoricoPage /> },
      { path: 'importar', element: <ImportPage /> },
      { path: 'configuracoes', element: <ConfigPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
