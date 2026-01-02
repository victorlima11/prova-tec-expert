"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle2, LogIn, UserPlus } from "lucide-react"

export default function AuthPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin")
  const router = useRouter()
  const { toast } = useToast()
  const supabase = getSupabaseClient()
  const isSignUp = activeTab === "signup"

  const formTitle = isSignUp ? "Crie sua conta" : "Bem-vindo de volta"
  const formDescription = isSignUp
    ? "Configure seu workspace e organize seus leads em minutos."
    : "Acesse seu workspace e retome as conversas do seu funil."
  const sideTitle = isSignUp ? "Comece com o essencial" : "Retome o pipeline"
  const sideDescription = isSignUp
    ? "Monte sua base com campos personalizados e campanhas prontas."
    : "Veja rapidamente o que precisa de atencao e mova leads no kanban."
  const sideItems = isSignUp
    ? ["Crie um workspace e estagios", "Cadastre leads e campos personalizados", "Ative campanhas e gere mensagens"]
    : ["Visualize o kanban completo", "Aplique filtros por campanha e texto", "Gere mensagens com IA quando precisar"]
  const sideHint = isSignUp
    ? "Dica: use seu email corporativo para facilitar o acesso do time."
    : "Dica: use o filtro para achar leads e campanhas em segundos."

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Login realizado com sucesso",
      })
      router.push("/onboarding/workspace")
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || window.location.origin,
        },
      })

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Conta criada! Verifique seu email para confirmar.",
      })
      router.push("/onboarding/workspace")
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.22),_transparent_45%)] p-4">
      <div className="mx-auto grid w-full max-w-5xl items-stretch gap-6 py-8 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="w-full rounded-3xl border bg-background/90 shadow-lg">
          <CardHeader className="space-y-4 pb-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                  Mini CRM
                </p>
                <CardTitle className="text-2xl font-semibold">{formTitle}</CardTitle>
                <CardDescription>{formDescription}</CardDescription>
              </div>
              <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-muted text-foreground md:flex">
                {isSignUp ? <UserPlus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/60 p-1">
                <TabsTrigger value="signin" className="rounded-lg text-sm">
                  Entrar
                </TabsTrigger>
                <TabsTrigger value="signup" className="rounded-lg text-sm">
                  Criar conta
                </TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="voce@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Senha</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="voce@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Criando conta..." : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="w-full rounded-3xl border bg-muted/30 shadow-sm">
          <CardHeader className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">Mini CRM</p>
            <CardTitle className="text-xl font-semibold">{sideTitle}</CardTitle>
            <CardDescription>{sideDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-3">
              {sideItems.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border bg-background/80 p-4 text-xs text-muted-foreground">{sideHint}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
