import { DefaultSession } from "next-auth";
import { RolUsuario } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      rol: RolUsuario;
      proveedorRestrictoId: number | null;
    } & DefaultSession["user"];
  }

  interface User {
    rol: RolUsuario;
    proveedorRestrictoId: number | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    rol?: RolUsuario;
    proveedorRestrictoId?: number | null;
  }
}
