"use client";

import { useFormState } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginState = {
  error?: string;
};

type LoginFormProps = {
  loginAction: (state: LoginState, formData: FormData) => Promise<LoginState>;
  defaultError?: string;
};

export function LoginForm({ loginAction, defaultError }: LoginFormProps) {
  const [state, formAction] = useFormState(loginAction, { error: defaultError });

  return (
    <Card className="w-full max-w-md">
      <form action={formAction} noValidate>
        <CardHeader>
          <CardTitle>管理员登录</CardTitle>
          <CardDescription>请输入管理账户凭证访问后台。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input id="username" name="username" type="text" autoComplete="username" placeholder="admin" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {state?.error && <Alert>{state.error}</Alert>}
        </CardContent>
        <CardFooter>
          <Button className="w-full" type="submit">
            登录
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
