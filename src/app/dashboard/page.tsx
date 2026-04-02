'use client'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import AuthGuard from '@/components/AuthGuard'
import { getCategoryEmoji } from '@/lib/categories'

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
  const [friendSort, setFriendSort] = useState<'name' | 'recent' | 'highest' | 'owes_you'>('name')
  const [groupSort, setGroupSort] = useState<'name' | 'created' | 'activity'>('activity')
  const [groupActivity, setGroupActivity] = useState<Record<string, string>>({})
  const [groupBalances, setGroupBalances] = useState<Record<string, { currency: string; amount: number }[]>>({})
  const [showAddMenu, setShowAddMenu] = useState(false)

  // Analytics state
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview')
  const [timeView, setTimeView] = useState<'daily' | 'weekly' | 'monthly'>('monthly')
  const [timeRange, setTimeRange] = useState<'all' | '3m' | '6m' | '1y'>('all')
  const [allExpenses, setAllExpenses] = useState<any[]>([])

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

        // Group activity
        const activityMap: Record<string, string> = {}
        for (const gId of groupIds) activityMap[gId] = '1970-01-01'

        const { data: groupExpenseActivity } = await supabase
          .from('expenses')
          .select('group_id, created_at')
          .in('group_id', groupIds)
          .order('created_at', { ascending: false })

        for (const e of (groupExpenseActivity || [])) {
          if (e.group_id && (!activityMap[e.group_id] || e.created_at > activityMap[e.group_id])) {
            activityMap[e.group_id] = e.created_at
          }
        }

        const { data: groupSettlementActivity } = await supabase
          .from('settlements')
          .select('group_id, created_at')
          .in('group_id', groupIds)
          .order('created_at', { ascending: false })

        for (const s of (groupSettlementActivity || [])) {
          if (s.group_id && (!activityMap[s.group_id] || s.created_at > activityMap[s.group_id])) {
            activityMap[s.group_id] = s.created_at
          }
        }

        setGroupActivity(activityMap)

        // Group balances
        const groupBalanceMap: Record<string, Record<string, number>> = {}

        const { data: allGroupExpenses } = await supabase
          .from('expenses')
          .select('group_id, currency, paid_by, expense_splits(user_id, amount_owed)')
          .in('group_id', groupIds)

        for (const expense of (allGroupExpenses || [])) {
          const gId = expense.group_id
          if (!gId) continue
          if (!groupBalanceMap[gId]) groupBalanceMap[gId] = {}

          for (const split of expense.expense_splits || []) {
            if (split.user_id === expense.paid_by) continue
            if (split.user_id === currentUserId) {
              if (!groupBalanceMap[gId][expense.currency]) groupBalanceMap[gId][expense.currency] = 0
              groupBalanceMap[gId][expense.currency] += parseFloat(split.amount_owed)
            } else if (expense.paid_by === currentUserId) {
              if (!groupBalanceMap[gId][expense.currency]) groupBalanceMap[gId][expense.currency] = 0
              groupBalanceMap[gId][expense.currency] -= parseFloat(split.amount_owed)
            }
          }
        }

        const { data: allGroupSettlements } = await supabase
          .from('settlements')
          .select('group_id, currency, paid_by, paid_to, amount')
          .in('group_id', groupIds)

        for (const settlement of (allGroupSettlements || [])) {
          const gId = settlement.group_id
          if (!gId) continue
          if (!groupBalanceMap[gId]) groupBalanceMap[gId] = {}
          const amount = parseFloat(settlement.amount)
          if (settlement.paid_by === currentUserId) {
            if (!groupBalanceMap[gId][settlement.currency]) groupBalanceMap[gId][settlement.currency] = 0
            groupBalanceMap[gId][settlement.currency] -= amount
          } else if (settlement.paid_to === currentUserId) {
            if (!groupBalanceMap[gId][settlement.currency]) groupBalanceMap[gId][settlement.currency] = 0
            groupBalanceMap[gId][settlement.currency] += amount
          }
        }

        const groupBalResult: Record<string, { currency: string; amount: number }[]> = {}
        for (const [gId, currencies] of Object.entries(groupBalanceMap)) {
          groupBalResult[gId] = Object.entries(currencies)
            .map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }))
            .filter((b) => b.amount !== 0)
        }
        setGroupBalances(groupBalResult)

        // All expenses for balances and analytics
        const { data: groupExpenses } = await supabase
          .from('expenses')
          .select('*, expense_splits(user_id, amount_owed, profiles(name, email))')
          .in('group_id', groupIds)

        const { data: friendExpenses } = await supabase
          .from('expenses')
          .select('*, expense_splits(user_id, amount_owed, profiles(name, email))')
          .is('group_id', null)
          .or(`created_by.eq.${currentUserId},paid_by.eq.${currentUserId}`)

        const expenses = [...(groupExpenses || []), ...(friendExpenses || [])]
        setAllExpenses(expenses)

        const { data: settlements } = await supabase
          .from('settlements')
          .select('*')

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')

        const nameMap: Record<string, string> = {}
        if (profiles) {
          for (const p of profiles) nameMap[p.id] = p.name || p.email
        }

        const netDebts: Record<string, Record<string, number>> = {}
        for (const expense of expenses) {
          const currency = expense.currency
          if (!netDebts[currency]) netDebts[currency] = {}
          for (const split of expense.expense_splits || []) {
            if (split.user_id === expense.paid_by) continue
            const amount = parseFloat(split.amount_owed)
            if (split.user_id === currentUserId) {
              if (!netDebts[currency][expense.paid_by]) netDebts[currency][expense.paid_by] = 0
              netDebts[currency][expense.paid_by] += amount
            } else if (expense.paid_by === currentUserId) {
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
                      <a key={group.id} href={`/groups/${group.id}/new`}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700">
                        {group.name}
                      </a>
                    ))}
                  </div>
                )}
                <div className="border-t border-gray-100">
                  <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase">Friends</p>
                  <a href="/expenses/new" className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700">+ Add with a friend</a>
                </div>
                <div className="border-t border-gray-100">
                  <a href="/groups/new" className="block px-4 py-2 text-sm text-purple-600 hover:bg-purple-50">+ Create new group</a>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-gray-600 mb-6">Welcome, {user?.user_metadata?.name || user?.email}!</p>

        {/* Tabs */}
        <div className="border-b mb-6">
          <div className="flex gap-6">
            <button onClick={() => setActiveTab('overview')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-purple-700 text-purple-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              Overview
            </button>
            <button onClick={() => setActiveTab('analytics')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'analytics' ? 'border-purple-700 text-purple-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              Analytics
            </button>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Balance Summary */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="border border-gray-200 rounded p-4">
                <p className="text-sm text-gray-500 mb-2">You owe</p>
                {youOwe.length === 0 ? (
                  <p className="text-lg font-bold text-gray-300">Nothing</p>
                ) : (
                  youOwe.map((o) => (
                    <p key={o.currency} className="text-lg font-bold text-red-500">{getSymbol(o.currency)}{o.amount.toFixed(2)}</p>
                  ))
                )}
              </div>
              <div className="border border-gray-200 rounded p-4">
                <p className="text-sm text-gray-500 mb-2">You are owed</p>
                {owedToYou.length === 0 ? (
                  <p className="text-lg font-bold text-gray-300">Nothing</p>
                ) : (
                  owedToYou.map((o) => (
                    <p key={o.currency} className="text-lg font-bold text-green-600">{getSymbol(o.currency)}{o.amount.toFixed(2)}</p>
                  ))
                )}
              </div>
            </div>

            {/* Friend Balances */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-700">Friend Balances</h2>
              {friendBalances.length > 1 && (
                <select value={friendSort} onChange={(e) => setFriendSort(e.target.value as any)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="name">Name (A-Z)</option>
                  <option value="recent">Most recent</option>
                  <option value="highest">You owe most</option>
                  <option value="owes_you">Owes you most</option>
                </select>
              )}
            </div>

            {(() => {
              const sorted = [...friendBalances].sort((a, b) => {
                if (friendSort === 'name') return a.name.localeCompare(b.name)
                if (friendSort === 'recent') return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
                if (friendSort === 'highest') {
                  const oweA = a.amounts.reduce((acc, x) => acc + (x.amount > 0 ? x.amount : 0), 0)
                  const oweB = b.amounts.reduce((acc, x) => acc + (x.amount > 0 ? x.amount : 0), 0)
                  return oweB - oweA
                }
                if (friendSort === 'owes_you') {
                  const owedA = a.amounts.reduce((acc, x) => acc + (x.amount < 0 ? Math.abs(x.amount) : 0), 0)
                  const owedB = b.amounts.reduce((acc, x) => acc + (x.amount < 0 ? Math.abs(x.amount) : 0), 0)
                  return owedB - owedA
                }
                return 0
              })

              if (sorted.length === 0) return <p className="text-gray-400 text-sm mb-8">No balances yet.</p>

              return (
                <ul className="space-y-2 mb-8">
                  {sorted.map((friend) => (
                    <li key={friend.userId} className="border border-gray-200 rounded p-3 flex justify-between items-center">
                      <a href={`/friends/${friend.userId}`} className="font-medium text-purple-700 hover:underline">{friend.name}</a>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {friend.amounts.map((a) => (
                            <p key={a.currency} className={`text-sm font-bold ${a.amount > 0 ? 'text-red-500' : 'text-green-600'}`}>
                              {a.amount > 0 ? `You owe ${getSymbol(a.currency)}${a.amount.toFixed(2)}` : `Owes you ${getSymbol(a.currency)}${Math.abs(a.amount).toFixed(2)}`}
                            </p>
                          ))}
                        </div>
                        {friend.amounts.map((a) => (
                          <a key={`settle-${a.currency}`}
                            href={`/friends/${friend.userId}/settle?from=${a.amount > 0 ? 'me' : friend.userId}&to=${a.amount > 0 ? friend.userId : 'me'}&fromName=${a.amount > 0 ? encodeURIComponent(user?.user_metadata?.name || user?.email || 'Me') : encodeURIComponent(friend.name)}&toName=${a.amount > 0 ? encodeURIComponent(friend.name) : encodeURIComponent(user?.user_metadata?.name || user?.email || 'Me')}&amount=${Math.abs(a.amount).toFixed(2)}&currency=${a.currency}`}
                            className="text-xs bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600">
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-700">Your Groups</h2>
              {groups.length > 1 && (
                <select value={groupSort} onChange={(e) => setGroupSort(e.target.value as any)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="activity">Latest activity</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="created">Date created</option>
                </select>
              )}
            </div>

            {loading ? (
              <p className="text-gray-400">Loading...</p>
            ) : groups.length === 0 ? (
              <p className="text-gray-400">No groups yet. Create one to get started!</p>
            ) : (
              <ul className="space-y-3">
                {[...groups].sort((a, b) => {
                  if (groupSort === 'name') return a.name.localeCompare(b.name)
                  if (groupSort === 'created') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  if (groupSort === 'activity') {
                    const actA = groupActivity[a.id] || '1970-01-01'
                    const actB = groupActivity[b.id] || '1970-01-01'
                    return new Date(actB).getTime() - new Date(actA).getTime()
                  }
                  return 0
                }).map((group) => {
                  const balances = groupBalances[group.id] || []
                  return (
                    <li key={group.id}>
                      <a href={`/groups/${group.id}`}
                        className="flex justify-between items-center border border-gray-200 rounded p-4 hover:border-purple-400 hover:bg-purple-50">
                        <span className="text-purple-700 font-medium">{group.name}</span>
                        <div className="text-right">
                          {balances.length === 0 ? (
                            <span className="text-xs text-gray-300">Settled up</span>
                          ) : (
                            balances.map((b) => (
                              <p key={b.currency} className={`text-sm font-bold ${b.amount > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                {b.amount > 0 ? `You owe ${getSymbol(b.currency)}${b.amount.toFixed(2)}` : `Owed ${getSymbol(b.currency)}${Math.abs(b.amount).toFixed(2)}`}
                              </p>
                            ))
                          )}
                        </div>
                      </a>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div>
            {/* Time controls */}
            <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
              <div className="flex gap-1">
                {(['daily', 'weekly', 'monthly'] as const).map((view) => (
                  <button key={view} onClick={() => setTimeView(view)}
                    className={`px-3 py-1 rounded text-sm capitalize ${timeView === view ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {view}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {([['all', 'All time'], ['3m', '3 months'], ['6m', '6 months'], ['1y', '1 year']] as const).map(([value, label]) => (
                  <button key={value} onClick={() => setTimeRange(value)}
                    className={`px-3 py-1 rounded text-sm ${timeRange === value ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              const now = new Date()
              const filtered = allExpenses.filter((e) => {
                if (timeRange === 'all') return true
                const expDate = new Date(e.date)
                const months = timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12
                const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate())
                return expDate >= cutoff
              })

              const myShares = filtered.map((e) => {
                const mySplit = e.expense_splits?.find((s: any) => s.user_id === user?.id)
                return {
                  ...e,
                  myShare: mySplit ? parseFloat(mySplit.amount_owed) : 0,
                  total: parseFloat(e.amount),
                }
              })

              // Time grouping
              const getKey = (dateStr: string) => {
                const d = new Date(dateStr)
                if (timeView === 'daily') return d.toLocaleDateString()
                if (timeView === 'weekly') {
                  const start = new Date(d)
                  start.setDate(d.getDate() - d.getDay())
                  return `Week of ${start.toLocaleDateString()}`
                }
                return `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`
              }

              const timeGroups: Record<string, number> = {}
              for (const e of myShares) {
                const key = getKey(e.date)
                if (!timeGroups[key]) timeGroups[key] = 0
                timeGroups[key] += e.myShare
              }

              const timeSorted = Object.entries(timeGroups).sort((a, b) => {
                const dateA = new Date(a[0].replace('Week of ', ''))
                const dateB = new Date(b[0].replace('Week of ', ''))
                return dateA.getTime() - dateB.getTime()
              })

              const maxTime = Math.max(...timeSorted.map(([, v]) => v), 1)

              // Category breakdown
              const categoryTotals: Record<string, number> = {}
              for (const e of myShares) {
                const cat = e.category || 'Other'
                if (!categoryTotals[cat]) categoryTotals[cat] = 0
                categoryTotals[cat] += e.myShare
              }
              const categorySorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])
              const categoryTotal = categorySorted.reduce((acc, [, v]) => acc + v, 0)

              // Group breakdown
              const groupTotalsMap: Record<string, { name: string; amount: number }> = {}
              for (const e of myShares) {
                const gId = e.group_id || 'no-group'
                const gName = e.group_id ? groups.find((g) => g.id === e.group_id)?.name || 'Unknown' : 'Friend expenses'
                if (!groupTotalsMap[gId]) groupTotalsMap[gId] = { name: gName, amount: 0 }
                groupTotalsMap[gId].amount += e.myShare
              }
              const groupSorted = Object.entries(groupTotalsMap).sort((a, b) => b[1].amount - a[1].amount)
              const groupTotal = groupSorted.reduce((acc, [, v]) => acc + v.amount, 0)

              // Friend breakdown
              const friendTotals: Record<string, { name: string; amount: number }> = {}
              for (const e of filtered) {
                for (const split of e.expense_splits || []) {
                  if (split.user_id === user?.id) continue
                  const name = split.profiles?.name || split.profiles?.email || 'Unknown'
                  if (!friendTotals[split.user_id]) friendTotals[split.user_id] = { name, amount: 0 }
                  friendTotals[split.user_id].amount += parseFloat(split.amount_owed)
                }
              }
              const friendSorted = Object.entries(friendTotals).sort((a, b) => b[1].amount - a[1].amount)

              // Personal insights
              const totalPaid = filtered.filter((e) => e.paid_by === user?.id).reduce((acc, e) => acc + parseFloat(e.amount), 0)
              const totalShare = myShares.reduce((acc, e) => acc + e.myShare, 0)
              const biggestExpense = filtered.length > 0
                ? filtered.reduce((max, e) => parseFloat(e.amount) > parseFloat(max.amount) ? e : max, filtered[0])
                : null
              const expenseCount = filtered.length

              return (
                <>
                  {/* Personal insights */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-1">Total you paid</p>
                      <p className="text-xl font-bold text-purple-700">${totalPaid.toFixed(2)}</p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-1">Your actual share</p>
                      <p className="text-xl font-bold text-purple-700">${totalShare.toFixed(2)}</p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-1">Net lent out</p>
                      <p className={`text-xl font-bold ${totalPaid - totalShare >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        ${Math.abs(totalPaid - totalShare).toFixed(2)}
                        <span className="text-xs font-normal text-gray-400 ml-1">{totalPaid - totalShare >= 0 ? 'lent' : 'borrowed'}</span>
                      </p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-1">Expenses</p>
                      <p className="text-xl font-bold text-purple-700">{expenseCount}</p>
                      {biggestExpense && (
                        <p className="text-xs text-gray-400 mt-1">Biggest: ${parseFloat(biggestExpense.amount).toFixed(2)} ({biggestExpense.description})</p>
                      )}
                    </div>
                  </div>

                  {/* Spending over time */}
                  <div className="mb-8">
                    <h3 className="text-md font-semibold text-gray-700 mb-3">
                      {timeView === 'daily' ? 'Daily' : timeView === 'weekly' ? 'Weekly' : 'Monthly'} Spending
                    </h3>
                    {timeSorted.length === 0 ? (
                      <p className="text-gray-400 text-sm">No data yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {timeSorted.map(([label, amount]) => (
                          <div key={label} className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 w-36 shrink-0 text-right">{label}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                              <div className="bg-purple-500 h-full rounded-full flex items-center justify-end pr-2"
                                style={{ width: `${Math.max((amount / maxTime) * 100, 8)}%` }}>
                                <span className="text-xs text-white font-medium">${amount.toFixed(0)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category breakdown */}
                  <div className="mb-8">
                    <h3 className="text-md font-semibold text-gray-700 mb-3">By Category</h3>
                    {categorySorted.length === 0 ? (
                      <p className="text-gray-400 text-sm">No data yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {categorySorted.map(([cat, amount]) => (
                          <div key={cat} className="flex items-center gap-3">
                            <span className="text-lg w-8">{getCategoryEmoji(cat)}</span>
                            <span className="text-sm text-gray-700 w-28 shrink-0">{cat}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                              <div className="bg-purple-400 h-full rounded-full"
                                style={{ width: `${Math.max((amount / (categoryTotal || 1)) * 100, 4)}%` }} />
                            </div>
                            <span className="text-sm font-medium text-gray-700 w-20 text-right">${amount.toFixed(2)}</span>
                            <span className="text-xs text-gray-400 w-12 text-right">{((amount / (categoryTotal || 1)) * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Group breakdown */}
                  <div className="mb-8">
                    <h3 className="text-md font-semibold text-gray-700 mb-3">By Group</h3>
                    {groupSorted.length === 0 ? (
                      <p className="text-gray-400 text-sm">No data yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {groupSorted.map(([id, { name, amount }]) => (
                          <div key={id} className="flex items-center gap-3">
                            <span className="text-sm text-gray-700 w-36 shrink-0 truncate">{name}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                              <div className="bg-purple-500 h-full rounded-full"
                                style={{ width: `${Math.max((amount / (groupTotal || 1)) * 100, 4)}%` }} />
                            </div>
                            <span className="text-sm font-medium text-gray-700 w-20 text-right">${amount.toFixed(2)}</span>
                            <span className="text-xs text-gray-400 w-12 text-right">{((amount / (groupTotal || 1)) * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Friend breakdown */}
                  <div className="mb-8">
                    <h3 className="text-md font-semibold text-gray-700 mb-3">By Friend</h3>
                    {friendSorted.length === 0 ? (
                      <p className="text-gray-400 text-sm">No data yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {friendSorted.map(([id, { name, amount }]) => {
                          const maxFriend = friendSorted[0][1].amount
                          return (
                            <div key={id} className="flex items-center gap-3">
                              <span className="text-sm text-gray-700 w-36 shrink-0 truncate">{name}</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                                <div className="bg-purple-400 h-full rounded-full"
                                  style={{ width: `${Math.max((amount / (maxFriend || 1)) * 100, 4)}%` }} />
                              </div>
                              <span className="text-sm font-medium text-gray-700 w-20 text-right">${amount.toFixed(2)}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </div>
    </AuthGuard>
  )
}

