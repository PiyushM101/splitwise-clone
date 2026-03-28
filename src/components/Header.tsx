'use client'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Header() {
  const [loggedIn, setLoggedIn] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session)
    })

    return () => { listener.subscription.unsubscribe() }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="border-b px-6 py-4 flex justify-between items-center">
      <a href="/" className="text-xl font-bold text-purple-700">Splitwise Clone</a>
      <nav className="space-x-4">
        {loggedIn ? (
          <>
            <a href="/dashboard" className="text-purple-600 hover:text-purple-800">Dashboard</a>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-500"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <a href="/login" className="text-purple-600 hover:text-purple-800">Login</a>
            <a href="/signup" className="bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-800">Sign Up</a>
          </>
        )}
      </nav>
    </header>
  )
}
