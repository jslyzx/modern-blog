import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { LoginForm } from "./login-form";
import { auth, signIn } from "@/auth";

interface LoginPageProps {
  searchParams?: Record<string, string | string[]>;
}

export const metadata = {
  title: "Admin login",
};

type LoginState = {
  error?: string;
};

const errorMessages: Record<string, string> = {
  CredentialsSignin: "Invalid email or password.",
  SessionRequired: "Please sign in to continue.",
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
  const defaultError = typeof errorParam === "string" ? errorMessages[errorParam] ?? "Authentication failed." : undefined;

  async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
    "use server";

    const email = (formData.get("email") ?? "").toString().trim();
    const password = (formData.get("password") ?? "").toString();

    if (!email || !password) {
      return { error: "Please provide your email and password." };
    }

    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: callbackUrl ?? "/admin",
      });

      return { error: undefined };
    } catch (error) {
      if (error instanceof AuthError) {
        if (error.type === "CredentialsSignin") {
          return { error: "Invalid email or password." };
        }

        return { error: "Authentication failed. Please try again." };
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
