import express, { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { ConfigController } from '../controllers/ConfigController';
import { CustosObraController } from '../controllers/CustosObraController';
import { ImportacaoController } from '../controllers/ImportacaoController';
import { DashboardController } from '../controllers/DashboardController';
import { ExportarController } from '../controllers/ExportarController';
import { FinanceiroController } from '../controllers/FinanceiroController';
import { SincronizacaoController } from '../controllers/SincronizacaoController';
import { asyncHandler, requireAuth } from '../middlewares/auth';

export const routes = Router();

// públicas
routes.post('/login', AuthController.login);
routes.post('/logout', AuthController.logout);

// protegidas
routes.get('/me', requireAuth, AuthController.me);
routes.get('/dashboard', requireAuth, asyncHandler(DashboardController.dashboard));
routes.get('/historico', requireAuth, DashboardController.historico);
routes.get('/financeiro', requireAuth, asyncHandler(FinanceiroController.dashboard));
routes.get('/custos-obra', requireAuth, asyncHandler(CustosObraController.custos));
routes.get('/exportar/excel', requireAuth, asyncHandler(ExportarController.excel));
routes.get('/config', requireAuth, ConfigController.obter);
routes.put('/config', requireAuth, ConfigController.salvar);
routes.post('/config/testar', requireAuth, asyncHandler(ConfigController.testar));
routes.delete('/config/conexao', requireAuth, ConfigController.desconectar);
routes.get('/quota', requireAuth, ConfigController.quota);
routes.get('/sincronizacao', requireAuth, asyncHandler(SincronizacaoController.opcoes));
routes.post('/sincronizacao/estimar', requireAuth, asyncHandler(SincronizacaoController.estimar));
routes.put('/sincronizacao', requireAuth, SincronizacaoController.salvar);
routes.get('/importar', requireAuth, ImportacaoController.listar);
routes.post('/importar/preview', requireAuth, express.raw({ type: () => true, limit: '25mb' }), asyncHandler(ImportacaoController.preview));
routes.post('/importar/confirmar', requireAuth, ImportacaoController.confirmar);
routes.delete('/importar/:id', requireAuth, ImportacaoController.excluir);
