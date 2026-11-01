# Painel Sienge — Suprimentos

Dashboard de suprimentos (histórico de compras, fornecedores, custos e resultado por obra), alimentado pela API do Sienge.

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

## Menu (foco atual: Visão geral + Suprimentos)

- **Visão geral** — total comprado, pedidos, ticket médio, fornecedores, materiais, obras atendidas; compras por mês e tops.
- **Suprimentos**
  1. **Histórico de compras** — cada item de pedido de compra com os campos do Sienge (pedido, item, situação, autorizado,
     entrega em atraso, obra, fornecedor, nº do insumo, código auxiliar/detalhe/marca do insumo, quantidade, preço unitário,
     preço líquido, valor, comprador, condição de pagamento) e, por material, último preço, menor/médio/maior e preço médio de
     cada mês. O **nº do insumo** (`resourceId` do pedido; `id` nos Insumos da Obra) aparece antes do nome do material em todas
     as telas, na busca, no PDF e no Excel (coluna "Cód. insumo"); o `resourceCode` é o "código auxiliar".
  2. **Fornecedores** — identificação pelo cadastro de credores (nome, fantasia, CNPJ/CPF, cidade, telefone, e-mail) e ranking
     por valor ou nº de pedidos, com curva ABC, ticket médio, obras atendidas e pedidos com entrega em atraso.
  3. **Custos por obra** — material comprado por obra (pedidos) e, dos Insumos da Obra, orçado × pendente (pedidos e contratos
     em aberto) × atendido (NFs de compra e medições) por tipo de insumo, por serviço (item do orçamento/EDT) e por insumo.
  4. **Resultado da obra** — receitas (contas a receber) − despesas (contas a pagar) por obra, margem, recebido × pago e despesas
     por plano financeiro.
- **Configurações** fica no rodapé do menu.
- **Detalhe em modal:** clique em um material (Histórico de compras), fornecedor (Fornecedores) ou obra (Custos por obra) — ou
  nos tops da Visão geral — para abrir o detalhe numa modal que ocupa quase a tela toda (no celular, tela cheia). O item
  aberto fica no endereço (`?material=`, `?fornecedor=`, `?obra=`): Voltar, Esc, botão Fechar ou clique fora fecham, F5 mantém
  aberto e dá para mandar o link. O rodapé da modal mantém as setas da barra de rolagem longe do canto arredondado.
  - Material: indicadores de preço, preço pago em cada compra, preço por fornecedor (do mais barato ao mais caro) e as compras.
  - Fornecedor: cadastro de credores, situação dos pedidos, obras atendidas, compras por mês, materiais com preço × média
    geral e as compras.
  - Obra: orçado × pendente × atendido, por tipo de insumo (com composição do custo realizado), por serviço e por insumo.
- **Layout sem buracos:** cartões lado a lado (`.cols`) ficam da mesma altura e o gráfico cresce até ocupar o cartão; quando
  não cabem lado a lado, cada um ocupa a linha inteira. Os KPIs escolhem as colunas pela quantidade (6 → 6, 3+3 ou 2+2+2;
  5 → 5, 3+2 ou 2+2+1), sem deixar um sozinho na última linha.
- **Filtros (topo):** **Período** com atalhos (Últimos 12 meses, Este mês, Mês passado, Este ano) e a **obra** aplicam na hora
  em todas as telas; datas digitadas (De/Até, "Personalizado") são aplicadas no botão **Aplicar**. Cada período novo é uma
  consulta ao Sienge (pedidos com data do pedido no intervalo). Os filtros continuam depois do F5, e o PDF traz período e obra
  no cabeçalho.
- **Exportar** (botão no topo): escolhe o formato, os filtros da exportação (período, obra — começam iguais aos da tela) e as
  seções (Visão geral, Histórico de compras, Fornecedores, Custos por obra, Resultado da obra):
  - **PDF** — gerado no navegador (`web/src/lib/relatorio-pdf.ts`, jsPDF carregado só ao exportar): A4 deitado, cabeçalho e
    rodapé com período/obra e "Página X de Y", uma seção por página com indicadores, gráficos e tabelas.
  - **Excel** — gerado no servidor (`GET /api/exportar/excel`, `server/src/services/exportacao.service.ts`): uma aba por seção,
    cada uma como Tabela do Excel (filtro em todas as colunas, cabeçalho congelado, R$/%/datas formatados). A lista completa de
    itens de pedido vai no Excel (o PDF mostra os 300 mais recentes).
  - **Excel com dashboard** — as mesmas abas + aba **Dashboard** com indicadores e **gráficos nativos do Excel** (colunas, barras,
    pizza) ligados à aba "Dados dos gráficos": mudou o dado, o gráfico acompanha. O ExcelJS não cria gráficos, então eles são
    escritos em DrawingML e injetados no arquivo (`server/src/services/excel-graficos.ts`). O Dashboard imprime numa página.
- **Telas menores:** no celular o menu vira o botão ☰; as tabelas se ajustam ao espaço do cartão (container queries em
  `styles.css`) — em cartão estreito cada linha vira um cartão, e as colunas marcadas como secundárias (`sec` / `col-sec`)
  somem quando falta espaço.

As demais telas (comprado × consumido, consumo, curva ABC, preços, financeiro, histórico de sincronizações, importar relatórios)
estão **comentadas** em `web/src/routes.tsx`: para voltar com uma, descomente o import, o item do `MENU` e a rota.

## Segurança e testes

- O servidor escuta só em `127.0.0.1` (use `HOST=0.0.0.0` para abrir na rede). Há cabeçalhos de segurança (CSP, nosniff, X-Frame-Options)
  e o cookie de sessão ganha `Secure` em HTTPS. Atrás de proxy, defina `TRUST_PROXY=true`.
- Troque a senha inicial do `.env` antes de expor o painel.
- `DATA_DIR` (opcional) muda a pasta do banco e da chave (`data/` por padrão) — útil para rodar outra instância de teste
  sem mexer nos dados (junto com `PORT` e, para um Sienge de teste, `SIENGE_BASE_URL`).
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
- **O que puxar do Sienge:** ao salvar o usuário de API (1º cadastro ou troca de usuário/senha) abre uma modal em 2 passos:
  1. **Obras** — as obras que o usuário de API enxerga no Sienge (`/enterprises`, 1 requisição). Marque uma, várias ou todas:
     só as escolhidas vêm do Sienge.
  2. **Período e informações** — período (Este mês, Mês passado, Últimos 3/6/12 meses, Desde o começo do ano ou datas
     personalizadas; os atalhos andam com o calendário), o que vem (compras — sempre; cadastro dos fornecedores; Insumos da
     Obra; financeiro) e a **cota estimada**: requisições REST e bulk da 1ª carga, item a item, comparadas com o plano e com o que
     resta hoje, e em quantos dias a 1ª carga termina se não couber hoje. Para estimar, o painel lista os pedidos do período das
     obras escolhidas (obra a obra pelo filtro `buildingId` quando sai mais barato); a sincronização logo depois reaproveita essa
     lista por 30 min, sem gastar de novo.
  A escolha fica no card "O que puxar do Sienge" (dá para alterar). Com ela, o Sienge só é consultado no período e nas obras
  escolhidos: o período do topo começa em **Período sincronizado**, o filtro de obra mostra só as escolhidas, e mudar o filtro de
  período só lê o que já veio (fora do período escolhido aparece um aviso). Sem escolha, o painel segue o filtro de cada tela, como
  antes. "Desconectar" apaga a escolha junto com as credenciais.

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

## Integração Sienge — suprimentos

Campos conforme as especificações oficiais (`https://api.sienge.com.br/docs/yaml-files/<nome>.yaml`); se algo vier diferente no
seu tenant, ajuste só as funções `normalizar*`.

| Dado | Endpoint (spec) | Custo na cota |
|---|---|---|
| Obras | `/enterprises` (enterprise-v1) | REST, paginado |
| Pedidos de compra | `/purchase-orders` (purchase-orders-v1) | REST, paginado |
| Itens do pedido | `/purchase-orders/{id}/items` | REST, 1 por pedido (guardado; só pedidos novos) |
| Fornecedor (nome, CNPJ, contato) | `/creditors` ou `/creditors/{id}` (creditor-v1) | REST, uma vez por credor (guardado) |
| Custos por obra | `bulk-data/v1/building/resources` (bulk-data-building-resource-v1) | BULK, 1 por obra a cada 12h |
| Resultado da obra | `bulk-data/v1/outcome` e `/income` (financeiro) | BULK, 3 por sincronização |

- O pedido de compra **não traz o nome do fornecedor** nem o **total do item**: o nome vem de `/creditors` e o valor é
  quantidade × preço líquido (`netPrice`; sem ele, `unitPrice`). Pedidos **cancelados** e **reprovados** ficam de fora.
- Credores: a 1ª página de `/creditors` diz quantos existem; se a lista inteira custar menos que buscar um a um, baixa a lista.
  Usa no máximo metade do que sobra da cota REST, para os itens dos pedidos também andarem.
- Insumos da Obra: com obras escolhidas em "O que puxar do Sienge", busca essas obras; sem escolha, as obras com mais compras
  no período (até 12); com filtro de obra no topo, a obra do filtro.
  A cota **bulk-data** é dividida: metade para o financeiro, o resto para os Insumos da Obra (no plano Free, o financeiro passa
  a sincronizar a cada ~14h).
- Consumo: o endpoint padrão `/stock-movements` **não existe** na API pública do Sienge; como as telas de consumo estão ocultas,
  essa chamada está desligada em `sienge.service.ts` (não gasta cota).

## Próximos passos sugeridos

- Alertas: compra acima do preço médio, consumo acima do orçado (`/building-cost-estimations`)
- Orçado × realizado por obra; previsão de reposição por ritmo de consumo
