import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

const USUARIOS = [
  {
    nombre: "Daniel",
    apellido: "Berezovsky",
    email: "danielbere@estacionmascotera.com.ar",
    password: "Cokec0k3@",
  },
  {
    nombre: "Pablo",
    apellido: "Fernandez",
    email: "pablo.fernandez@estacionmascotera.com.ar",
    password: "Hsbc9510",
  },
  {
    nombre: "Sistema",
    apellido: "Tiendanube",
    email: "sistema-tiendanube@estacionmascotera.com.ar",
    password: crypto.randomBytes(32).toString("hex"),
  },
];

async function main() {
  for (const u of USUARIOS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: {
        nombre: u.nombre,
        apellido: u.apellido,
        email: u.email,
        passwordHash,
      },
    });
    console.log(`Usuario listo: ${u.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
