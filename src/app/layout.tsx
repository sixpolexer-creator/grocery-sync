import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ToastProvider } from '@/components/Toast'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = {
  title: 'קניות | GrocerySync',
  description: 'קניות משותפות בזמן אמת',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
