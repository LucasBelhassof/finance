# 14. Boas práticas e padrões

## Princípios observados no projeto

### Regras de domínio no backend

As regras críticas ficam no servidor:

- compatibilidade de categoria com tipo da transação
- validação de conta/cartão
- fallback de categoria
- restrições de exclusão
- rotação de sessão
- sincronização de categoria em parcelamentos

### Queries explícitas

O backend usa SQL legível em vez de ORM pesado. Benefícios:

- previsibilidade de join e agregação
- clareza em regras financeiras
- controle fino sobre filtros por `user_id`

### Scoping por usuário

Padrão recorrente:

```sql
WHERE user_id = $1
```

### Tipagem de fronteira

No frontend:

- `Api*` representa a resposta crua
- tipos normalizados representam o consumo real da UI

No backend:

- módulos de auth usam tipos explícitos
- schemas de entrada ficam em Zod

### Mutação com invalidação de cache

Após mutações relevantes, o frontend invalida queries dependentes como:

- dashboard
- spending
- insights
- installments
- housing

### Naming

Padrões observados:

- `list*` para leitura de coleção
- `create*`, `update*`, `delete*` para mutações
- `get*` para leitura unitária ou agregada
- `map*` para adaptação de payload
- `normalize*` para limpeza de entrada
- `build*` para agregações e objetos derivados

### Padrões de segurança

- cookie HttpOnly para refresh token
- access token via header Bearer
- rate limiting em rotas sensíveis
- auditoria em eventos de auth e admin
- checagem admin no backend
- validação server-side de inputs e referências
