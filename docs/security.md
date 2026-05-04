# Segurança operacional

## Auth e sessão

- access token via `Authorization: Bearer`
- refresh token em cookie HttpOnly
- `inactive` e `suspended` são bloqueados em login, refresh e rotas protegidas
- rotas administrativas continuam protegidas no backend
- aceite de Termos e Privacidade é obrigatório no signup e registrado com versão, IP, user agent e request id

## Premium e billing

- a fonte de verdade comercial é `billing_subscriptions`
- `users.is_premium` e `users.premium_since` são cache de compatibilidade
- recursos premium são bloqueados no backend por `requirePremiumFeature`
- webhook Asaas valida `asaas-access-token`
- eventos Asaas são idempotentes por `(provider, provider_event_id)`
- `ASAAS_API_KEY` nunca deve sair do backend

## CORS

- o backend usa `APP_ORIGIN` como origem permitida
- não há CORS wildcard em produção
- `credentials: true` permanece ativo para cookies de refresh

## Health e readiness

- `GET /api/health` é liveness leve
- `GET /api/ready` valida conectividade com o banco

## Rate limit

- auth já possui rate limit dedicado
- importação possui rate limit dedicado
- chat/IA possui rate limit dedicado

## Logs

- runtime usa logger simples com `requestId`
- `x-request-id` recebido do proxy é reaproveitado; se ausente, o backend gera um id
- logs não devem expor senha, token, cookie, segredo, extrato bruto nem payload financeiro completo
- logs de billing devem registrar ids de provedor e status, não payload completo com dados sensíveis

## LGPD operacional

Fluxo mínimo para MVP:

- exportação: gerar dump lógico filtrado por `user_id` nas tabelas financeiras, auth auditável e billing associado
- exclusão/anomização: anonimizar dados cadastrais e remover/revogar sessões, tokens, previews e dados financeiros quando não houver obrigação legal de retenção
- billing: manter eventos/auditoria necessários para conciliação e defesa legal, sem expor dados financeiros sensíveis fora do backend
- atendimento: registrar solicitação e data de execução em canal administrativo externo até existir UI dedicada

## Limitações conhecidas

- preview de importação ainda usa store em memória
- restart do backend invalida previews em aberto
- multi-instância exige store compartilhado em Postgres ou Redis
