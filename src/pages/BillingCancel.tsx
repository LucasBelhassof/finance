import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { appRoutes } from "@/lib/routes";

// TODO: when billing integration is active, clean up any pending checkout state here

export default function BillingCancel() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="rounded-xl border border-border/60 bg-card p-8 shadow-sm">
          <h1 className="mb-3 text-xl font-semibold text-foreground">Checkout não concluído</h1>
          <p className="mb-8 text-sm text-muted-foreground">
            Sua assinatura não foi processada. Nenhuma cobrança foi realizada.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button className="rounded-xl" onClick={() => navigate(appRoutes.pricing)}>
              Ver planos
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-border/60"
              onClick={() => navigate(appRoutes.dashboard)}
            >
              Ir para o Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
