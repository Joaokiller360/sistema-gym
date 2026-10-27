import type { Metadata } from "next"
import { Archivo, JetBrains_Mono, Roboto } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/providers/ThemeProvider"
import { ThemeScript } from "@/components/providers/ThemeScript"
import { apiFetch } from "@/lib/api"
import { normalizeLogoUrl } from "@/lib/utils"
import "./globals.css"

const roboto = Roboto({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
})

// Admin panel typefaces — declared here so portaled dialogs can use them too.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  preload: false,
})

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["500", "700"],
  preload: false,
})

interface PlatformSettings { saasName?: string; logoUrl?: string | null }

// The uploaded platform logo is the browser tab icon; favicon.ico is the fallback.
export async function generateMetadata(): Promise<Metadata> {
  const platform = await apiFetch<PlatformSettings>("/platform-settings", "", {
    next: { tags: ["platform-settings"], revalidate: 300 },
    silent: true,
  }).catch(() => null)
  const logo = normalizeLogoUrl(platform?.logoUrl)
  return {
    title: platform?.saasName ?? "GymOS",
    description: "Gestión profesional para tu gimnasio",
    icons: logo ? { icon: logo, apple: logo } : { icon: "/favicon.ico" },
  }
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${roboto.variable} ${archivo.variable} ${jetbrains.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
