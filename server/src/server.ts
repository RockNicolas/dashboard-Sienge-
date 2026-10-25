import crypto from 'node:crypto';
import { env } from './config/env';
import { ConfigService } from './services/config.service';
import { UsuarioModel } from './models/UsuarioModel';
import { app } from './app';

// usuário inicial do painel
if (!UsuarioModel.total()) {
  const senha = env.painelSenha ?? crypto.randomBytes(9).toString('base64url');
  UsuarioModel.criar(env.painelUsuario, senha);
  console.log(`Usuário criado: ${env.painelUsuario}` + (env.painelSenha ? '' : `  senha: ${senha}  (anote — não será exibida de novo)`));
}

app.listen(env.port, () =>
  console.log(`API em http://localhost:${env.port}  (${ConfigService.mock() ? 'DADOS DE DEMONSTRAÇÃO' : 'Sienge real'})`));
