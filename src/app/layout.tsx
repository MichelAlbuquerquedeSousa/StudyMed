import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { PwaRegister } from "@/components/pwa/pwa";
import { PRE_PAINT_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["SOFT", "opsz"] });

export const metadata: Metadata = {
  title: { default: "StudyMed", template: "%s · StudyMed" },
  description: "Planner acadêmico pessoal para a rotina da faculdade de Medicina.",
  applicationName: "StudyMed",
  appleWebApp: { capable: true, title: "StudyMed", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbf8fa",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning className={`${jakarta.variable} ${fraunces.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
