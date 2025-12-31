import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  try {
    const { lead_id, campaign_id } = await req.json()

    if (!lead_id || !campaign_id) {
      return new Response(JSON.stringify({ error: "lead_id and campaign_id are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase service configuration" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    const { data: lead, error: leadError } = await supabase.from("leads").select("*").eq("id", lead_id).single()
    if (leadError || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single()

    if (campaignError || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { data: customFields } = await supabase
      .from("lead_custom_fields")
      .select("*")
      .eq("workspace_id", lead.workspace_id)

    const { data: customValues } = await supabase
      .from("lead_custom_values")
      .select("*")
      .eq("lead_id", lead_id)

    const customValueMap = new Map<string, string | null>()
    customValues?.forEach((value) => customValueMap.set(value.field_id, value.value))

    const customFacts =
      customFields
        ?.map((field) => {
          const value = customValueMap.get(field.id)
          if (!value) return null
          return `${field.name}: ${value}`
        })
        .filter(Boolean) || []

    const leadFacts = [
      lead.company ? `Empresa: ${lead.company}` : null,
      lead.job_title ? `Cargo: ${lead.job_title}` : null,
      lead.email ? `Email: ${lead.email}` : null,
      lead.phone ? `Telefone: ${lead.phone}` : null,
      ...customFacts,
    ]
      .filter(Boolean)
      .join(" | ")

    const baseContext = [campaign.context, campaign.prompt, leadFacts].filter(Boolean).join("\n")

    const messages = [
      `Oi ${lead.name}, tudo bem? Vi que ${lead.company || "sua empresa"} pode se beneficiar da nossa solucao. ${baseContext}`,
      `Ola ${lead.name}! Estou entrando em contato sobre ${campaign.name}. ${leadFacts}`,
      `Ola ${lead.name}, posso te mostrar rapidamente como ${campaign.name} pode ajudar ${lead.company || "sua equipe"}?`,
    ]

    const inserts = messages.map((content) => ({
      workspace_id: lead.workspace_id,
      lead_id,
      campaign_id,
      content,
    }))

    const { error: insertError } = await supabase.from("generated_messages").insert(inserts)

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
