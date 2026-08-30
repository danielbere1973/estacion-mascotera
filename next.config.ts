import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // El módulo Marketing permite pegar imágenes en el cuerpo del mail,
      // que quedan embebidas como base64 dentro del HTML — eso puede
      // superar fácil el límite de 1mb por defecto de los Server Actions.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
