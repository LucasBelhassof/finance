# 15. Casos de uso

## 1. Usuário cria conta

1. acessa `SignupPage`
2. frontend envia `POST /api/auth/signup`
3. backend valida payload via Zod
4. senha é hashada com Argon2
5. usuário é criado em `users`
6. sessão é criada em `auth_sessions`
7. refresh token vai para cookie HttpOnly
8. access token volta na resposta
9. `AuthProvider` aplica a sessão

## 2. Usuário adiciona transação

1. página `Transactions.tsx` abre modal
2. formulário coleta descrição, valor, data, conta e categoria
3. `useCreateTransaction` chama `postTransaction`
4. backend valida conta, tipo e categoria
5. transação é gravada em `transactions`
6. frontend atualiza cache da lista e invalida dashboard

## 3. Usuário vê dashboard

1. página `Index.tsx` chama `useDashboard`
2. frontend requisita `GET /api/dashboard`
3. backend agrega saldo, despesas, insights, bancos e chat
4. componentes renderizam cards, listas e gráficos

## 4. Usuário recebe insight

1. dashboard ou página `Insights` chama `GET /api/insights`
2. backend carrega despesas e saldo do usuário
3. motor `generateInsights` monta snapshot e avalia regras
4. ranking ordena e limita a resposta
5. frontend exibe título, descrição, prioridade, tom e CTA

## 5. Usuário recebe notificação

### Caso A: criada por ele mesmo

1. frontend envia `POST /api/notifications/self`
2. backend cria notificação base
3. backend cria recipient para o próprio usuário
4. `GET /api/notifications` passa a listar o item

### Caso B: criada por admin

1. admin usa tela de notificações administrativas
2. frontend envia `POST /api/admin/notifications`
3. backend resolve audiência
4. cria notificação base + recipients
5. usuários-alvo passam a receber a notificação em sua própria listagem

## 6. Usuário importa transações

1. seleciona arquivo e conta
2. frontend chama preview
3. backend gera preview e detecta duplicidade/parcelamento
4. usuário revisa ou aplica IA
5. frontend envia commit
6. backend insere transações
7. dashboard, insights e spending são invalidados

## 7. Usuário edita categoria de uma parcela

1. usuário edita uma transação parcelada
2. envia `PATCH /api/transactions/:id`
3. backend identifica `installment_purchase_id`
4. backend sincroniza a nova categoria em todas as parcelas e no agrupador
5. retorna a transação atualizada

## 8. Usuário cadastra despesa fixa de habitação

1. página `Housing.tsx` envia `POST /api/housing`
2. backend grava item em `housing`
3. backend gera transações derivadas
4. se for financiamento, também cria `installment_purchases`
5. esses lançamentos entram no dashboard e relatórios automaticamente
