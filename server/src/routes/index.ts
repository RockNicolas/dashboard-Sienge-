import express, { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { ConfigController } from '../controllers/ConfigController';
import { ImportacaoController } from '../controllers/ImportacaoController';
import { DashboardController } from '../controllers/DashboardController';
import { asyncHandler, requireAuth } from '../middlewares/auth';

export const routes = Router();

// públicas
routes.post('/login', AuthController.login);
routes.post('/logout', AuthController.logout);

// protegidas
routes.get('/me', requireAuth, AuthController.me);
routes.get('/dashboard', requireAuth, asyncHandler(DashboardController.dashboard));
routes.get('/historico', requireAuth, DashboardController.historico);
routes.get('/config', requireAuth, ConfigController.obter);
routes.put('/config', requireAuth, ConfigController.salvar);
routes.post('/config/testar', requireAuth, asyncHandler(ConfigController.testar));
routes.get('/quota', requireAuth, ConfigController.quota);
routes.get('/importar', requireAuth, ImportacaoController.listar);
routes.post('/importar/preview', requireAuth, express.raw({ type: () => true, limit: '25mb' }), asyncHandler(ImportacaoController.preview));
routes.post('/importar/confirmar', requireAuth, ImportacaoController.confirmar);
routes.delete('/importar/:id', requireAuth, ImportacaoController.excluir);
