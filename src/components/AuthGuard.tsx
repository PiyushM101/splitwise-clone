'use client'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Accounts that predate usernames have to pick one before going further.
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .single()

      if (!profile?.username) {
        router.push('/onboarding/username')
        return
      }

      setLoading(false)
    }

    check()
  }, [router])

  if (loading) return <p className="p-8">Loading...</p>

  return <>{children}</>
}
