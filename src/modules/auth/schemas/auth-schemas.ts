import { z } from "zod";

export const loginFormSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
  password: z.string().min(1, "Informe sua senha."),
  rememberMe: z.boolean().default(false),
});

export const forgotPasswordFormSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
});

export const resetPasswordFormSchema = z
  .object({
    token: z.string().trim().min(1, "Token invalido."),
    newPassword: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
    confirmPassword: z.string().min(8, "Confirme a nova senha."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "As senhas precisam ser iguais.",
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordFormSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
