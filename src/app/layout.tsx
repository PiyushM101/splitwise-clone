import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Splitwise Clone',
  description: 'Split expenses with friends',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white text-gray-900 min-h-screen`}>
        <header className="border-b px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-purple-700">Splitwise Clone</h1>
          <nav className="space-x-4">
            <a href="/login" className="text-purple-600 hover:text-purple-800">Login</a>
            <a href="/signup" className="bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-800">Sign Up</a>
          </nav>
        </header>
        <main className="max-w-4xl mx-auto p-6">
          {children}
        </main>
      </body>
    </html>
  )
}
