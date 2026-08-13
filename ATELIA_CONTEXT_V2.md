# ATELIA_CONTEXT_V2.md
## Documento de Contexto e Arquitetura - Projeto AtelIA

Este documento foi gerado para fornecer um panorama arquitetural detalhado do projeto AtelIA. Ele deve ser utilizado como referência (single source of truth) para outros agentes de IA e desenvolvedores para manter o ecossistema consistente e evitar quebras durante evoluções.

---

### 1. Stack Tecnológico e Padrões

**Tecnologias Principais:**
* **Frontend:** Next.js (App Router, v16+), React 19, Tailwind CSS (v4).
* **Backend:** Next.js API Routes (Serverless), Firebase Admin SDK.
* **Autenticação e Database:** Firebase Client, Firestore (BaaS).
* **Pagamentos:** Stripe e Stripe Webhooks.
* **IA e Integrações:** `@google/generative-ai` (Gemini 1.5 Flash), Meta Cloud API (WhatsApp Webhook).
* **PWA:** `@ducanh2912/next-pwa` para suporte offline.

**Padrão Visual ("Clean Warmth"):**
* **Objetivo:** Unir o afeto do artesanato à precisão tecnológica.
* **Paleta de Cores:** Foco em cores quentes baseadas no espaço `oklch`. 
  * Background: Bege claro `oklch(97% 0.012 70)`.
  * Primária: Laranja/Cerâmica `oklch(62% 0.15 35)`.
  * Textos: Tons escuros para contraste (ex: `oklch(24% 0.02 50)`).
* **Tipografia:** 
  * **Sora:** Utilizada em títulos e UI para transmitir solidez.
  * **Manrope:** Utilizada no corpo do texto para leitura confortável.
* **TypeScript:** A base de código requer tipagem estrita para modelos e retornos de IA a fim de garantir estabilidade no frontend.

---

### 2. Arquitetura de Autenticação e Segurança

**AuthContext (`TenantProvider.tsx`):**
A arquitetura de autenticação centraliza a gestão da sessão no lado do cliente através do arquivo `src/lib/TenantProvider.tsx`.
* Ele escuta o estado do usuário via `onAuthStateChanged` e imediatamente assina mudanças em tempo real no documento do usuário usando `onSnapshot` do Firestore.
* Sincroniza o token de sessão local através da Action `createSessionCookie` e armazena o tipo de plano localmente (`localStorage.setItem('@artesas/plan')`).
* Esse fluxo evita loops e conflitos de redirecionamento atuando como a única fonte da verdade, abstraindo as regras de bloqueio premium (variável `isPro`).

**Papel do `middleware.ts`:**
Atualmente, não há um `middleware.ts` global atuando nas interceptações de rotas. A proteção de rotas no Next.js App Router foi transferida para o componente wrapper `ProtectedRoute.tsx` (Client-side), que verifica a presença do `userId` no `TenantProvider` e redireciona o usuário para `/login` (prevenindo loops do lado do servidor).

**Segurança no Banco de Dados (`firestore.rules`):**
O arquivo de regras (`firestore.rules`) atual encontra-se completamente permissivo (modo de testes):
```text
match /{document=**} {
  allow read, write: if true;
}
```
**Aviso Crítico:** Esse estado é temporário e as regras precisam ser fechadas imediatamente em produção para garantir o acesso restrito e seguro aos dados de cada lojista baseado no `request.auth.uid`.

---

### 3. Schema do Banco de Dados (Firestore)

Abaixo estão as estruturas documentais vitais do projeto. Os dados inseridos no frontend e backend devem respeitar estes formatos.

**Coleção `users`** (Perfil da artesã / lojista)
* `phone` ou `whatsapp` (String): Usado como chave de resolução de identidade pelo webhook do WhatsApp.
* `planType` / `plan` (String): Define o acesso (ex: "free", "pro", "profissional").
* `firstName`, `nome`, `displayName` (String): Nomes da artesã.
* `pronoun` (String): Tratamento da UI (ex: "ela").
* `stripeCustomerId`, `stripeSubscriptionId` (String): Vínculo com a assinatura.
* `updatedAt` (ISO Date String).

**Coleção `finance_entries`** (Entradas e Saídas / Fluxo de Caixa)
* `userId` (String, obrigatório): ID do usuário autenticado no Firebase.
* `amount` (Number, obrigatório): Valor numérico real (ex: `150.50`).
* `type` (String, obrigatório): Literal `"income"` (receitas) ou `"expense"` (despesas).
* `description` (String, obrigatório): Descrição do lançamento gerada pela IA ou app.
* `createdAt` (Timestamp / Date, obrigatório): Data de criação da movimentação.

*Existem também coleções de `pedidos`, `estoque`, `catalogo`, `clientes`, etc., que devem seguir a mesma padronização utilizando o campo obrigatório `userId`.*

---

### 4. Integrações de Backend (Webhooks e IA)

**Integração Stripe (Pagamentos e Assinaturas):**
O webhook localizado em `src/app/api/stripe/webhook/route.ts` é o coração financeiro.
* Escuta o evento `checkout.session.completed` para fazer upgrade da conta (modifica o `users` para `planType: 'pro'`).
* Escuta `customer.subscription.deleted` para fazer o downgrade automático (reverte para `planType: 'free'`).
* A estratégia de idempotência é baseada no método `set({ merge: true })` do Firebase Admin SDK, o qual não destrói os dados existentes do perfil ao atrelar os metadados do Stripe.

**Integração WhatsApp + Gemini AI:**
A rota `src/app/api/whatsapp-webhook/route.ts` processa as conversas diretas com as artesãs (A Conselheira AtelIA).
1. **Validação GET:** Responde ao `hub.challenge` para verificação da Meta.
2. **Recebimento POST:** A rota extrai o número (`phone`) e o conteúdo (seja ele uma mensagem de `text` ou de `audio`).
3. **Mídia e Multimodalidade:** Se for áudio, a API faz download do binário via Meta Graph API e envia os dados (Base64 + MIME) via propriedade `inlineData` do SDK do Gemini.
4. **Prompt Estruturado (Gemini 1.5 Flash):** Usa um prompt de sistema para orquestrar as saídas rigidamente em formato JSON (`responseMimeType: 'application/json'`). O retorno impõe um `intent` (`REGISTER_SALE`, `ADD_EXPENSE`, `INQUIRY`), o valor da transação (`amount`) e uma resposta humanizada (`replyText`).
5. **Injeção de Dados (Admin SDK):** O webhook localiza a lojista pela sua collection `users` baseada no número de telefone, converte as strings pra número e injeta em tempo real os documentos na coleção `finance_entries`.
6. **Resposta:** Utiliza a Graph API (`/messages`) para retornar imediatamente à usuária via WhatsApp, o que evita loops de timeout do webhook.

---

### 5. Estado Atual e Funcionalidades Core

**Dashboard e Fluxo de Caixa:**
* A dashboard e os fluxos financeiros dependem primariamente da agregação das transações na coleção `finance_entries`, sempre filtrando pelos dados logados `where('userId', '==', userId)`.
* O cálculo de lucro, despesa e saldo dependem da tipagem numérica (Number) da propriedade `amount`.

**PWA e Funcionamento Offline:**
* O App é capaz de gerenciar visualização offline em determinadas rotas. O arquivo de configuração `next.config.ts` utiliza `@ducanh2912/next-pwa`.
* As rotas chave do painel da artesã (`/dashboard`, `/pedidos`, `/venda-balcao`) usam cache `StaleWhileRevalidate` garantindo interface estável.
* Requisições para `/api/` usam `NetworkFirst`.

---
*Documento autogerado para a transição de contexto com agentes autônomos (Claude Code, Gemini).*
