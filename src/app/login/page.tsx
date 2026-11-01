'use client'
import { supabase } from '@/lib/supabase'
import { normalizeUsername } from '@/lib/username'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Supabase signs in with an email, so a username has to be resolved to one
  // first. Anything containing '@' is treated as an email already, which keeps
  // existing accounts working while everyone picks a username.
  const resolveEmail = async (value: string) => {
    if (value.includes('@')) return value.trim()

    const { data, error } = await supabase.rpc('get_login_email', {
      p_username: normalizeUsername(value),
    })

    if (error) throw error

    return data as string | null
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    let email: string | null
    try {
      email = await resolveEmail(identifier)
    } catch {
      setError('Could not reach the server. Try again.')
      setLoading(false)
      return
    }

    if (!email) {
      setError('Invalid login credentials')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-2xl font-bold text-purple-700 mb-6">Log In</h1>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <p className="text-xs text-gray-400 mt-1">You can still use your email address.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-700 text-white py-2 rounded hover:bg-purple-800 disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-500">
        Don't have an account?{' '}
        <a href="/signup" className="text-purple-600 hover:underline">Sign up</a>
      </p>
    </div>
  )
}
