import type { Metadata } from "next"
import { Sidebar } from "@/components/layout/sidebar"
import { I18nProvider } from "@/lib/i18n"
import "./globals.css"

export const metadata: Metadata = {
  title: "AI资产备份",
  description: "本地备份与恢复工具",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="cn" suppressHydrationWarning>
      <body className="antialiased">
        <I18nProvider>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto bg-background p-6">
              {children}
            </main>
          </div>
        </I18nProvider>
      </body>
    </html>
  )
}
