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
          <CardTitle>Admin login</CardTitle>
          <CardDescription>Access the administrative interface using your credentials.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="admin@example.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {state?.error && <Alert>{state.error}</Alert>}
        </CardContent>
        <CardFooter>
          <Button className="w-full" type="submit">
            Sign in
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
