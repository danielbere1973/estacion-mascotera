import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rol = user.rol;
        token.proveedorRestrictoId = user.proveedorRestrictoId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.rol = token.rol ?? "ADMIN";
        session.user.proveedorRestrictoId = token.proveedorRestrictoId ?? null;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
