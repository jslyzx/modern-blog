import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { LoginForm } from "./login-form";
import { auth, signIn } from "@/auth";

interface LoginPageProps {
  searchParams?: Record<string, string | string[]>;
}

export const metadata = {
  title: "管理后台登录",
};

type LoginState = {
  error?: string;
};

const errorMessages: Record<string, string> = {
  CredentialsSignin: "用户名或密码错误。",
  SessionRequired: "请先登录后继续。",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();

  if (session?.user) {
    redirect("/admin");
  }

  const callbackUrlParam = searchParams?.callbackUrl;
  const callbackUrlRaw = Array.isArray(callbackUrlParam) ? callbackUrlParam[0] : callbackUrlParam;
  const callbackUrl = callbackUrlRaw && callbackUrlRaw.startsWith("/") && !callbackUrlRaw.startsWith("//") ? callbackUrlRaw : undefined;
  const errorParam = searchParams?.error;
  const defaultError = typeof errorParam === "string" ? errorMessages[errorParam] ?? "登录失败。" : undefined;

  async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
    "use server";

    const username = (formData.get("username") ?? "").toString().trim();
    const password = (formData.get("password") ?? "").toString();

    if (!username || !password) {
      return { error: "请输入用户名和密码。" };
    }

    try {
      await signIn("credentials", {
        username,
        password,
        redirectTo: callbackUrl ?? "/admin",
      });

      return { error: undefined };
    } catch (error) {
      if (error instanceof AuthError) {
        if (error.type === "CredentialsSignin") {
          return { error: "用户名或密码错误。" };
        }

        return { error: "登录失败，请重试。" };
      }

      throw error;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-16">
      <LoginForm loginAction={loginAction} defaultError={defaultError} />
    </div>
  );
}
