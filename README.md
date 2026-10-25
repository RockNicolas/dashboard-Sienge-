# Painel Sienge — Compras e Consumo

Dashboard de compras, fornecedores e consumo de insumos por obra, alimentado pela API do Sienge.

**Stack:** Node + Express + TypeScript (API, MVC) · Vite + React + TypeScript + React Router (frontend) · SQLite (`node:sqlite`).

## Estrutura (MVC)

```
server/src
  routes/        rotas da API (/api/login, /api/dashboard, /api/historico …)
  controllers/   AuthController, DashboardController   (C)
  models/        db, UsuarioModel, DadosModel, SincronizacaoModel (M — SQLite)
  services/      sienge (API), mock, sync (Sienge→SQLite), analytics (cálculos), auth (sessão)
  middlewares/   requireAuth, tratamento de erros
  config/env.ts  variáveis do .env
  types.ts       tipos de domínio e contratos da API (usados também pelo web)
web/src
  routes.tsx     rotas do frontend (uma por indicador)
  pages/         Login, Geral, Uso (comprado×consumido), Material, Fornecedores, Obras, Abc, Precos, Historico  (V)
  components/    Layout (filtros + menu), ui (Card, Kpi, Tabela…)
  hooks/         useDashboard (estado/filtros/sessão — controller do front)
  api/client.ts  chamadas HTTP tipadas
```

## Rodar

```
npm install
copy .env.example .env      # preencha o login do painel (o Sienge é configurado na tela Configurações)
npm run dev                 # API :3000  +  Vite :5173  → abra http://localhost:5173
```

Produção: `npm run build` e `npm start` (a API serve `web/dist` em http://localhost:3000).
Sem credenciais do Sienge (ou com demonstração marcada) usa dados de demonstração.

## Indicadores

1. **Consumo de material** · 2. **Ranking de fornecedores** · 3. **Consumo por obra** · 4. **Insumos que mais gastam (Curva ABC)**
5. **Comprado × Consumido** — "comprei 100 cimentos, quantos foram p/ a obra X e Y?" (saldo e % usado)
6. Extras: oportunidades de preço (variação e economia potencial), histórico de sincronizações, impressão em PDF

## Segurança e testes

- O servidor escuta só em `127.0.0.1` (use `HOST=0.0.0.0` para abrir na rede). Há cabeçalhos de segurança (CSP, nosniff, X-Frame-Options)
  e o cookie de sessão ganha `Secure` em HTTPS. Atrás de proxy, defina `TRUST_PROXY=true`.
- Troque a senha inicial do `.env` antes de expor o painel.
- `npm test` roda os testes automatizados (análises, distribuição do consumo por mês); `npm run typecheck` confere os tipos.

## Login e histórico

- Usuário/senha em SQLite (`data/painel.db`, scrypt). Criado no 1º start a partir de `PAINEL_USUARIO`/`PAINEL_SENHA`;
  sem senha no `.env`, uma aleatória é impressa no console. Cookie HttpOnly (12h); 5 tentativas erradas bloqueiam o IP por 5 min.
  Para uso fora da sua máquina, coloque atrás de proxy com HTTPS.
- Cada sincronização grava compras/consumos no SQLite (o período é substituído, refletindo edições e cancelamentos);
  se o Sienge cair, usa o último dado salvo. Os itens de cada pedido (1 requisição por pedido) ficam guardados em `pedido_itens`:
  se a cota do dia acabar no meio, a sincronização grava o que conseguiu, mostra um aviso de "sincronização parcial" e continua
  de onde parou na próxima (uma reserva de 5% da cota, mínimo 5, fica livre para o "Testar conexão"). Em modo demonstração nada é gravado — apague `data/` ao passar para o real.
- Novo usuário: `npx tsx -e "import('./server/src/models/UsuarioModel.ts').then(m=>m.UsuarioModel.criar('fulano','senha'))"`

## Financeiro (contas a pagar, a receber, caixa e bancos)

Menu **Financeiro**: Financeiro geral, Contas a pagar, Contas a receber e Caixa e bancos. Todas as telas respeitam o filtro de
**período** e **obra** do topo e têm o seletor **Mensal / Semanal** (semana começa na segunda-feira).

- Fontes (`server/src/services/financeiro.service.ts`): `bulk-data/v1/outcome` (parcelas a pagar), `bulk-data/v1/income`
  (parcelas a receber), `bulk-data/v1/bank-movement` (movimentos), `/checking-accounts` e `/accounts-balances` (saldos).
- **Obra:** a pagar e movimentos usam a apropriação por obra do Sienge; a receber usa o centro de custo (o `/income` não traz obra).
  Com filtro de obra, cada lançamento entra proporcional ao rateio (ex.: título 60% obra A / 40% obra B). Saldo bancário não é por obra.
- **Cota:** sincroniza uma janela fixa (vencimentos de 12 meses atrás a 6 meses à frente), então mudar o filtro não gasta cota.
  Cada sincronização usa 3 requisições bulk-data; o intervalo se ajusta ao plano (Free, 10 bulk/dia: a cada ~7h). "↻ Sienge" força.
- A confirmar no seu tenant: `correctionIndexerId` do contas a pagar (usa 0 = sem correção), valores de `bankMovementOperationType`
  (D/S tratados como saída) e se o centro de custo do contas a receber corresponde à obra.

## Conexão com o Sienge e cota diária (tela Configurações)

- Subdomínio, usuário e senha da API são cadastrados **só no painel** (menu Configurações); o `.env` não tem dados do Sienge.
  A senha é gravada criptografada (AES-256-GCM) no SQLite, com chave local em `data/secret.key` (não perca nem compartilhe; a pasta `data/` está no .gitignore).
- Botão **Testar conexão** faz 1 chamada ao Sienge para validar as credenciais (mostra 401/403/404 de forma clara).
- Marcar **Usar dados de demonstração** volta ao modo demo sem apagar as credenciais.
- **Cota diária:** cada chamada ao Sienge é contada por dia (SQLite). O topo do painel mostra "API hoje X / limite" e a tela Configurações
  mostra usadas/restantes/erros e os últimos 14 dias. Selecione o **plano da API** contratado (Free, Start, Special… — tabela em
  `server/src/services/planos.ts`, conforme a documentação do Sienge); o limite diário vem do plano e, ao atingi-lo, o painel para de chamar
  o Sienge e usa os dados já salvos. O plano escolhido é conferido com o limite que o Sienge devolve no cabeçalho `x-ratelimit-limit-day`
  (aviso na tela e no "Testar conexão" se não bater).

## Importar relatórios em PDF (menu "Importar relatórios")

Além da API, o painel lê relatórios exportados do Sienge em PDF. Hoje: **Curva ABC de Apropriações** (consumo por insumo no período).

1. Envie o PDF (arrastar ou escolher). Nada é gravado ainda: aparece uma prévia com período, quantidade de insumos e o total.
   O painel compara a soma dos itens com o "Total geral" impresso no relatório e avisa se não bater.
2. Escolha a **obra** (esse relatório não informa a obra) e se o consumo deve ser **distribuído pelos meses** do período
   (proporcional aos dias — estimativa, pois o relatório não traz a data de cada apropriação) ou lançado no fim do período.
3. Confirme. Reimportar a mesma obra e período **substitui** a importação anterior; "Excluir" desfaz.

Os dados importados entram em "Consumo de material", "Consumo por obra" e demais telas de consumo. Sem credenciais do Sienge,
o painel passa a mostrar só os dados importados (o modo demonstração é desligado ao importar).
Atenção: se a API também trouxer o consumo do mesmo período, ele será somado ao importado — evite importar período já coberto pela API.
Novos tipos de relatório entram em `server/src/services/relatorio.service.ts`.

## Integração Sienge — validar

`server/src/services/sienge.service.ts` usa `/enterprises`, `/purchase-orders` (+ `/items`) e, para consumo,
`/stock-movements` (configurável na tela Configurações). Confira os nomes de campos no seu tenant e
ajuste só as funções `normalizar*`; o resto não muda.

## Próximos passos sugeridos

- Alertas: compra acima do preço médio, consumo acima do orçado (`/building-cost-estimations`)
- Orçado × realizado por obra; previsão de reposição por ritmo de consumo
