import type { Metadata } from "next"
import { Roboto } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const roboto = Roboto({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
})

export const metadata: Metadata = {
  title: "GymOS",
  description: "Gestión profesional para tu gimnasio",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${roboto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
