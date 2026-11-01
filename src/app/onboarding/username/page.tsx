'use client'
import { supabase } from '@/lib/supabase'
import { USERNAME_RULES, isUsernameTaken, normalizeUsername, validateUsername } from '@/lib/username'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Accounts created before usernames existed have to pick one here before they
// can use the app. Deliberately not wrapped in AuthGuard: the guard is what
// sends people to this page, so wrapping it would loop.
export default function PickUsername() {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .single()

      if (profile?.username) {
        router.push('/dashboard')
        return
      }

      setChecking(false)
    }

    check()
  }, [router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const invalid = validateUsername(username)
    if (invalid) {
      setError(invalid)
      setSaving(false)
      return
    }

    if (await isUsernameTaken(username)) {
      setError('That username is taken. Try another.')
      setSaving(false)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ username: normalizeUsername(username) })
      .eq('id', session.user.id)

    if (updateError) {
      // 23505 is the unique index firing when someone claimed it in between.
      setError(updateError.code === '23505' ? 'That username is taken. Try another.' : updateError.message)
      setSaving(false)
      return
    }

    router.push('/dashboard')
  }

  if (checking) return <p className="p-8">Loading...</p>

  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-2xl font-bold text-purple-700 mb-2">Pick a username</h1>
      <p className="text-gray-600 mb-6">
        Spendly now uses usernames instead of email addresses. Choose one to carry on — this is how friends will find you.
      </p>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="e.g. piyush_m"
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <p className="text-xs text-gray-400 mt-1">{USERNAME_RULES}</p>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-purple-700 text-white py-2 rounded hover:bg-purple-800 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
