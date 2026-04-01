'use client'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import AuthGuard from '@/components/AuthGuard'

const CURRENCIES: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CNY: '¥',
  CAD: 'C$', AUD: 'A$', CHF: 'Fr', KRW: '₩', SGD: 'S$', HKD: 'HK$',
  NZD: 'NZ$', MXN: 'Mex$', BRL: 'R$', ARS: 'AR$', CLP: 'CL$',
  COP: 'COL$', PEN: 'S/.', ZAR: 'R', NGN: '₦', KES: 'KSh',
  EGP: 'E£', GHS: 'GH₵', MAD: 'MAD', AED: 'د.إ', SAR: '﷼',
  QAR: 'QR', KWD: 'KD', BHD: 'BD', OMR: 'OMR', ILS: '₪',
  TRY: '₺', RUB: '₽', PLN: 'zł', CZK: 'Kč', HUF: 'Ft',
  SEK: 'kr', NOK: 'kr', DKK: 'kr', RON: 'lei', BGN: 'лв',
  HRK: 'kn', THB: '฿', MYR: 'RM', IDR: 'Rp', PHP: '₱',
  VND: '₫', TWD: 'NT$', PKR: '₨', BDT: '৳', LKR: 'Rs', NPR: 'रू',
}

const getSymbol = (code: string) => CURRENCIES[code] || code

type FriendBalance = {
  userId: string
  name: string
  amounts: { currency: string; amount: number }[]
  lastActivity: string
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [groups, setGroups] = useState<any[]>([])
  const [youOwe, setYouOwe] = useState<{ currency: string; amount: number }[]>([])
  const [owedToYou, setOwedToYou] = useState<{ currency: string; amount: number }[]>([])
  const [friendBalances, setFriendBalances] = useState<FriendBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [friendSort, setFriendSort] = useState<'name' | 'recent' | 'highest' | 'owes_you'>('name')

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showAddMenu) setShowAddMenu(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showAddMenu])

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const currentUserId = session.user.id
      setUser(session.user)

      // Get groups
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', currentUserId)

      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map((m) => m.group_id)

        const { data: groupList } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds)
          .order('created_at', { ascending: false })

        setGroups(groupList || [])

        // Get all expenses in user's groups + non-group expenses
        const { data: groupExpenses } = await supabase
          .from('expenses')
          .select('*, expense_splits(user_id, amount_owed)')
          .in('group_id', groupIds)

        const { data: friendExpenses } = await supabase
          .from('expenses')
          .select('*, expense_splits(user_id, amount_owed)')
          .is('group_id', null)
          .or(`created_by.eq.${currentUserId},paid_by.eq.${currentUserId}`)

        const expenses = [...(groupExpenses || []), ...(friendExpenses || [])]

        // Get all settlements (group and non-group)
        const { data: settlements } = await supabase
          .from('settlements')
          .select('*')

        // Get all profiles for names
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')

        const nameMap: Record<string, string> = {}
        if (profiles) {
          for (const p of profiles) {
            nameMap[p.id] = p.name || p.email
          }
        }

        const netDebts: Record<string, Record<string, number>> = {}

        for (const expense of (expenses || [])) {
          const currency = expense.currency
          if (!netDebts[currency]) netDebts[currency] = {}
          const paidBy = expense.paid_by

          for (const split of expense.expense_splits || []) {
            if (split.user_id === paidBy) continue
            const amount = parseFloat(split.amount_owed)

            if (split.user_id === currentUserId) {
              if (!netDebts[currency][paidBy]) netDebts[currency][paidBy] = 0
              netDebts[currency][paidBy] += amount
            } else if (paidBy === currentUserId) {
              if (!netDebts[currency][split.user_id]) netDebts[currency][split.user_id] = 0
              netDebts[currency][split.user_id] -= amount
            }
          }
        }

        for (const settlement of (settlements || [])) {
          const currency = settlement.currency
          if (!netDebts[currency]) netDebts[currency] = {}
          const amount = parseFloat(settlement.amount)

          if (settlement.paid_by === currentUserId) {
            if (!netDebts[currency][settlement.paid_to]) netDebts[currency][settlement.paid_to] = 0
            netDebts[currency][settlement.paid_to] -= amount
          } else if (settlement.paid_to === currentUserId) {
            if (!netDebts[currency][settlement.paid_by]) netDebts[currency][settlement.paid_by] = 0
            netDebts[currency][settlement.paid_by] += amount
          }
        }

        const oweMap: Record<string, number> = {}
        const owedMap: Record<string, number> = {}
        const friendMap: Record<string, { currency: string; amount: number }[]> = {}

        for (const currency of Object.keys(netDebts)) {
          for (const [personId, net] of Object.entries(netDebts[currency])) {
            const rounded = Math.round(net * 100) / 100
            if (rounded === 0) continue

            if (!friendMap[personId]) friendMap[personId] = []

            if (rounded > 0) {
              if (!oweMap[currency]) oweMap[currency] = 0
              oweMap[currency] += rounded
              friendMap[personId].push({ currency, amount: rounded })
            } else {
              if (!owedMap[currency]) owedMap[currency] = 0
              owedMap[currency] += Math.abs(rounded)
              friendMap[personId].push({ currency, amount: rounded })
            }
          }
        }

        setYouOwe(Object.entries(oweMap).map(([currency, amount]) => ({ currency, amount })))
        setOwedToYou(Object.entries(owedMap).map(([currency, amount]) => ({ currency, amount })))

        // Build last activity map per friend
        const lastActivityMap: Record<string, string> = {}
        for (const expense of expenses) {
          for (const split of expense.expense_splits || []) {
            const otherId = split.user_id === currentUserId ? expense.paid_by : split.user_id
            if (otherId === currentUserId) continue
            if (!lastActivityMap[otherId] || expense.created_at > lastActivityMap[otherId]) {
              lastActivityMap[otherId] = expense.created_at
            }
          }
        }
        for (const settlement of (settlements || [])) {
          const otherId = settlement.paid_by === currentUserId ? settlement.paid_to : settlement.paid_by
          if (!lastActivityMap[otherId] || settlement.created_at > lastActivityMap[otherId]) {
            lastActivityMap[otherId] = settlement.created_at
          }
        }

        const friends: FriendBalance[] = Object.entries(friendMap)
          .filter(([, amounts]) => amounts.some((a) => Math.abs(a.amount) > 0))
          .map(([userId, amounts]) => ({
            userId,
            name: nameMap[userId] || 'Unknown',
            amounts,
            lastActivity: lastActivityMap[userId] || '1970-01-01',
          }))

        setFriendBalances(friends)
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
          <div className="flex gap-2">
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowAddMenu(!showAddMenu) }}
                className="bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-800"
              >
                + Add Expense
              </button>
              {showAddMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  {groups.length > 0 && (
                    <div>
                      <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase">Groups</p>
                      {groups.map((group) => (
                        <a
                          key={group.id}
                          href={`/groups/${group.id}/new`}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700"
                        >
                          {group.name}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-gray-100">
                    <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase">Friends</p>
                    <a
                      href="/expenses/new"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700"
                    >
                      + Add with a friend
                    </a>
                  </div>
                  <div className="border-t border-gray-100">
                    <a
                      href="/groups/new"
                      className="block px-4 py-2 text-sm text-purple-600 hover:bg-purple-50"
                    >
                      + Create new group
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-gray-600 mb-6">
          Welcome, {user?.user_metadata?.name || user?.email}!
        </p>

        {/* Overall Balance Summary */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="border border-gray-200 rounded p-4">
            <p className="text-sm text-gray-500 mb-2">You owe</p>
            {youOwe.length === 0 ? (
              <p className="text-lg font-bold text-gray-300">Nothing</p>
            ) : (
              youOwe.map((o) => (
                <p key={o.currency} className="text-lg font-bold text-red-500">
                  {getSymbol(o.currency)}{o.amount.toFixed(2)}
                </p>
              ))
            )}
          </div>
          <div className="border border-gray-200 rounded p-4">
            <p className="text-sm text-gray-500 mb-2">You are owed</p>
            {owedToYou.length === 0 ? (
              <p className="text-lg font-bold text-gray-300">Nothing</p>
            ) : (
              owedToYou.map((o) => (
                <p key={o.currency} className="text-lg font-bold text-green-600">
                  {getSymbol(o.currency)}{o.amount.toFixed(2)}
                </p>
              ))
            )}
          </div>
        </div>

        {/* Friend Balances */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-700">Friend Balances</h2>
          {friendBalances.length > 1 && (
            <select
              value={friendSort}
              onChange={(e) => setFriendSort(e.target.value as any)}
              className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="name">Name (A-Z)</option>
              <option value="recent">Most recent</option>
              <option value="highest">Highest amount</option>
              <option value="owes_you">Owes you most</option>
            </select>
          )}
        </div>
        {(() => {
          const sorted = [...friendBalances].sort((a, b) => {
            if (friendSort === 'name') {
              return a.name.localeCompare(b.name)
            }
            if (friendSort === 'recent') {
              return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
            }
            if (friendSort === 'highest') {
              const totalA = a.amounts.reduce((acc, x) => acc + Math.abs(x.amount), 0)
              const totalB = b.amounts.reduce((acc, x) => acc + Math.abs(x.amount), 0)
              return totalB - totalA
            }
            if (friendSort === 'owes_you') {
              const owedA = a.amounts.reduce((acc, x) => acc + (x.amount < 0 ? Math.abs(x.amount) : 0), 0)
              const owedB = b.amounts.reduce((acc, x) => acc + (x.amount < 0 ? Math.abs(x.amount) : 0), 0)
              return owedB - owedA
            }
            return 0
          })

          if (sorted.length === 0) {
            return <p className="text-gray-400 text-sm mb-8">No balances yet.</p>
          }

          return (
            <ul className="space-y-2 mb-8">
              {sorted.map((friend) => (
                <li key={friend.userId} className="border border-gray-200 rounded p-3 flex justify-between items-center">
                  <a href={`/friends/${friend.userId}`} className="font-medium text-purple-700 hover:underline">{friend.name}</a>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      {friend.amounts.map((a) => (
                        <p
                          key={a.currency}
                          className={`text-sm font-bold ${a.amount > 0 ? 'text-red-500' : 'text-green-600'}`}
                        >
                          {a.amount > 0
                            ? `You owe ${getSymbol(a.currency)}${a.amount.toFixed(2)}`
                            : `Owes you ${getSymbol(a.currency)}${Math.abs(a.amount).toFixed(2)}`
                          }
                        </p>
                      ))}
                    </div>
                    {friend.amounts.map((a) => (
                      <a
                        key={`settle-${a.currency}`}
                        href={`/friends/${friend.userId}/settle?from=${a.amount > 0 ? 'me' : friend.userId}&to=${a.amount > 0 ? friend.userId : 'me'}&fromName=${a.amount > 0 ? encodeURIComponent(user?.user_metadata?.name || user?.email || 'Me') : encodeURIComponent(friend.name)}&toName=${a.amount > 0 ? encodeURIComponent(friend.name) : encodeURIComponent(user?.user_metadata?.name || user?.email || 'Me')}&amount=${Math.abs(a.amount).toFixed(2)}&currency=${a.currency}`}
                        className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                      >
                        Settle Up
                      </a>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )
        })()}

        {/* Groups */}
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

