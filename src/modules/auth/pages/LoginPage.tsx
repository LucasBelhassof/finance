import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { appRoutes } from "@/lib/routes";
import { AuthScreen } from "@/modules/auth/components/AuthScreen";
import { PasswordField } from "@/modules/auth/components/PasswordField";
import { useLogin } from "@/modules/auth/hooks/use-login";
import { loginFormSchema, type LoginFormValues } from "@/modules/auth/schemas/auth-schemas";

export default function LoginPage() {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });
  const loginMutation = useLogin();

  return (
    <AuthScreen
      eyebrow="Finance Auth"
      title="Entre na sua area segura."
      description="Acesse dashboard, contas e automacoes com sessao protegida e refresh transparente."
    >
      <Card className="overflow-hidden rounded-[2rem] border-border/60 bg-card/94 shadow-2xl backdrop-blur">
        <CardHeader className="space-y-3 pb-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
            F
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl">Login</CardTitle>
            <CardDescription className="text-sm leading-6">
              Use seu e-mail e senha para continuar. Seu access token fica apenas em memoria.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {loginMutation.isError ? (
            <Alert variant="destructive" className="rounded-2xl">
              <AlertDescription>{loginMutation.error.message}</AlertDescription>
            </Alert>
          ) : null}

          <Form {...form}>
            <form
              className="space-y-5"
              onSubmit={form.handleSubmit(async (values) => {
                await loginMutation.mutateAsync(values);
              })}
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        autoComplete="email"
                        placeholder="voce@empresa.com"
                        className="h-12 rounded-xl border-border/70 bg-background/80"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <PasswordField {...field} autoComplete="current-password" placeholder="Sua senha" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-2xl border border-border/60 bg-secondary/30 px-4 py-3">
                    <div className="space-y-1">
                      <FormLabel className="text-sm font-medium text-foreground">Lembrar de mim</FormLabel>
                      <p className="text-sm text-muted-foreground">Mantem a sessao ativa por mais tempo sem salvar sua senha.</p>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(event) => field.onChange(event.target.checked)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Sessao segura com refresh rotativo.</span>
                <Link className="font-medium text-primary hover:text-primary/80" to={appRoutes.forgotPassword}>
                  Esqueci minha senha
                </Link>
              </div>

              <Button className="h-12 w-full rounded-xl text-sm font-semibold" disabled={loginMutation.isPending} type="submit">
                {loginMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : null}
                Entrar
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AuthScreen>
  );
}
