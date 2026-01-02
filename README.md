# Mini CRM

Mini CRM para equipes de SDR, focado em organizar o funil e facilitar a abordagem. O app permite criar campanhas com contexto e prompt, gerar mensagens com IA e mover leads entre etapas com regras de validação.

## Visão geral

O fluxo principal foi pensado para ser simples e direto:

1. O usuário cria conta e entra no sistema.
2. Cria ou seleciona um workspace (empresa ou equipe).
3. Configura campos personalizados e regras de etapa.
4. Cria campanhas com contexto, prompt e etapa gatilho.
5. Cadastra leads no kanban e move entre etapas.
6. Dentro do lead, gera mensagens com IA, copia ou envia (simulado).
7. Ao enviar, o lead vai para "Tentando Contato".

## Funcionalidades

- Autenticação com Supabase Auth
- Multi-workspace com isolamento por workspace_id
- Kanban de leads com etapas do funil
- Campos personalizados por workspace
- Regras de campos obrigatórios por etapa
- Campanhas com contexto, prompt e etapa gatilho
- Geração de mensagens via IA e envio simulado
- Gatilho automático de campanhas ao mover/criar lead na etapa configurada
- Filtros por campanha e busca textual no kanban
- Dashboard com total de leads e distribuição por etapa
- Soft delete de workspace (arquivamento)

## Decisões técnicas

- Multi-tenant por workspace_id: todas as tabelas principais carregam esse campo e as consultas filtram por workspace.
- RLS no Supabase: as políticas impedem acesso a dados de outro workspace.
- Edge Function para IA: a geração de mensagens roda no backend e grava em generated_messages, evitando expor a chave do Gemini no frontend.
- Gatilho de campanhas no cliente: quando o lead entra na etapa gatilho, a geração é disparada via Edge Function.
- Soft delete de workspaces: arquivamento e impede apagar dados acidentalmente.
- Workspace atual em localStorage: melhora a experiência e evita pedir seleção a cada reload. (Parecido com cache)

## Stack

- Next.js
- TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres + Auth + Edge Functions)
- Google Gemini (via Edge Function)

## Como rodar localmente

### Variáveis de ambiente (frontend)

Crie um arquivo `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000
```

### Secrets da Edge Function

No painel do Supabase, adicione:

```
GEMINI_API_KEY=...
```

### Banco de dados

Execute os scripts no SQL Editor do Supabase, na ordem:

1. `scripts/001-initial-schema.sql`
2. `scripts/002-rpc-functions.sql`
5. `scripts/007-workspace-archive.sql` (obrigatório para o soft delete)

### Subir o app

```
npm install
npm run dev
```

Acesse http://localhost:3000.

## IA e Edge Function

A função `generate-messages` fica em `supabase/functions/generate-messages`. Ela recebe `lead_id` e `campaign_id`, monta o prompt com base no contexto da campanha e nos dados do lead, chama o Gemini e grava as mensagens em `generated_messages`.

## Estrutura do projeto (resumo)

```
app/
  auth/                # Login e cadastro
  onboarding/          # Selecionar/criar workspace
  app/                 # Área logada
    dashboard/
    leads/
    campaigns/
    settings/
components/
lib/
  supabase/
  types.ts
scripts/
```

