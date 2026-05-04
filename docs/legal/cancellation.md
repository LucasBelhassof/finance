# Política de Cancelamento do Finly Premium

Versão: 2026-05-04

O cancelamento do Finly Premium pode ser solicitado pelo perfil da conta. O backend envia a solicitação ao provedor de billing e atualiza a assinatura interna.

## Efeito do cancelamento

- a assinatura passa para `canceled` ou `inactive`
- o cache `users.is_premium` é atualizado a partir de `billing_subscriptions`
- recursos premium deixam de ser autorizados no backend
- dados financeiros básicos permanecem acessíveis no plano Free

## Pagamento falho

Eventos de pagamento falho ou vencido podem mover a assinatura para `past_due` e remover o entitlement premium até regularização.

## Suporte

Solicitações de suporte devem informar email da conta e data aproximada do evento. Dados sensíveis como senha, token, cookie e chave de API nunca devem ser enviados.
