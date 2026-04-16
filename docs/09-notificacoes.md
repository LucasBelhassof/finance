# 09. Notificações

## Objetivo

O módulo de notificações permite:

- lembretes criados pelo próprio usuário
- notificações disparadas por administradores
- marcação de leitura
- filtro por status, fonte e período

## Modelo

Há duas tabelas:

### `notifications`

- `id`
- `created_by_user_id`
- `source`
- `category`
- `title`
- `message`
- `trigger_at`
- `created_at`

### `notification_recipients`

- `id`
- `notification_id`
- `user_id`
- `is_read`
- `read_at`
- `created_at`

## Categorias

- `general`
- `invoice_due`
- `financing_due`
- `installment_due`
- `housing_due`
- `custom`

## Fonte

- `user_self`
- `admin_all`
- `admin_selected`

## Fluxo de criação

### Usuário criando para si

Endpoint: `POST /api/notifications/self`

### Admin criando em massa

Endpoint: `POST /api/admin/notifications`

Audiências:

- todos
- premium
- non_premium
- usuários selecionados

## Listagem

`GET /api/notifications`

Filtros suportados:

- `limit`
- `unreadOnly`
- `status`
- `source`
- `startDate`
- `endDate`

Resposta:

- `unreadCount`
- lista de notificações enriquecidas com dados do criador

## Leitura e status

- `PATCH /api/notifications/:recipientId/read`
- `PATCH /api/notifications/:recipientId/unread`
- `PATCH /api/notifications/read-all`
- `DELETE /api/notifications/:recipientId`

Ao excluir:

1. remove o recipient do usuário
2. remove a notificação base se não restar nenhum recipient

## Frontend

Hooks principais:

- `useNotifications`
- `useUnreadNotifications`
- `useCreateSelfNotification`
- `useMarkNotificationAsRead`
- `useMarkNotificationAsUnread`
- `useMarkAllNotificationsAsRead`
- `useDeleteNotification`
