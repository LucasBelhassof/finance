import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { appRoutes } from "@/lib/routes";

const legalContent = {
  [appRoutes.terms]: {
    title: "Termos de Uso",
    version: "2026-05-04",
    paragraphs: [
      "O Finly e uma ferramenta de organizacao financeira pessoal. As informacoes exibidas dependem dos dados cadastrados, importados ou integrados pelo usuario.",
      "O usuario e responsavel pela veracidade dos dados inseridos e por revisar lancamentos, categorias, saldos, importacoes e sugestoes automatizadas antes de tomar decisoes financeiras.",
      "Recursos Premium podem incluir IA, importacoes avancadas, automacoes, insights e integracoes. O acesso depende de assinatura ativa registrada no backend de billing.",
      "O Finly pode suspender ou limitar acesso em caso de uso abusivo, tentativa de acesso indevido, fraude, violacao de seguranca ou inadimplencia.",
    ],
  },
  [appRoutes.privacy]: {
    title: "Politica de Privacidade",
    version: "2026-05-04",
    paragraphs: [
      "O Finly trata dados de conta, perfil, lancamentos financeiros, categorias, contas, importacoes, mensagens de chat e metadados tecnicos necessarios para operar a aplicacao.",
      "Dados financeiros e credenciais sensiveis nao devem ser enviados a provedores externos fora dos fluxos explicitamente necessarios. Chaves, tokens e senhas nao sao expostos ao frontend.",
      "O usuario pode solicitar exportacao, correcao ou exclusao/anomizacao de dados. No MVP, esse fluxo e operacional e deve ser executado por administracao autorizada.",
      "Logs devem preservar request id e informacoes operacionais sem registrar senhas, tokens, cookies, extratos completos ou payloads financeiros sensiveis.",
    ],
  },
  [appRoutes.cancellationPolicy]: {
    title: "Politica de Cancelamento",
    version: "2026-05-04",
    paragraphs: [
      "O cancelamento do Finly Premium pode ser solicitado pelo perfil da conta. A aplicacao envia a solicitacao ao provedor de billing e remove o entitlement premium no backend.",
      "Falhas de pagamento, vencimento, cancelamento ou inativacao informados pelo Asaas podem remover o acesso premium automaticamente.",
      "Apos cancelamento, o usuario permanece no plano free e continua podendo acessar os recursos basicos de CRUD financeiro.",
      "Reembolsos, estornos e ajustes financeiros seguem as regras do provedor de pagamento e da legislacao aplicavel.",
    ],
  },
};

export default function LegalPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const content = legalContent[location.pathname as keyof typeof legalContent] ?? legalContent[appRoutes.terms];

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <article className="mx-auto w-full max-w-3xl space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Voltar
        </Button>

        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">Versao {content.version}</p>
          <h1 className="text-3xl font-semibold">{content.title}</h1>
        </header>

        <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-6">
          {content.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-7 text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </div>
      </article>
    </main>
  );
}
