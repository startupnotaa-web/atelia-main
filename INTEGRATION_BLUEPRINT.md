# INTEGRATION_BLUEPRINT.md
## Auditoria Holística e Plano de Unificação do Ecossistema AtelIA

> Documento gerado por auditoria estática de código (leitura completa, sem alterações em arquivos de produção). Complementa o `ATELIA_CONTEXT_V2.md` — e, em alguns pontos, **corrige** informações desatualizadas nele contidas (ver §2.2).
>
> Metodologia: varredura de `src/app`, `src/components`, `src/lib` e `src/app/api`; inventário de toda chamada `collection(db, 'X')` / `db.collection('X')` / `doc(db, 'X', ...)` no repositório; leitura completa dos arquivos que escrevem/leem cada coleção identificada, com citação de arquivo:linha para cada afirmação factual abaixo.

---

## 1. Mapeamento do Ecossistema

### 1.1 Módulos identificados (rota → coleções tocadas)

| Módulo | Rota / Componente | Coleções Firestore | Observação |
|---|---|---|---|
| Calculadora de Precificação | `/calculadora` | `catalogo`, `estoque`, `equipamentos`, `pedidos`, `transactions` | Motor de cálculo centralizado em `src/lib/pricingEngine.ts` |
| Equipamentos (depreciação) | `/equipamentos` | `equipamentos` | Alimenta o custo/hora usado pela Calculadora |
| Venda de Balcão (PDV) | `/venda-balcao` | `estoque_pronto`, `pedidos` | Já grava custo/lucro no pedido (refatorado recentemente) |
| Pronta-Entrega | `/pronta-entrega` | `estoque_pronto`, `catalogo` | Ponte entre Catálogo e PDV |
| Estoque de Insumos | `/estoque` (via `StockGrid.tsx`) | `estoque`, `finance_entries` | CRUD de matéria-prima; gera despesa automática ao cadastrar |
| Pedidos | `/pedidos` | `pedidos`, `estoque`, `estoque_pronto` | Kanban de produção; único módulo que decrementa estoque com os 3 nomes de campo simultaneamente |
| Orçamentos | `/orcamentos` (via `GerarOrcamento.tsx`) | *nenhuma* (somente leitura de `catalogo`/`clientes`) | **Não persiste nada** — gera PDF/WhatsApp e descarta |
| Consignações | `/consignacoes`, `/consignacoes/[id]` | `partnerStores`, `partnerProducts`, `estoque_pronto`, `finance_entries` | Não escreve em `pedidos`; "lucro" é receita menos comissão, sem custo de produção |
| Clientes / Pontos de Venda | `/clientes` (via `ClientsPDV.tsx`) | `clientes`, `lojas` (via `actions/clientes.ts`) | Aba "Pontos de Venda" é um segundo sistema de lojas parceiras, paralelo ao de Consignações |
| Meus Produtos | `/meus-produtos` | `catalogo` | Mostra preço e custo lado a lado |
| Vitrine Pública | `/vitrine/[loja]` | `catalogo` (leitura), `perfis` | Somente contato via WhatsApp — não gera `pedido` |
| Dashboard | `/dashboard` (via `actions/dashboard.ts`) | `pedidos`, `transactions`, `finance_entries`, `settings`, `estoque`, `estoque_pronto`, `users`, `catalogo` | Fonte "oficial" de métricas agregadas |
| Evolução (CFO Virtual) | `/evolucao` | `finance_entries`, `pedidos`, `estoque` | **Consulta o Firestore diretamente**, não usa `actions/dashboard.ts` |
| Perfil / Minha Marca | `/perfil`, `MinhaMarca.tsx` | `users`, `perfis` | `perfis` é o doc público (vitrine); `users` é o doc privado |
| Webhook WhatsApp | `/api/whatsapp-webhook` | `users`, `finance_entries` | Escreve em schema incompatível com o resto do sistema (§2.1) |
| Webhook Stripe | `/api/stripe/webhook` | `users` | Único ponto de escrita de `planType` |
| Webhook Fenix3D | `/api/webhooks/fenix3d` | `pedidos`, `transactions`, `estoque` | Integração de impressão 3D; decrementa estoque com nome de campo que a Dashboard não lê |
| Admin | `/api/admin/*` | `users`, `partnerStores`, `partnerProducts` (migração/contagem) | Fora do escopo de negócio direto |

### 1.2 Componentes órfãos (confirmados por grep, zero importadores)

- **`src/components/PricingWizard.tsx`** — versão antiga da Calculadora. Grava corretamente em `catalogo` (mesma função `addCatalogItem`), mas **não é importado em lugar nenhum do app**. Código morto funcional.
- **`src/components/SlideoverNovoPedido.tsx`** — formulário de novo pedido com prop `onConfirmar` que nunca recebe implementação em nenhum lugar do código atual. Órfão.

---

## 2. Gargalos de Integração (confirmados com arquivo:linha)

### 2.1 🔴 CRÍTICO — Vendas/despesas via WhatsApp somem da Dashboard

A "Conselheira AtelIA" (feature de IA via WhatsApp) escreve em `finance_entries` assim:

```ts
// src/app/api/whatsapp-webhook/route.ts:96-101 e 108-113
await db.collection('finance_entries').add({
  userId, amount: Number(jsonResponse.amount), type: 'income', // ou 'expense'
  description: 'Venda registrada via WhatsApp', createdAt: new Date(),
});
```

Mas **todo o resto do sistema** (`src/app/actions/finance.ts:13`, `StockGrid.tsx`, `consignacoes/[id]/page.tsx`, e o próprio leitor em `src/app/actions/dashboard.ts:70-83`) usa o schema:

```ts
{ userId, value: number, type: 'entrada' | 'saida', date, category, createdAt }
```

Como `dashboard.ts` só verifica `data.type === 'entrada'`/`'saida'` e lê `data.value` (nunca `data.amount`/`'income'`/`'expense'`), **todo lançamento feito por voz/texto no WhatsApp é gravado no banco e nunca aparece em nenhuma tela** (Dashboard, Evolução, relatórios). É uma perda de dado silenciosa na funcionalidade mais visível do produto (IA).

O `ATELIA_CONTEXT_V2.md` (linhas 65-70) documenta o schema `{amount, type:'income'|'expense'}` como se fosse o oficial — na prática é o schema **minoritário e não lido**, usado por um único writer. O documento de referência está desatualizado/invertido em relação ao código real.

### 2.2 🔴 CRÍTICO — Estoque de insumos com 4 nomes de campo divergentes

| Escritor | Campo(s) gravado(s) | Lido por `StockGrid` (a UI de Estoque)? |
|---|---|---|
| `StockGrid.tsx:113,160` (CRUD real de estoque) | `quantidadeTotal` + `currentStock` (sincronizados) | ✅ (é o próprio dono) |
| `src/app/calculadora/page.tsx:498-501` (baixa ao "Transformar em Pedido") | **apenas** `quantidade` | ❌ nunca lido pelo StockGrid |
| `src/app/actions/erp.ts` `updateProductionStatus` | `quantity` | ❌ |
| `src/app/api/webhooks/fenix3d/route.ts` | `quantidade` | ❌ |
| `src/app/pedidos/page.tsx:313-317` (baixa por encomenda) | os três: `quantidadeTotal`, `quantidade`, `quantity` (defensivo) | ✅ (por sorte, escreve em todos) |

E o cálculo de estoque crítico da Dashboard (`src/app/actions/dashboard.ts:251`) usa:

```ts
const stock = data.currentStock ?? data.quantidadeTotal ?? data.quantity ?? data.purchasedQuantity ?? 0;
```

**`quantidade` não está nessa cadeia de fallback.** Resultado: toda venda registrada pela Calculadora ou pelo webhook Fenix3D decrementa um campo que (a) a tela de Estoque nunca exibe e (b) o alerta de estoque crítico da Dashboard nunca enxerga. O saldo real de matéria-prima diverge do que a artesã vê, sem nenhum aviso.

### 2.3 🟠 ALTO — `pedidos` com dois formatos de status incompatíveis

```ts
// pedidos/page.tsx — dono do Kanban, agrupa por statusProducao
statusProducao: d.statusProducao || d.productionStatus || 'fila'   // linha 129
```
```ts
// calculadora/page.tsx:474 — grava um campo diferente
status: statusPedido === 'queue' ? 'pendente' : ... : 'concluido'
```

Como o Kanban de `/pedidos` agrupa exclusivamente por `statusProducao`, **todo pedido criado pela Calculadora ("Transformar em Pedido") cai sempre em "Fila de Espera"**, independentemente do status real escolhido no modal de venda. O módulo Venda de Balcão (refatorado nesta mesma base) já usa `statusProducao`/`statusPagamento` corretamente — a Calculadora ficou para trás.

### 2.4 🟠 ALTO — Duas coleções para o mesmo conceito de "loja parceira"

- `src/app/consignacoes/page.tsx:36,81` → coleção **`partnerStores`**, campos `{name, manager, phone, commissionPercent, userId}`.
- `src/app/actions/clientes.ts:125,151` (`fetchPointsOfSale`, usado pela aba "Pontos de Venda" de `ClientsPDV.tsx`) → coleção **`lojas`**, mesmo conceito, mesmo campo `commissionPercent`.

Dois times/momentos diferentes construíram o mesmo cadastro em coleções separadas que nunca se enxergam. Sintoma visível: o botão "Ver Estoque na Loja" em `ClientsPDV.tsx:60` é um `alert('Em breve...')` — a integração nunca foi fechada porque os dados de estoque consignado vivem em `partnerProducts`, não em `lojas`.

### 2.5 🟡 MÉDIO — Lucro de consignação é receita-menos-comissão, não lucro real

`consignacoes/[id]/page.tsx` `handleRegisterSale` calcula:

```ts
comissao = totalVenda * commissionPercent / 100;
lucroLiquido = totalVenda - comissao;   // grava isso em finance_entries.value
```

Não há nenhuma subtração de `custoUnitario`/`custoBase` (o custo de produção vindo da Calculadora). O valor gravado como "lucro" na verdade é faturamento líquido de comissão — infla os números reais de lucro sempre que há vendas em consignação. Some a isso que a consignação **não grava em `pedidos`**, então essa receita nunca entra em `faturamentoBruto`/`lucroLiquido` da Dashboard (que somam apenas `pedidosSnap`) — ela só aparece em `recebido`/`saldoCaixa` via `finance_entries`. Ou seja: consignação usa uma definição de lucro diferente da usada pelo resto do sistema, e essa definição nem chega aos KPIs principais.

### 2.6 🟡 MÉDIO — `users.plan` vs `users.planType`

- `src/app/api/stripe/webhook/route.ts` grava **`planType`** ao fazer upgrade/downgrade.
- `src/lib/TenantProvider.tsx:75` lê `data.planType`, com fallback para `data.plan` — correto/defensivo.
- `src/app/actions/dashboard.ts:48` lê **apenas** `userDoc.data()?.plan` — sem fallback para `planType`.

Consequência: o campo `plan` retornado pela Dashboard pode mostrar `'free'` para uma usuária que acabou de virar Pro via Stripe, mesmo que `TenantProvider`/`isPro` (usado para liberar telas) já a trate corretamente como Pro em outras partes do app.

### 2.7 🟡 MÉDIO — Orçamentos são descartáveis, sem elo com Pedido

`GerarOrcamento.tsx` não tem nenhuma chamada de escrita no Firestore — o orçamento vira PDF (`html2canvas`+`jsPDF`) ou mensagem de WhatsApp e é esquecido. Não existe coleção `orcamentos`. Isso significa que não há como uma artesã "aprovar" um orçamento e convertê-lo automaticamente em pedido/venda — ela tem que redigitar tudo manualmente na Calculadora ou em Pedidos, perdendo o vínculo de custo já calculado.

### 2.8 🟡 MÉDIO — `evolucao/page.tsx` duplica a agregação da Dashboard

`/evolucao` consulta `finance_entries`, `pedidos` e `estoque` diretamente via client SDK (`loadFinancialData`, linhas 45-52), em vez de reusar `src/app/actions/dashboard.ts`. Isso significa que qualquer correção feita nos gargalos acima (ex.: 2.1, 2.2) precisa ser replicada manualmente aqui, e os dois painéis já podem mostrar números diferentes hoje, pois um lê `estoque_pronto`/`catalogo`/`transactions`/`settings` e o outro não.

### 2.9 🟢 BAIXO / Segurança — `firestore.rules` totalmente aberto

```
match /{document=**} {
  allow read, write: if true;
}
```

Confirmado verbatim no arquivo atual. Qualquer cliente (autenticado ou não) pode ler/escrever os dados financeiros de qualquer usuária. Já era um "Aviso Crítico" no `ATELIA_CONTEXT_V2.md` e continua sem correção. Coloco como item de segurança separado dos gargalos de dados porque **bloqueia** a Fase 2+ deste blueprint: não faz sentido migrar schemas sem, ao mesmo tempo, restringir quem pode escrevê-los.

### 2.10 🟢 Positivo — o que já está integrado corretamente

Vale registrar o que **funciona** hoje, para não perder de vista no meio da lista de bugs:

- **Depreciação por hora-máquina → Lucro Líquido**: o custo/hora calculado em `/equipamentos` entra em `custoBaseTotal` na Calculadora, que vira `catalogo.custoBase`, que vira `estoque_pronto.custoUnitario` (via `/pronta-entrega`), que vira `pedido.custo`/`pedido.lucro` na Venda de Balcão — chegando corretamente ao `lucroLiquido` da Dashboard. Essa cadeia foi fechada nesta mesma base de código e é o modelo a replicar para os outros módulos.
- **Vitrine pública**: corretamente não expõe `custoBase`/`custoUnitario` ao cliente final — a exclusão de custo aqui é proposital e está certa.
- **Webhook Stripe**: escopo limpo, toca apenas `users`, idempotente via `set({merge:true})`.

---

## 3. Blueprint de Unificação — Fases de Execução

> Ordem pensada para minimizar risco: tipos antes de migração de dados, migração de dados antes de fluxo transacional único, e tudo isso depois de fechar a superfície de segurança.

### Fase 0 — Segurança (bloqueadora, deve vir antes de qualquer migração)
- Reescrever `firestore.rules` para exigir `request.auth.uid == resource.data.userId` (leitura e escrita) em todas as coleções listadas em §1.1, com regra especial de leitura pública apenas para o subconjunto de `catalogo` usado pela Vitrine (`visivelNaVitrine == true`) e para `perfis`.
- Sem isso, qualquer schema novo criado nas fases seguintes continua tão exposto quanto o atual.

### Fase 1 — Unificação de Tipos TypeScript (sem migrar dado nenhum)
- Expandir `src/lib/erpTypes.ts` (já criado nesta base) para ser a **única fonte de verdade** de tipos para: `FinanceEntry`, `Pedido`, `EstoqueItem`, `EstoqueProntoItem` (já existe), `CatalogoItem`, `PontoDeVenda`.
- Cada tipo documenta o **campo canônico** e, via comentário, os aliases legados ainda aceitos na leitura (ex.: `EstoqueItem.currentStock` com nota "legado: `quantidadeTotal`, `quantity`, `quantidade`").
- Nenhum arquivo de produção muda de comportamento nesta fase — é só o contrato escrito. Isso já destrava revisão de código: qualquer PR que desviar do tipo é pego no `tsc`.

### Fase 2 — Consolidação de Schemas (migração incremental, coleção por coleção)
Cada item abaixo é independente e pode ser feito em PRs separados:

1. **`finance_entries`** — adotar `{userId, value, type:'entrada'|'saida', date, category, description, createdAt}` como canônico (é o que 3 dos 4 escritores já usam). Corrigir `src/app/api/whatsapp-webhook/route.ts` (troca de 2 linhas: `amount`→`value`, `'income'/'expense'`→`'entrada'/'saida'`). Rodar script único de backfill nos documentos antigos gravados com o schema errado.
2. **`estoque`** — adotar `currentStock` como campo canônico de saldo. Corrigir a baixa de estoque em `calculadora/page.tsx` para escrever `currentStock` (hoje escreve só `quantidade`). Enquanto a migração não terminar, adicionar `quantidade`/`quantity` à cadeia de fallback do cálculo de `estoqueCritico` em `dashboard.ts` como rede de segurança temporária.
3. **`pedidos`** — adotar `statusProducao`/`statusPagamento` (usado por `pedidos/page.tsx` e pelo PDV já refatorado) como canônico. Corrigir `calculadora/page.tsx` para parar de gravar `status` e passar a gravar `statusProducao`/`statusPagamento`, alinhando com o Kanban.
4. **`lojas` + `partnerStores`/`partnerProducts`** — decidir uma coleção única para "ponto de venda parceiro" (recomendo manter `partnerStores`/`partnerProducts`, por já ter o cadastro de produtos consignados acoplado) e migrar `actions/clientes.ts.fetchPointsOfSale` para ler dessa mesma coleção. Isso desbloqueia o botão "Ver Estoque na Loja" hoje stub em `ClientsPDV.tsx`.
5. **`users.plan`/`planType`** — padronizar em `planType` (já é o que o Stripe grava) e corrigir a leitura em `dashboard.ts:48` para usar o mesmo fallback de `TenantProvider`.

### Fase 3 — Fluxo Transacional Único ("um lugar para registrar uma venda")
- Criar um módulo server-side único (`src/app/actions/sales.ts`, por exemplo) com uma função `registrarVenda()` que recebe: itens vendidos, custo, preço, forma de pagamento, origem. Ela é responsável por, num único `writeBatch`: (A) decrementar estoque no campo canônico, (B) criar o `pedido` com o schema canônico, (C) gravar a entrada financeira correspondente.
- Migrar todos os pontos de entrada de venda para chamar essa função em vez de reimplementar o batch manualmente: Calculadora ("Transformar em Pedido"), Venda de Balcão, Consignação ("Registrar Venda"), webhook Fenix3D, WhatsApp (`REGISTER_SALE`).
- Corrigir o cálculo de lucro da Consignação para subtrair `custoUnitario` (não só a comissão), e fazer com que a venda consignada também gere um `pedido` (`origem: 'consignacao'`) — assim ela passa a contar em `faturamentoBruto`/`lucroLiquido`, igual a qualquer outra venda.
- É essa função única — não a documentação — que vai impedir a próxima geração de gargalos como os listados na §2.

### Fase 4 — Orçamentos → Pedidos
- Criar a coleção `orcamentos` (status: rascunho/enviado/aprovado/recusado) e persistir o que `GerarOrcamento.tsx` hoje só imprime em PDF.
- Adicionar ação "Converter em Pedido", que chama o `registrarVenda()`/fluxo de criação de pedido da Fase 3 carregando os itens e o custo já calculado — fechando o ciclo orçar → aprovar → vender → custear.

### Fase 5 — Limpeza de Código Morto e Consolidação de Dashboards
- Remover (ou religar, se houver uma razão de produto não capturada nesta auditoria) `PricingWizard.tsx` e `SlideoverNovoPedido.tsx` — nenhum dos dois tem consumidor hoje.
- Migrar `evolucao/page.tsx` para consumir `fetchDashboardData` (ou uma variante estendida dela) em vez de duplicar as queries ao Firestore, eliminando a possibilidade de os dois painéis divergirem.

### Fase 6 — Guardrails (evitar regressão)
- Com Fase 0 concluída, avaliar `Firestore Security Rules` com validação de schema (campo obrigatório, tipo) além de autenticação — hoje as regras só podem restringir *quem* escreve; o *formato* do que é escrito continua dependendo de disciplina de código.
- Checklist de code review: toda nova escrita numa coleção listada em `src/lib/erpTypes.ts` deve importar o tipo de lá, não recriar o shape inline.

---

## 4. Resumo Executivo (para priorização)

| Prioridade | Item | Esforço estimado | Risco de não fazer |
|---|---|---|---|
| 1 | Fase 0 — Firestore Rules | Baixo (1 arquivo) | Vazamento de dados financeiros de todas as usuárias |
| 2 | §2.1 — Fix WhatsApp `finance_entries` | Trivial (2 linhas) | Feature de IA parece "quebrada" — dado existe mas nunca aparece |
| 3 | §2.2 — Unificar campo de estoque | Médio (múltiplos arquivos + backfill) | Saldo de estoque real diverge do exibido, sem alerta |
| 4 | §2.3 — Unificar status de pedido | Baixo (1 arquivo) | Pedidos da Calculadora somem do Kanban correto |
| 5 | §2.4 — Unificar "loja parceira" | Médio | Feature de Pontos de Venda permanece incompleta (stub) |
| 6 | §2.5 — Corrigir lucro de consignação | Baixo–Médio | KPI de lucro líquido subestima custo real |
| 7 | §2.7/Fase 4 — Persistir Orçamentos | Médio–Alto (feature nova) | Perda de trabalho manual repetido pela artesã |
| 8 | §2.8 — Consolidar Evolução na Dashboard | Médio | Dois painéis podem discordar entre si |

---
*Gerado por auditoria estática de código em 2026-08-13, sem alterações em arquivos de produção. Nenhuma migração de dado foi executada — este documento é o plano, não a implementação.*
