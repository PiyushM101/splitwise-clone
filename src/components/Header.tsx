'use client'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Header() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setLoggedIn(!!session)

      if (session) {
        const { data } = await supabase
          .from('friendships')
          .select('id')
          .eq('friend_id', session.user.id)
          .eq('status', 'pending')

        setPendingCount(data?.length || 0)
      }
    }

    checkAuth()

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
            <a href="/friends" className="text-purple-600 hover:text-purple-800 relative">
              Friends
              {pendingCount > 0 && (
                <span className="absolute -top-2 -right-4 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                  {pendingCount}
                </span>
              )}
            </a>
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
