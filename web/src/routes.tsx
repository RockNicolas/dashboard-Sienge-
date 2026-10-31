import { createBrowserRouter, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import GeralPage from './pages/GeralPage';
import ComprasPage from './pages/ComprasPage';
import FornecedoresPage from './pages/FornecedoresPage';
import CustosObraPage from './pages/CustosObraPage';
import ResultadoObraPage from './pages/ResultadoObraPage';
import ConfigPage from './pages/ConfigPage';
import ErroPage from './pages/ErroPage';
// Telas ocultas por enquanto (foco em Visão geral + Suprimentos). Para voltar com uma delas,
// descomente o import, o item do MENU e a rota correspondente.
// import UsoPage from './pages/UsoPage';
// import MaterialPage from './pages/MaterialPage';
// import ObrasPage from './pages/ObrasPage';
// import AbcPage from './pages/AbcPage';
// import PrecosPage from './pages/PrecosPage';
// import HistoricoPage from './pages/HistoricoPage';
// import ImportPage from './pages/ImportPage';
// import FinanceiroPage from './pages/FinanceiroPage';
// import ContasPagarPage from './pages/ContasPagarPage';
// import ContasReceberPage from './pages/ContasReceberPage';
// import CaixaPage from './pages/CaixaPage';

// Menu lateral: uma rota por tela; `secao` abre um grupo no menu.
// Configurações fica no rodapé do menu (não é um módulo).
export const MENU: { to: string; label: string; icone: string; end?: boolean; secao?: string }[] = [
  { to: '/', label: 'Visão geral', icone: 'home', end: true },
  { to: '/compras', label: 'Histórico de compras', icone: 'clock', secao: 'Suprimentos' },
  { to: '/fornecedores', label: 'Fornecedores', icone: 'truck' },
  { to: '/custos-obra', label: 'Custos por obra', icone: 'building' },
  { to: '/resultado-obra', label: 'Resultado da obra', icone: 'chart' },
  // { to: '/comprado-consumido', label: 'Comprado × Consumido', icone: 'compare', secao: 'Compras e consumo' },
  // { to: '/material', label: 'Consumo de material', icone: 'box' },
  // { to: '/obras', label: 'Consumo por obra', icone: 'building' },
  // { to: '/abc', label: 'Insumos que mais gastam', icone: 'chart' },
  // { to: '/precos', label: 'Oportunidades de preço', icone: 'tag' },
  // { to: '/financeiro', label: 'Financeiro geral', icone: 'money', secao: 'Financeiro' },
  // { to: '/contas-pagar', label: 'Contas a pagar', icone: 'out' },
  // { to: '/contas-receber', label: 'Contas a receber', icone: 'in' },
  // { to: '/caixa', label: 'Caixa e bancos', icone: 'bank' },
  // { to: '/historico', label: 'Histórico', icone: 'clock', secao: 'Sistema' },
  // { to: '/importar', label: 'Importar relatórios', icone: 'upload' },
];

/** Títulos das telas que não estão no menu lateral. */
export const OUTRAS_TELAS: Record<string, string> = { '/configuracoes': 'Configurações' };

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <ErroPage /> },
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErroPage />,
    children: [
      { index: true, element: <GeralPage /> },
      { path: 'compras', element: <ComprasPage /> },
      { path: 'fornecedores', element: <FornecedoresPage /> },
      { path: 'custos-obra', element: <CustosObraPage /> },
      { path: 'resultado-obra', element: <ResultadoObraPage /> },
      { path: 'configuracoes', element: <ConfigPage /> },
      // { path: 'comprado-consumido', element: <UsoPage /> },
      // { path: 'material', element: <MaterialPage /> },
      // { path: 'obras', element: <ObrasPage /> },
      // { path: 'abc', element: <AbcPage /> },
      // { path: 'precos', element: <PrecosPage /> },
      // { path: 'financeiro', element: <FinanceiroPage /> },
      // { path: 'contas-pagar', element: <ContasPagarPage /> },
      // { path: 'contas-receber', element: <ContasReceberPage /> },
      // { path: 'caixa', element: <CaixaPage /> },
      // { path: 'historico', element: <HistoricoPage /> },
      // { path: 'importar', element: <ImportPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
