import type { NextConfig } from "next";

const config: NextConfig = {
  // Módulo nativo: roda direto no Node, sem empacotar
  serverExternalPackages: ["@node-rs/argon2"],
  poweredByHeader: false,
  // Endereços antigos da gestão
  async redirects() {
    return [
      { source: "/gestao/usuarios", destination: "/admin/usuarios", permanent: false },
      { source: "/gestao/notificacoes", destination: "/admin/emails", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default config;
