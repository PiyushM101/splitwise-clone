'use client'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthGuard from '@/components/AuthGuard'

export default function NewGroup() {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setLoading(false)
      return
    }

    // Create the group
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({ name, created_by: session.user.id })
      .select()
      .single()

    if (groupError) {
      setError(groupError.message)
      setLoading(false)
      return
    }

    // Add creator as first member
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: session.user.id })

    if (memberError) {
      setError(memberError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <AuthGuard>
      <div className="max-w-md mx-auto mt-12">
        <h1 className="text-2xl font-bold text-purple-700 mb-6">Create a Group</h1>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apartment, Trip to Paris"
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
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </form>
      </div>
    </AuthGuard>
  )
}
