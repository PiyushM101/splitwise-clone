'use client'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import AuthGuard from '@/components/AuthGuard'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }

      setUser(session.user)

      // Get group IDs the user belongs to
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', session.user.id)

      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map((m) => m.group_id)

        const { data: groupList } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds)
          .order('created_at', { ascending: false })

        setGroups(groupList || [])
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  return (
    <AuthGuard>
      <div>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-purple-700">Dashboard</h1>
          <a
            href="/groups/new"
            className="bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-800"
          >
            + New Group
          </a>
        </div>

        <p className="text-gray-600 mb-6">
          Welcome, {user?.user_metadata?.name || user?.email}!
        </p>

        <h2 className="text-lg font-semibold text-gray-700 mb-4">Your Groups</h2>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : groups.length === 0 ? (
          <p className="text-gray-400">No groups yet. Create one to get started!</p>
        ) : (
          <ul className="space-y-3">
            {groups.map((group) => (
              <li key={group.id}>
                <a
                  href={`/groups/${group.id}`}
                  className="block border border-gray-200 rounded p-4 hover:border-purple-400 hover:bg-purple-50"
                >
                  <span className="text-purple-700 font-medium">{group.name}</span>
                  <span className="text-gray-400 text-sm ml-2">
                    Created {new Date(group.created_at).toLocaleDateString()}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AuthGuard>
  )
}
