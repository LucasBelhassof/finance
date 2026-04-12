export interface AuthUser {
  id: number | string;
  name: string;
  email: string;
}

export interface AuthSessionPayload {
  user: AuthUser;
  accessToken: string;
  expiresAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ForgotPasswordResult {
  message: string;
  debugResetUrl?: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export type AuthStatus = "loading" | "authenticated" | "anonymous";
