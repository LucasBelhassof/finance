import { ArrowRight, CheckCircle2, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { useBillingSubscription, useCreateBillingCheckout } from "@/hooks/use-billing";
import { appRoutes } from "@/lib/routes";
import { useAuthSession } from "@/modules/auth/hooks/use-auth-session";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function PricingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthSession();
  const { data } = useBillingSubscription(isAuthenticated);
  const checkout = useCreateBillingCheckout();
  const amount = data?.plan?.amount ?? 29.9;

  const handleUpgrade = async () => {
    if (!isAuthenticated) {
      navigate(appRoutes.signup);
      return;
    }

    try {
      const result = await checkout.mutateAsync();

      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
      }
    } catch (error) {
      toast.error("Nao foi possivel iniciar o checkout.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate(appRoutes.dashboard)}>
            Finly
          </Button>
          <Button variant="outline" onClick={() => navigate(isAuthenticated ? appRoutes.profile : appRoutes.login)}>
            {isAuthenticated ? "Minha conta" : "Entrar"}
          </Button>
        </div>

        <section className="grid gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)] md:items-center">
          <div className="space-y-4">
            <Badge className="w-fit border-primary/20 bg-primary/10 text-primary">Freemium + Premium</Badge>
            <h1 className="text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">Finly Premium</h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              O plano free cobre o controle financeiro basico. O Premium libera IA, importacoes avancadas, automacoes,
              insights e integracoes.
            </p>
          </div>

          <Card className="border-border/60">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Crown size={18} />
                  Premium mensal
                </CardTitle>
                {data?.isPremium ? <Badge className="bg-income/10 text-income">Ativo</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-4xl font-semibold">{currencyFormatter.format(amount)}</p>
                <p className="mt-1 text-sm text-muted-foreground">por mes</p>
              </div>

              <div className="space-y-3">
                {[
                  "Chat financeiro com IA",
                  "Revisao e geracao de planos por IA",
                  "Importacao com sugestoes inteligentes",
                  "Importacao em massa acima do limite free",
                  "Insights avancados e automacoes",
                  "Integracoes bancarias quando habilitadas",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="mt-0.5 text-income" size={16} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <Button className="h-11 w-full" disabled={checkout.isPending || data?.isPremium} onClick={handleUpgrade}>
                {data?.isPremium ? "Premium ativo" : "Assinar Premium"}
                {!data?.isPremium ? <ArrowRight size={16} /> : null}
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
