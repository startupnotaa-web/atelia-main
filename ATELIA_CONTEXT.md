# AtelIA - Contexto Global do Sistema

## 1. Stack Tecnológico e Padrões

- **Framework Principal:** Next.js 16 (App Router)
- **Autenticação e Banco de Dados:** Firebase Auth e Cloud Firestore (Client SDK + Firebase Admin para backend seguro)
- **Pagamentos/Monetização:** Stripe
- **Estilização e UI:** Tailwind CSS v4 (configurado com `@tailwindcss/postcss`)
- **Bibliotecas Adicionais:** Framer Motion (Micro-interações), Recharts (Gráficos), Next-PWA (Progressive Web App), html2canvas & jspdf (geração de relatórios), lucide-react (Ícones limpos).

**Padrão Visual: 'Clean Warmth'**
- **Cores Principais (OKLCH):**
  - **Background e Surface:** Tons de bege claro mantidos constantes (ex: `oklch(97% 0.012 70)`).
  - **Primária:** Tom quente e acolhedor (`oklch(62% 0.15 35)`).
  - **Secundária:** Tom neutro acastanhado (`oklch(45% 0.02 50)`).
  - **Alerta e Sucesso:** Tons harmonizados com a estética quente.
- **Modo Escuro (Dark Mode):** Removido por design para garantir total legibilidade com os tons bege claros e manter o acolhimento do layout.
- **Tipografia:** Fonte principal sem serifa (sans-serif / Manrope) com títulos mais destacados (Sora).
- **Acessibilidade Sênior:** Configurado com `html { font-size: 16px; }` forçando o aumento responsivo das fontes base para conforto de um público mais sênior e leigo em tecnologia.
- **Uso de Tailwind:** Interface guiada por minimalismo, com poucas bordas e sombreamento suave. Uso de keyframes `animate-step-enter` e `framer-motion` para transições fluidas que dão vida sem ruídos.

## 2. Arquitetura e Estrutura de Pastas

O sistema segue a arquitetura orientada ao **Next.js App Router**:

- `/src/app/`: Agrupa todas as rotas de interface de usuário.
  - `/src/app/(rotas_privadas_e_publicas)`: Pastas como `dashboard`, `painel-admin`, `perfil`, `vitrine`, `pedidos`, etc.
  - `/src/app/api/`: Diretório exclusivo de Middlewares Backend e API Routes (ex: `/api/stripe`, `/api/admin`, etc.).
  - `/src/middleware.ts` (ou sua raiz correspondente): Arquivo sensível responsável pelas interceptações de rotas, que, com o AuthContext e o IndexedDB, pode ser a raiz dos redirects no login.
- `/src/components/`: Biblioteca de componentes reutilizáveis para montar a interface.
- `/src/lib/`: Lógica central do sistema e integrações com terceiros:
  - `firebase.ts` / `firebase-admin.ts`: Iniciação do ecossistema Firebase.
  - `TenantProvider.tsx` (**AuthContext**): Contexto mais crítico de frontend. Controla autenticação, sincroniza sessão do Google Auth com o token e ouve alterações do Firestore para definir regras (`isPro`, planos e acessos).
  - `stripe.ts`: Inicialização da SDK do Stripe.
  - `verifyAuth.ts`: Camada de verificação/middleware de backend.
- `/src/utils/` / `/src/config/`: Lógica utilitária (como pronomes, saudação etc.) e setups.

## 3. Schema do Banco de Dados (Firestore)

A plataforma utiliza Multi-Tenancy Isolado por usuário via Firestore Rules. As coleções em vigor e seus dados vitais:

- `users` (Coleção Pai): Armazena dados do plano (`planType`, `plan` - free/pro), dados pessoais (`firstName`, `displayName`, `pronoun`) e token de sessão.
- `perfis`: Armazena configurações públicas do ateliê para a rota Vitrine.
- `catalogo`: Base de produtos disponíveis para fabricação. Requer um campo `userId` do criador.
- `estoque` & `estoque_pronto`: Gerenciamento do status de manufatura de cada peça e peças à pronta entrega.
- `pedidos`: Ordens e orçamentos disparados por clientes ou adicionados manualmente pela artesã.
- `finance_entries` & `transactions`: Entradas e saídas de fluxo de caixa do negócio.
- `clientes`: Informações de contato do cliente (compradores da artesã).
- `partnerStores`, `partnerProducts`, `equipamentos`: Coleções auxiliares para lojas parceiras e maquinário.

**Regras de Segurança (`firestore.rules`):**
Recentemente modificadas e enrijecidas:
- `users`: Permite Leitura/Escrita onde `request.auth.uid == userId`.
- `perfis`: Leitura global (`allow read: if true`), mas gravação do dono (`uid == userId`).
- **Data Collections** (ex: `catalogo`, `estoque`, `pedidos`): As regras novas exigem expressamente que o documento criado ou lido possua a propriedade `userId` exatamente igual à de quem autenticou (usando as funções `isOwner()` na leitura/update/delete e `isCreator()` para create). Se registros antigos não possuem o atributo `userId`, a interface vai falhar em puxar as informações e as ocultará.

## 4. Integração com Stripe

A lógica de monetização e upgrades ocorre em:
- `/src/app/api/stripe/checkout/route.ts`: Inicia uma sessão no Stripe e repassa metadata (como `userId`). Trabalha com variáveis como `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` e `NEXT_PUBLIC_STRIPE_PRICE_YEARLY`.
- `/src/app/api/stripe/portal/route.ts`: Acesso ao Customer Portal para cancelamentos/gestão.
- `/src/app/api/stripe/webhook/route.ts`: A parte mais crítica. Escuta eventos como `checkout.session.completed` e `invoice.payment_succeeded` ou falhas do Stripe e reflete as mudanças (`planType`, data de expiração, etc.) no documento do Firestore do usuário correspondente. Se o webhook falhar em repassar as credenciais/atualizar a base de dados, a conta permanece 'Free'.

## 5. ROADMAP E BUGS CRÍTICOS (Para o Claude Code resolver)

Prioridade 0 (Bugs Críticos):

Login do Google Bloqueado: O usuário fica preso num loop de redirecionamento ou na tela de login. O conflito parece estar entre o middleware.ts, o IndexedDB do Firebase e o AuthContext.

Sumiço de Dados do Usuário: Dados antigos pararam de aparecer após atualizações nas Regras de Segurança. O schema do Firestore pode estar divergente do que a UI espera.

Gatekeeping Falho (Contas Pro/Free): Contas que deveriam ser Pro (ou promovidas via painel) continuam travadas no Free. O Painel Admin também falha ao tentar atualizar o status do usuário.

Prioridade 1 (Monetização e Assinaturas):

Reestruturar os planos no Stripe e no banco de dados para o novo valor de R$ 39,90.

Criar ciclos de cobrança múltiplos: Mensal, Trimestral, Semestral e Anual.

Prioridade 2 (UX e Novas Features):

Painel de Produção: Refatorar a UI para torná-la mais visual e fácil de entender.

Calculadora de Precificação: Simplificar o fluxo de inputs para garantir um entendimento imediato da artesã.

Ponto de Venda (PDV / Venda de Balcão): Criar um sistema rápido para registrar vendas presenciais.

Gestão de Estoque: Adicionar a capacidade de deletar produtos que estão na lista de pronta entrega.
