import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { appRoutes } from "@/lib/routes";

// TODO: when billing integration is active, verify session token and activate premium here

export default function BillingSuccess() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="rounded-xl border border-border/60 bg-card p-8 shadow-sm">
          <h1 className="mb-3 text-xl font-semibold text-foreground">Obrigado pelo seu interesse!</h1>
          <p className="mb-2 text-sm text-muted-foreground">
            A confirmação de pagamento estará disponível quando a integração de cobrança for ativada.
          </p>
          <p className="mb-8 text-sm font-medium text-muted-foreground">Nenhum plano foi alterado.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button className="rounded-xl" onClick={() => navigate(appRoutes.dashboard)}>
              Ir para o Dashboard
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-border/60"
              onClick={() => navigate(appRoutes.pricing)}
            >
              Ver planos
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
