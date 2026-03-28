'use client'
import { supabase } from '@/lib/supabase'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import AuthGuard from '@/components/AuthGuard'

export default function GroupDetail() {
  const params = useParams()
  const groupId = params.id as string

  const [group, setGroup] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchGroup = useCallback(async () => {
    const { data: groupData } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single()

    setGroup(groupData)

    const { data: memberData } = await supabase
      .from('group_members')
      .select('user_id, joined_at, profiles(name, email)')
      .eq('group_id', groupId)

    setMembers(memberData || [])
    setLoading(false)
  }, [groupId])

  useEffect(() => {
    fetchGroup()
  }, [fetchGroup])

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Find the user by email
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', newEmail)
      .single()

    if (!profile) {
      setError('No user found with that email.')
      return
    }

    // Check if already a member
    const alreadyMember = members.some((m) => m.user_id === profile.id)
    if (alreadyMember) {
      setError('This person is already in the group.')
      return
    }

    // Add them
    const { error: addError } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: profile.id })

    if (addError) {
      setError(addError.message)
      return
    }

    setSuccess(`Added ${profile.email} to the group!`)
    setNewEmail('')
    fetchGroup()
  }

  if (loading) return <p className="p-8">Loading...</p>
  if (!group) return <p className="p-8">Group not found.</p>

  return (
    <AuthGuard>
      <div>
        <a href="/dashboard" className="text-purple-600 hover:underline text-sm">&larr; Back to Dashboard</a>

        <h1 className="text-2xl font-bold text-purple-700 mt-4 mb-6">{group.name}</h1>

        {/* Members list */}
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Members</h2>
        <ul className="space-y-2 mb-8">
          {members.map((member) => (
            <li
              key={member.user_id}
              className="border border-gray-200 rounded p-3 flex justify-between items-center"
            >
              <div>
                <span className="font-medium text-gray-800">
                  {(member.profiles as any)?.name || 'Unknown'}
                </span>
                <span className="text-gray-400 text-sm ml-2">
                  {(member.profiles as any)?.email}
                </span>
              </div>
            </li>
          ))}
        </ul>

        {/* Add member form */}
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Add a Member</h2>
        <form onSubmit={handleAddMember} className="flex gap-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Enter their email"
            required
            className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="submit"
            className="bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-800"
          >
            Add
          </button>
        </form>

        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        {success && <p className="text-green-600 text-sm mt-2">{success}</p>}

        {/* Placeholder for expenses */}
        <div className="mt-10 pt-6 border-t">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Expenses</h2>
          <p className="text-gray-400 text-sm">No expenses yet. We&apos;ll add this in Phase 4.</p>
        </div>
      </div>
    </AuthGuard>
  )
}
