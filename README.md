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
copy .env.example .env      # preencha as credenciais do Sienge e do painel
npm run dev                 # API :3000  +  Vite :5173  → abra http://localhost:5173
```

Produção: `npm run build` e `npm start` (a API serve `web/dist` em http://localhost:3000).
Sem credenciais do Sienge (ou com demonstração marcada) usa dados de demonstração.

## Indicadores

1. **Consumo de material** · 2. **Ranking de fornecedores** · 3. **Consumo por obra** · 4. **Insumos que mais gastam (Curva ABC)**
5. **Comprado × Consumido** — "comprei 100 cimentos, quantos foram p/ a obra X e Y?" (saldo e % usado)
6. Extras: oportunidades de preço (variação e economia potencial), histórico de sincronizações, impressão em PDF

## Login e histórico

- Usuário/senha em SQLite (`data/painel.db`, scrypt). Criado no 1º start a partir de `PAINEL_USUARIO`/`PAINEL_SENHA`;
  sem senha no `.env`, uma aleatória é impressa no console. Cookie HttpOnly (12h); 5 tentativas erradas bloqueiam o IP por 5 min.
  Para uso fora da sua máquina, coloque atrás de proxy com HTTPS.
- Cada sincronização grava compras/consumos no SQLite (o período é substituído, refletindo edições e cancelamentos);
  se o Sienge cair, usa o último dado salvo. Em modo demonstração nada é gravado — apague `data/` ao passar para o real.
- Novo usuário: `npx tsx -e "import('./server/src/models/UsuarioModel.ts').then(m=>m.UsuarioModel.criar('fulano','senha'))"`

## Conexão com o Sienge e cota diária (tela Configurações)

- Subdomínio, usuário e senha da API são cadastrados **no painel** (menu Configurações), sem editar o `.env`.
  A senha é gravada criptografada (AES-256-GCM) no SQLite, com chave local em `data/secret.key` (não perca nem compartilhe; a pasta `data/` está no .gitignore).
  Os valores do painel têm prioridade sobre o `.env`, que continua valendo como padrão inicial.
- Botão **Testar conexão** faz 1 chamada ao Sienge para validar as credenciais (mostra 401/403/404 de forma clara).
- Marcar **Usar dados de demonstração** volta ao modo demo sem apagar as credenciais.
- **Cota diária:** cada chamada ao Sienge é contada por dia (SQLite). O topo do painel mostra "API hoje X / limite" e a tela Configurações
  mostra usadas/restantes/erros e os últimos 14 dias. Defina o **limite diário** do seu contrato; ao atingi-lo o painel para de chamar o Sienge
  e usa os dados já salvos. Se a API devolver cabeçalhos de rate limit, eles aparecem na tela.

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
`/stock-movements` (configurável em `SIENGE_ENDPOINT_CONSUMO`). Confira os nomes de campos no seu tenant e
ajuste só as funções `normalizar*`; o resto não muda.

## Próximos passos sugeridos

- Alertas: compra acima do preço médio, consumo acima do orçado (`/building-cost-estimations`)
- Orçado × realizado por obra; previsão de reposição por ritmo de consumo
