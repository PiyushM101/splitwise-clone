'use client'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import AuthGuard from '@/components/AuthGuard'

export default function FriendsPage() {
  const [currentUserId, setCurrentUserId] = useState('')
  const [friends, setFriends] = useState<any[]>([])
  const [incoming, setIncoming] = useState<any[]>([])
  const [outgoing, setOutgoing] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showResults, setShowResults] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchFriendships = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const userId = session.user.id
    setCurrentUserId(userId)

    const { data: allFriendships } = await supabase
      .from('friendships')
      .select('*, user:profiles!user_id(id, name, email), friend:profiles!friend_id(id, name, email)')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)

    const accepted: any[] = []
    const incomingReqs: any[] = []
    const outgoingReqs: any[] = []

    for (const f of (allFriendships || [])) {
      if (f.status === 'accepted') {
        const other = f.user_id === userId ? f.friend : f.user
        accepted.push(other)
      } else if (f.status === 'pending') {
        if (f.friend_id === userId) {
          incomingReqs.push(f)
        } else {
          outgoingReqs.push(f)
        }
      }
    }

    setFriends(accepted)
    setIncoming(incomingReqs)
    setOutgoing(outgoingReqs)
    setLoading(false)
  }

  useEffect(() => {
    fetchFriendships()
  }, [])

  useEffect(() => {
    const search = async () => {
      if (searchQuery.length < 3) {
        setSearchResults([])
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data } = await supabase
        .from('profiles')
        .select('id, name, email')
        .neq('id', session.user.id)
        .or(`email.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
        .limit(5)

      const friendIds = friends.map((f) => f.id)
      const incomingIds = incoming.map((f) => f.user_id)
      const outgoingIds = outgoing.map((f) => f.friend_id)
      const excludeIds = [...friendIds, ...incomingIds, ...outgoingIds]

      const filtered = (data || []).filter((p) => !excludeIds.includes(p.id))
      setSearchResults(filtered)
      setShowResults(true)
    }

    const timer = setTimeout(search, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, friends, incoming, outgoing])

  const sendRequest = async (friendId: string) => {
    setError('')
    setSuccess('')

    const { error: reqError } = await supabase
      .from('friendships')
      .insert({ user_id: currentUserId, friend_id: friendId, status: 'pending' })

    if (reqError) {
      setError(reqError.message)
      return
    }

    setSuccess('Friend request sent!')
    setSearchQuery('')
    setShowResults(false)
    fetchFriendships()
  }

  const acceptRequest = async (friendshipId: string) => {
    setError('')
    setSuccess('')

    const { error: acceptError } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)

    if (acceptError) {
      setError(acceptError.message)
      return
    }

    setSuccess('Friend request accepted!')
    fetchFriendships()
  }

  const rejectRequest = async (friendshipId: string) => {
    setError('')

    const { error: rejectError } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)

    if (rejectError) {
      setError(rejectError.message)
      return
    }

    fetchFriendships()
  }

  const removeFriend = async (friendId: string) => {
    if (!window.confirm('Remove this friend?')) return

    await supabase
      .from('friendships')
      .delete()
      .or(`and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`)

    fetchFriendships()
  }

  if (loading) return <p className="p-8">Loading...</p>

  return (
    <AuthGuard>
      <div>
        <a href="/dashboard" className="text-purple-600 hover:underline text-sm">&larr; Back to Dashboard</a>

        <h1 className="text-2xl font-bold text-purple-700 mt-4 mb-6">Friends</h1>

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Add a Friend</h2>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowResults(true) }}
              placeholder="Search by name or email (min 3 characters)"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                {searchResults.map((person) => (
                  <div
                    key={person.id}
                    className="flex justify-between items-center px-4 py-3 hover:bg-purple-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{person.name}</p>
                      <p className="text-xs text-gray-400">{person.email}</p>
                    </div>
                    <button
                      onClick={() => sendRequest(person.id)}
                      className="text-xs bg-purple-700 text-white px-3 py-1 rounded hover:bg-purple-800"
                    >
                      Add Friend
                    </button>
                  </div>
                ))}
              </div>
            )}
            {showResults && searchResults.length === 0 && searchQuery.length >= 3 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
                <p className="text-sm text-gray-400">No users found.</p>
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          {success && <p className="text-purple-500 text-sm mt-2">{success}</p>}
        </div>

        {incoming.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              Friend Requests
              <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {incoming.length}
              </span>
            </h2>
            <ul className="space-y-2">
              {incoming.map((req) => (
                <li key={req.id} className="border border-purple-200 bg-purple-50 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-800">{req.user?.name}</p>
                    <p className="text-xs text-gray-400">{req.user?.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptRequest(req.id)}
                      className="text-xs bg-purple-700 text-white px-3 py-1 rounded hover:bg-purple-800"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => rejectRequest(req.id)}
                      className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded hover:bg-gray-200"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {outgoing.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Pending Requests</h2>
            <ul className="space-y-2">
              {outgoing.map((req) => (
                <li key={req.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-800">{req.friend?.name}</p>
                    <p className="text-xs text-gray-400">{req.friend?.email}</p>
                  </div>
                  <span className="text-xs text-gray-400">Pending</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Your Friends ({friends.length})</h2>
          {friends.length === 0 ? (
            <p className="text-gray-400 text-sm">No friends yet. Search above to add someone!</p>
          ) : (
            <ul className="space-y-2">
              {friends.map((friend) => (
                <li key={friend.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                  <a href={`/friends/${friend.id}`} className="hover:text-purple-700">
                    <p className="font-medium text-gray-800">{friend.name}</p>
                    <p className="text-xs text-gray-400">{friend.email}</p>
                  </a>
                  <button
                    onClick={() => removeFriend(friend.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
