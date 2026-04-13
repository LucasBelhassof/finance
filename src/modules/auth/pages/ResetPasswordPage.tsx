import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { appRoutes } from "@/lib/routes";
import { AuthScreen } from "@/modules/auth/components/AuthScreen";
import { PasswordField } from "@/modules/auth/components/PasswordField";
import { resetPasswordFormSchema, type ResetPasswordFormValues } from "@/modules/auth/schemas/auth-schemas";
import { resetPassword } from "@/modules/auth/services/auth-service";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      token,
      newPassword: "",
      confirmPassword: "",
    },
  });
  const resetPasswordMutation = useMutation({
    mutationFn: resetPassword,
  });

  return (
    <AuthScreen
      eyebrow="Nova senha"
      title="Defina uma senha forte e siga em frente."
      description="O token de reset e temporario, de uso unico, e todas as sessoes ativas sao invalidadas apos a troca."
      showShowcase={false}
    >
      <Card className="rounded-[2rem] border-border/60 bg-card/94 shadow-2xl backdrop-blur">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl">Redefinir senha</CardTitle>
          <CardDescription className="text-sm leading-6">
            Escolha uma nova senha para restaurar o acesso com seguranca.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {!token ? (
            <Alert variant="destructive" className="rounded-2xl">
              <AlertDescription>O link de reset esta incompleto ou invalido.</AlertDescription>
            </Alert>
          ) : null}

          {resetPasswordMutation.isSuccess ? (
            <Alert className="rounded-2xl border-primary/20 bg-primary/5 text-foreground">
              <AlertDescription>{resetPasswordMutation.data.message}</AlertDescription>
            </Alert>
          ) : null}

          {resetPasswordMutation.isError ? (
            <Alert variant="destructive" className="rounded-2xl">
              <AlertDescription>{resetPasswordMutation.error.message}</AlertDescription>
            </Alert>
          ) : null}

          <Form {...form}>
            <form
              className="space-y-5"
              onSubmit={form.handleSubmit(async (values) => {
                await resetPasswordMutation.mutateAsync(values);
              })}
            >
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova senha</FormLabel>
                    <FormControl>
                      <PasswordField {...field} autoComplete="new-password" placeholder="Minimo de 8 caracteres" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar nova senha</FormLabel>
                    <FormControl>
                      <PasswordField {...field} autoComplete="new-password" placeholder="Repita a nova senha" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                className="h-12 w-full rounded-xl text-sm font-semibold"
                disabled={resetPasswordMutation.isPending || !token}
                type="submit"
              >
                {resetPasswordMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : null}
                Atualizar senha
              </Button>
            </form>
          </Form>

          <Link className="inline-flex text-sm font-medium text-primary hover:text-primary/80" to={appRoutes.login}>
            Voltar para login
          </Link>
        </CardContent>
      </Card>
    </AuthScreen>
  );
}
