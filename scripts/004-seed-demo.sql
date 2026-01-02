-- Seed demo data for a single user.
-- 1) Replace the email below with your Supabase Auth user email.
-- 2) Run in Supabase SQL Editor or via the CLI.
DO $$
DECLARE
  v_user_id uuid;
  v_workspace_id uuid;
  v_base_stage_id uuid;
  v_mapeado_stage_id uuid;
  v_contato_stage_id uuid;
  v_conexao_stage_id uuid;
  v_stage_ids uuid[];
  v_stage_count integer;
  v_field_segment_id uuid;
  v_field_stack_id uuid;
  v_campaign_id uuid;
  v_lead1_id uuid;
  v_lead2_id uuid;
  v_lead_id uuid;
  v_lead_email text;
  v_lead_name text;
  v_stage_id uuid;
  v_company text;
  v_phone text;
  v_job_title text;
  v_source text;
  v_segment text;
  v_stack text;
  v_segments text[] := ARRAY['SaaS', 'Fintech', 'E-commerce', 'Agtech', 'Edtech', 'Healthtech'];
  v_stacks text[] := ARRAY['HubSpot', 'Pipedrive', 'Salesforce', 'RD Station', 'Apollo', 'Outreach'];
  v_job_titles text[] := ARRAY['Head de Vendas', 'CEO', 'Diretor Comercial', 'Coordenador SDR', 'Gerente de Marketing'];
  v_sources text[] := ARRAY['Evento', 'Indicacao', 'Outbound', 'Inbound', 'LinkedIn'];
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'marcvictor.dev@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found. Update the email in this script.';
  END IF;

  SELECT id INTO v_workspace_id
  FROM workspaces
  WHERE owner_id = v_user_id
    AND name = 'Demo Workspace'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    INSERT INTO workspaces (name, owner_id)
    VALUES ('Demo Workspace', v_user_id)
    RETURNING id INTO v_workspace_id;

    INSERT INTO workspace_users (workspace_id, user_id, role)
    VALUES (v_workspace_id, v_user_id, 'admin');

    PERFORM create_default_pipeline(v_workspace_id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM workspace_users WHERE workspace_id = v_workspace_id AND user_id = v_user_id
  ) THEN
    INSERT INTO workspace_users (workspace_id, user_id, role)
    VALUES (v_workspace_id, v_user_id, 'admin');
  END IF;

  SELECT id INTO v_base_stage_id
  FROM pipeline_stages
  WHERE workspace_id = v_workspace_id
    AND name = 'Base'
  LIMIT 1;

  SELECT id INTO v_mapeado_stage_id
  FROM pipeline_stages
  WHERE workspace_id = v_workspace_id
    AND name = 'Lead Mapeado'
  LIMIT 1;

  SELECT id INTO v_contato_stage_id
  FROM pipeline_stages
  WHERE workspace_id = v_workspace_id
    AND name = 'Tentando Contato'
  LIMIT 1;

  SELECT id INTO v_conexao_stage_id
  FROM pipeline_stages
  WHERE workspace_id = v_workspace_id
    AND name = 'Conexao Iniciada'
  LIMIT 1;

  SELECT array_agg(id ORDER BY sort_order) INTO v_stage_ids
  FROM pipeline_stages
  WHERE workspace_id = v_workspace_id;

  v_stage_count := COALESCE(array_length(v_stage_ids, 1), 0);

  IF v_stage_count = 0 THEN
    RAISE EXCEPTION 'No pipeline stages found for workspace %', v_workspace_id;
  END IF;

  SELECT id INTO v_field_segment_id
  FROM lead_custom_fields
  WHERE workspace_id = v_workspace_id
    AND name = 'Segmento'
  LIMIT 1;

  IF v_field_segment_id IS NULL THEN
    INSERT INTO lead_custom_fields (workspace_id, name, field_type)
    VALUES (v_workspace_id, 'Segmento', 'text')
    RETURNING id INTO v_field_segment_id;
  END IF;

  SELECT id INTO v_field_stack_id
  FROM lead_custom_fields
  WHERE workspace_id = v_workspace_id
    AND name = 'Stack Atual'
  LIMIT 1;

  IF v_field_stack_id IS NULL THEN
    INSERT INTO lead_custom_fields (workspace_id, name, field_type)
    VALUES (v_workspace_id, 'Stack Atual', 'text')
    RETURNING id INTO v_field_stack_id;
  END IF;

  IF v_mapeado_stage_id IS NOT NULL THEN
    DELETE FROM stage_required_fields
    WHERE workspace_id = v_workspace_id
      AND stage_id = v_mapeado_stage_id;

    INSERT INTO stage_required_fields (workspace_id, stage_id, field_key)
    VALUES
      (v_workspace_id, v_mapeado_stage_id, 'email'),
      (v_workspace_id, v_mapeado_stage_id, 'company'),
      (v_workspace_id, v_mapeado_stage_id, 'custom:' || v_field_segment_id::text);
  END IF;

  SELECT id INTO v_campaign_id
  FROM campaigns
  WHERE workspace_id = v_workspace_id
    AND name = 'Demo Campanha'
  LIMIT 1;

  IF v_campaign_id IS NULL THEN
    INSERT INTO campaigns (workspace_id, name, context, prompt, active, trigger_stage_id)
    VALUES (
      v_workspace_id,
      'Demo Campanha',
      'Foco em SDRs B2B com produto SaaS',
      'Crie abordagem curta e direta com convite para conversa',
      true,
      v_mapeado_stage_id
    )
    RETURNING id INTO v_campaign_id;
  END IF;

  INSERT INTO campaigns (workspace_id, name, context, prompt, active, trigger_stage_id)
  SELECT v_workspace_id, data.name, data.context, data.prompt, data.active, data.trigger_stage_id
  FROM (
    VALUES
      (
        'Campanha Follow-up',
        'Follow-up apos primeiro contato sem resposta',
        'Mensagem curta e educada com CTA de 10 minutos',
        true,
        COALESCE(v_contato_stage_id, v_mapeado_stage_id, v_base_stage_id)
      ),
      (
        'Campanha Reativacao',
        'Reativar leads frios do ultimo trimestre',
        'Abordagem objetiva com pergunta de prioridade',
        true,
        COALESCE(v_base_stage_id, v_mapeado_stage_id)
      ),
      (
        'Campanha Convite Demo',
        'Convite para demonstracao rapida do produto',
        'Tom consultivo com convite para demo de 15 minutos',
        true,
        COALESCE(v_mapeado_stage_id, v_contato_stage_id, v_base_stage_id)
      ),
      (
        'Campanha Conteudo',
        'Compartilhar material util do mercado',
        'Mensagem com conteudo relevante e CTA leve',
        true,
        COALESCE(v_conexao_stage_id, v_contato_stage_id, v_base_stage_id)
      )
  ) AS data(name, context, prompt, active, trigger_stage_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM campaigns WHERE workspace_id = v_workspace_id AND name = data.name
  );

  IF NOT EXISTS (
    SELECT 1 FROM leads WHERE workspace_id = v_workspace_id AND name = 'Ana Costa'
  ) THEN
    INSERT INTO leads (
      workspace_id,
      stage_id,
      responsible_user_id,
      name,
      email,
      phone,
      company,
      job_title,
      source,
      notes
    )
    VALUES (
      v_workspace_id,
      v_base_stage_id,
      v_user_id,
      'Ana Costa',
      'ana.costa@acme.com',
      '+55 11 90000-0001',
      'ACME LTDA',
      'Head de Vendas',
      'Evento',
      'Interessada em automacao de prospeccao'
    )
    RETURNING id INTO v_lead1_id;

    INSERT INTO lead_custom_values (lead_id, field_id, value)
    VALUES
      (v_lead1_id, v_field_segment_id, 'SaaS'),
      (v_lead1_id, v_field_stack_id, 'HubSpot');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM leads WHERE workspace_id = v_workspace_id AND name = 'Bruno Lima'
  ) THEN
    INSERT INTO leads (
      workspace_id,
      stage_id,
      responsible_user_id,
      name,
      email,
      phone,
      company,
      job_title,
      source,
      notes
    )
    VALUES (
      v_workspace_id,
      v_mapeado_stage_id,
      v_user_id,
      'Bruno Lima',
      'bruno.lima@startup.io',
      '+55 21 90000-0002',
      'Startup.io',
      'CEO',
      'Indicado',
      'Busca melhorar conversao do funil'
    )
    RETURNING id INTO v_lead2_id;

    INSERT INTO lead_custom_values (lead_id, field_id, value)
    VALUES
      (v_lead2_id, v_field_segment_id, 'Tech'),
      (v_lead2_id, v_field_stack_id, 'Pipedrive');
  END IF;

  FOR i IN 1..50 LOOP
    v_lead_email := format('lead%03s@demo.com', i);

    IF EXISTS (
      SELECT 1 FROM leads WHERE workspace_id = v_workspace_id AND email = v_lead_email
    ) THEN
      CONTINUE;
    END IF;

    v_lead_name := format('Lead Demo %s', lpad(i::text, 3, '0'));
    v_stage_id := v_stage_ids[((i - 1) % v_stage_count) + 1];
    v_company := 'Empresa ' || lpad(((i - 1) % 15 + 1)::text, 2, '0');
    v_phone := '+55 11 9' || lpad(i::text, 4, '0') || '-' || lpad(((i * 7) % 10000)::text, 4, '0');
    v_job_title := v_job_titles[((i - 1) % array_length(v_job_titles, 1)) + 1];
    v_source := v_sources[((i - 1) % array_length(v_sources, 1)) + 1];
    v_segment := v_segments[((i - 1) % array_length(v_segments, 1)) + 1];
    v_stack := v_stacks[((i - 1) % array_length(v_stacks, 1)) + 1];

    INSERT INTO leads (
      workspace_id,
      stage_id,
      responsible_user_id,
      name,
      email,
      phone,
      company,
      job_title,
      source,
      notes
    )
    VALUES (
      v_workspace_id,
      v_stage_id,
      v_user_id,
      v_lead_name,
      v_lead_email,
      v_phone,
      v_company,
      v_job_title,
      v_source,
      'Lead de teste para validar o funil.'
    )
    RETURNING id INTO v_lead_id;

    INSERT INTO lead_custom_values (lead_id, field_id, value)
    VALUES
      (v_lead_id, v_field_segment_id, v_segment),
      (v_lead_id, v_field_stack_id, v_stack);
  END LOOP;

  WITH target_leads AS (
    SELECT id, name
    FROM leads
    WHERE workspace_id = v_workspace_id
    ORDER BY created_at DESC
    LIMIT 20
  ),
  target_campaigns AS (
    SELECT id, name
    FROM campaigns
    WHERE workspace_id = v_workspace_id
      AND active = true
    ORDER BY created_at DESC
    LIMIT 4
  )
  INSERT INTO generated_messages (workspace_id, lead_id, campaign_id, content)
  SELECT
    v_workspace_id,
    target_leads.id,
    target_campaigns.id,
    format('Mensagem demo para %s na %s.', target_leads.name, target_campaigns.name)
  FROM target_leads
  CROSS JOIN target_campaigns
  WHERE NOT EXISTS (
    SELECT 1
    FROM generated_messages gm
    WHERE gm.lead_id = target_leads.id
      AND gm.campaign_id = target_campaigns.id
  );
END $$;
