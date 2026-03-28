'use client'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import AuthGuard from '@/components/AuthGuard'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUser(session.user)
    })
  }, [])

  return (
    <AuthGuard>
      <div>
        <h1 className="text-2xl font-bold text-purple-700 mb-8">Dashboard</h1>
        <p className="text-gray-600">
          Welcome, {user?.user_metadata?.name || user?.email}!
        </p>
        <p className="mt-4 text-gray-400 text-sm">
          Your groups and balances will show up here soon.
        </p>
      </div>
    </AuthGuard>
  )
}
