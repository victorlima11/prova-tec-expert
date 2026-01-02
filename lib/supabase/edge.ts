type GenerateMessagesPayload = {
  lead_id: string
  campaign_id: string
}

type GenerateMessagesResponse = {
  messages?: string[]
}

export async function invokeGenerateMessages(payload: GenerateMessagesPayload, accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Variaveis NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes")
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/generate-messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    const message = errorBody?.error || `Erro na Edge Function (${response.status})`
    throw new Error(message)
  }

  return (await response.json()) as GenerateMessagesResponse
}
