import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Conflex · Não conformidades", template: "%s · Conflex Não conformidades" },
  description: "Registro e melhoria de processos da Conflex Assessoria Contábil",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#384c77",
};

// Aplica o tema escolhido antes da primeira pintura, sem piscar.
const scriptTema = `try{var t=localStorage.getItem("rnc-tema");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
