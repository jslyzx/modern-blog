import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { verifyPassword } from "@/lib/auth";
import { findAdminByUsername } from "@/lib/users";

const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, { message: "Username is required" }),
  password: z.string().min(1, { message: "Password is required" }),
});

const authConfig = {
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/admin/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: {
          label: "Username",
          type: "text",
          placeholder: "admin",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const { username, password } = parsed.data;

        let user;

        try {
          user = await findAdminByUsername(username);
        } catch (error) {
          console.error("Failed to look up admin user", error);
          throw new Error("Unable to sign in at this time. Please try again later.");
        }

        if (!user) {
          return null;
        }

        const isValid = await verifyPassword(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        return {
          id: String(user.id),
          email: user.email ?? undefined,
          name: user.username,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string | undefined;
      }

      return session;
    },
  },
  debug: process.env.NODE_ENV !== "production",
} satisfies NextAuthConfig;

export const authOptions = authConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
