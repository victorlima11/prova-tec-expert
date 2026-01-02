import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleGenAI } from "npm:@google/genai"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

const loadConfig = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY")

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase service configuration")
  }

  if (!geminiApiKey) {
    throw new Error("Missing Gemini API key")
  }

  return { supabaseUrl, supabaseServiceKey, geminiApiKey }
}

const getBearerToken = (req: Request) => {
  const header = req.headers.get("authorization") || req.headers.get("Authorization")
  if (!header) return null
  const [type, token] = header.split(" ")
  if (type !== "Bearer" || !token) return null
  return token
}

const extractJson = (text: string) => {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (match ? match[1] : text).trim()
}

const parseMessages = (text: string) => {
  if (!text) return []
  try {
    const parsed = JSON.parse(extractJson(text))
    const list = Array.isArray(parsed) ? parsed : parsed?.messages
    if (!Array.isArray(list)) return []
    return list.map((item) => `${item}`.trim()).filter(Boolean)
  } catch {
    return []
  }
}

const sanitizeMessage = (message: string) => {
  const withoutPlaceholders = message
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/\{[^}]+\}/g, "")

  return withoutPlaceholders.replace(/\s{2,}/g, " ").replace(/\s+([,.:;!?])/g, "$1").trim()
}

const buildLeadFacts = (lead: any, customFacts: string[]) =>
  [
    lead.name ? `Nome: ${lead.name}` : null,
    lead.company ? `Empresa: ${lead.company}` : null,
    lead.job_title ? `Cargo: ${lead.job_title}` : null,
    lead.email ? `Email: ${lead.email}` : null,
    lead.phone ? `Telefone: ${lead.phone}` : null,
    lead.source ? `Origem: ${lead.source}` : null,
    ...customFacts,
  ]
    .filter(Boolean)
    .join(" | ")

const buildCustomFacts = (customFields: any[] | null, customValues: any[] | null) => {
  const customValueMap = new Map<string, string | null>()
  customValues?.forEach((value) => customValueMap.set(value.field_id, value.value))

  return (
    customFields
      ?.map((field) => {
        const value = customValueMap.get(field.id)
        if (!value) return null
        return `${field.name}: ${value}`
      })
      .filter(Boolean) || []
  )
}

const buildPrompt = (campaign: any, leadFacts: string) => {
  const contextLines = [
    `Campanha: ${campaign.name}`,
    campaign.context ? `Contexto: ${campaign.context}` : null,
    campaign.prompt ? `Prompt: ${campaign.prompt}` : null,
    leadFacts ? `Dados do lead: ${leadFacts}` : null,
  ].filter(Boolean)

  const instruction = [
    "Gere 2 ou 3 mensagens curtas de abordagem para SDR em portugues.",
    "Use somente as informacoes fornecidas. Nao invente dados.",
    "Nao use placeholders nem colchetes, por exemplo: [Seu Nome], [Sua Empresa].",
    "Nao mencione nome do SDR. Se faltar dado, escreva de forma generica.",
    "Se o nome do lead existir, use. Caso contrario, inicie com 'Ola'.",
    "Exemplo de saida valida: {\"messages\": [\"Ola Ana, vi que...\", \"Ola Ana, notei que...\", \"Ola, vi que...\"]}.",
    "Retorne apenas JSON valido no formato {\"messages\": [\"...\", \"...\", \"...\"]}.",
  ].join(" ")

  return `${instruction}\n\n${contextLines.join("\n")}`
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders })
  }

  try {
    const { lead_id, campaign_id } = await req.json()

    if (!lead_id || !campaign_id) {
      return jsonResponse(400, { error: "lead_id and campaign_id are required" })
    }

    const { supabaseUrl, supabaseServiceKey, geminiApiKey } = loadConfig()
    const token = getBearerToken(req)

    if (!token) {
      return jsonResponse(401, { error: "Missing auth token" })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData?.user) {
      return jsonResponse(401, { error: "Invalid auth token" })
    }

    const user = authData.user

    const { data: lead, error: leadError } = await supabase.from("leads").select("*").eq("id", lead_id).single()
    if (leadError || !lead) {
      return jsonResponse(404, { error: "Lead not found" })
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single()

    if (campaignError || !campaign) {
      return jsonResponse(404, { error: "Campaign not found" })
    }

    if (campaign.workspace_id !== lead.workspace_id) {
      return jsonResponse(400, { error: "Campaign does not match lead workspace" })
    }

    const { data: membership, error: membershipError } = await supabase
      .from("workspace_users")
      .select("id")
      .eq("workspace_id", lead.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (membershipError) {
      return jsonResponse(500, { error: membershipError.message })
    }

    if (!membership) {
      return jsonResponse(403, { error: "Forbidden" })
    }

    const { data: customFields } = await supabase
      .from("lead_custom_fields")
      .select("*")
      .eq("workspace_id", lead.workspace_id)

    const { data: customValues } = await supabase
      .from("lead_custom_values")
      .select("*")
      .eq("lead_id", lead_id)

    const customFacts = buildCustomFacts(customFields, customValues)

    const leadFacts = buildLeadFacts(lead, customFacts)

    const ai = new GoogleGenAI({ apiKey: geminiApiKey })

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: buildPrompt(campaign, leadFacts),
    })

    const rawText = response.text?.trim() ?? ""
    const messages = parseMessages(rawText).map(sanitizeMessage).filter(Boolean).slice(0, 3)

    if (messages.length === 0) {
      return jsonResponse(500, { error: "No messages generated" })
    }

    const inserts = messages.map((content) => ({
      workspace_id: lead.workspace_id,
      lead_id,
      campaign_id,
      content,
    }))

    const { error: insertError } = await supabase.from("generated_messages").insert(inserts)

    if (insertError) {
      return jsonResponse(500, { error: insertError.message })
    }

    return jsonResponse(200, { messages })
  } catch (error) {
    console.error("generate-messages error", error)
    const message = error instanceof Error ? error.message : `${error}`
    return jsonResponse(500, { error: message || "Unexpected error" })
  }
})
