'use client'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
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

type Balance = {
  from: string
  fromName: string
  to: string
  toName: string
  amount: number
  currency: string
}

type SpendingTotal = {
  currency: string
  amount: number
}

type PersonSpending = {
  userId: string
  name: string
  paid: Record<string, number>
  owes: Record<string, number>
}

type Tab = 'activity' | 'members'

const COLORS = [
  'bg-purple-500', 'bg-blue-500', 'bg-pink-500', 'bg-amber-500',
  'bg-teal-500', 'bg-indigo-500', 'bg-rose-500', 'bg-emerald-500',
]

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}

function getColor(index: number) {
  return COLORS[index % COLORS.length]
}

export default function GroupDetail() {
  const params = useParams()
  const groupId = params.id as string

  const [group, setGroup] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [settlements, setSettlements] = useState<any[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [simplifiedBalances, setSimplifiedBalances] = useState<Balance[]>([])
  const [showSimplified, setShowSimplified] = useState(true)
  const [groupTotals, setGroupTotals] = useState<SpendingTotal[]>([])
  const [personSpending, setPersonSpending] = useState<PersonSpending[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)
  const [showStats, setShowStats] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('activity')

  // Add member search
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<any>(null)

  const handleDelete = async (expenseId: string) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return
    await supabase.from('expense_splits').delete().eq('expense_id', expenseId)
    await supabase.from('expenses').delete().eq('id', expenseId)
    fetchGroup()
  }

  const simplifyDebts = (balances: Balance[], members: any[]): Balance[] => {
    const nameMap: Record<string, string> = {}
    for (const m of members) {
      nameMap[m.user_id] = (m.profiles as any)?.name || (m.profiles as any)?.email || 'Unknown'
    }
    const byCurrency: Record<string, Balance[]> = {}
    for (const b of balances) {
      if (!byCurrency[b.currency]) byCurrency[b.currency] = []
      byCurrency[b.currency].push(b)
    }
    const result: Balance[] = []
    for (const currency of Object.keys(byCurrency)) {
      const netBalance: Record<string, number> = {}
      for (const b of byCurrency[currency]) {
        if (!netBalance[b.from]) netBalance[b.from] = 0
        if (!netBalance[b.to]) netBalance[b.to] = 0
        netBalance[b.from] -= b.amount
        netBalance[b.to] += b.amount
      }
      const debtors: { id: string; amount: number }[] = []
      const creditors: { id: string; amount: number }[] = []
      for (const [id, balance] of Object.entries(netBalance)) {
        const rounded = Math.round(balance * 100) / 100
        if (rounded < 0) debtors.push({ id, amount: Math.abs(rounded) })
        else if (rounded > 0) creditors.push({ id, amount: rounded })
      }
      debtors.sort((a, b) => b.amount - a.amount)
      creditors.sort((a, b) => b.amount - a.amount)
      let i = 0, j = 0
      while (i < debtors.length && j < creditors.length) {
        const transfer = Math.min(debtors[i].amount, creditors[j].amount)
        const rounded = Math.round(transfer * 100) / 100
        if (rounded > 0) {
          result.push({
            from: debtors[i].id, fromName: nameMap[debtors[i].id] || 'Unknown',
            to: creditors[j].id, toName: nameMap[creditors[j].id] || 'Unknown',
            amount: rounded, currency,
          })
        }
        debtors[i].amount -= transfer
        creditors[j].amount -= transfer
        if (Math.round(debtors[i].amount * 100) === 0) i++
        if (Math.round(creditors[j].amount * 100) === 0) j++
      }
    }
    return result
  }

  const calculateSpending = (expenses: any[], members: any[]) => {
    const nameMap: Record<string, string> = {}
    for (const m of members) {
      nameMap[m.user_id] = (m.profiles as any)?.name || (m.profiles as any)?.email || 'Unknown'
    }
    const totals: Record<string, number> = {}
    for (const expense of expenses) {
      if (!totals[expense.currency]) totals[expense.currency] = 0
      totals[expense.currency] += parseFloat(expense.amount)
    }
    setGroupTotals(Object.entries(totals).map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 })))

    const personMap: Record<string, PersonSpending> = {}
    for (const m of members) {
      personMap[m.user_id] = { userId: m.user_id, name: nameMap[m.user_id], paid: {}, owes: {} }
    }
    for (const expense of expenses) {
      const currency = expense.currency
      if (personMap[expense.paid_by]) {
        if (!personMap[expense.paid_by].paid[currency]) personMap[expense.paid_by].paid[currency] = 0
        personMap[expense.paid_by].paid[currency] += parseFloat(expense.amount)
      }
      for (const split of expense.expense_splits || []) {
        if (personMap[split.user_id]) {
          if (!personMap[split.user_id].owes[currency]) personMap[split.user_id].owes[currency] = 0
          personMap[split.user_id].owes[currency] += parseFloat(split.amount_owed)
        }
      }
    }
    setPersonSpending(Object.values(personMap))
  }

  const calculateBalances = (expenses: any[], members: any[], settlements: any[]) => {
    const debtsByCurrency: Record<string, Record<string, Record<string, number>>> = {}
    for (const expense of expenses) {
      const currency = expense.currency
      if (!debtsByCurrency[currency]) debtsByCurrency[currency] = {}
      for (const split of expense.expense_splits || []) {
        if (split.user_id === expense.paid_by) continue
        if (!debtsByCurrency[currency][split.user_id]) debtsByCurrency[currency][split.user_id] = {}
        if (!debtsByCurrency[currency][split.user_id][expense.paid_by]) debtsByCurrency[currency][split.user_id][expense.paid_by] = 0
        debtsByCurrency[currency][split.user_id][expense.paid_by] += parseFloat(split.amount_owed)
      }
    }
    for (const settlement of settlements) {
      const { currency, paid_by: from, paid_to: to } = settlement
      const amount = parseFloat(settlement.amount)
      if (!debtsByCurrency[currency]) continue
      if (debtsByCurrency[currency][from]?.[to]) {
        debtsByCurrency[currency][from][to] -= amount
        if (debtsByCurrency[currency][from][to] <= 0) {
          const overpay = Math.abs(debtsByCurrency[currency][from][to])
          delete debtsByCurrency[currency][from][to]
          if (overpay > 0) {
            if (!debtsByCurrency[currency][to]) debtsByCurrency[currency][to] = {}
            if (!debtsByCurrency[currency][to][from]) debtsByCurrency[currency][to][from] = 0
            debtsByCurrency[currency][to][from] += overpay
          }
        }
      }
    }
    const nameMap: Record<string, string> = {}
    for (const m of members) nameMap[m.user_id] = (m.profiles as any)?.name || (m.profiles as any)?.email || 'Unknown'

    const result: Balance[] = []
    for (const currency of Object.keys(debtsByCurrency)) {
      const debts = debtsByCurrency[currency]
      const processed = new Set<string>()
      for (const from of Object.keys(debts)) {
        for (const to of Object.keys(debts[from])) {
          const key = [from, to].sort().join('-')
          if (processed.has(key)) continue
          processed.add(key)
          const net = Math.round(((debts[from]?.[to] || 0) - (debts[to]?.[from] || 0)) * 100) / 100
          if (net > 0) result.push({ from, fromName: nameMap[from] || 'Unknown', to, toName: nameMap[to] || 'Unknown', amount: net, currency })
          else if (net < 0) result.push({ from: to, fromName: nameMap[to] || 'Unknown', to: from, toName: nameMap[from] || 'Unknown', amount: Math.abs(net), currency })
        }
      }
    }
    setBalances(result)
    setSimplifiedBalances(simplifyDebts(result, members))
  }

  const fetchGroup = async () => {
    const { data: groupData } = await supabase.from('groups').select('*').eq('id', groupId).single()
    setGroup(groupData)
    const { data: memberData } = await supabase.from('group_members').select('user_id, joined_at, profiles(name, email)').eq('group_id', groupId)
    setMembers(memberData || [])
    const { data: expenseData } = await supabase.from('expenses').select('*, profiles!paid_by(name, email), expense_splits(user_id, amount_owed, profiles(name, email))').eq('group_id', groupId).order('created_at', { ascending: false })
    const { data: settlementData } = await supabase.from('settlements').select('*, payer:profiles!paid_by(name, email), payee:profiles!paid_to(name, email)').eq('group_id', groupId)
    setExpenses(expenseData || [])
    setSettlements(settlementData || [])
    calculateBalances(expenseData || [], memberData || [], settlementData || [])
    calculateSpending(expenseData || [], memberData || [])
    setLoading(false)
  }

  useEffect(() => { fetchGroup() }, [groupId])

  useEffect(() => {
    const searchPeople = async () => {
      if (searchQuery.length < 2) { setSuggestions([]); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const memberIds = members.map((m) => m.user_id)
      const { data: friendships } = await supabase.from('friendships').select('user_id, friend_id').or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`).eq('status', 'accepted')
      const friendIds = (friendships || []).map((f) => f.user_id === session.user.id ? f.friend_id : f.user_id)
      const { data: myGroups } = await supabase.from('group_members').select('group_id').eq('user_id', session.user.id)
      let groupMemberIds: string[] = []
      if (myGroups && myGroups.length > 0) {
        const allGroupIds = myGroups.map((g) => g.group_id)
        const { data: gm } = await supabase.from('group_members').select('user_id').in('group_id', allGroupIds).neq('user_id', session.user.id)
        groupMemberIds = (gm || []).map((m) => m.user_id)
      }
      const allKnownIds = [...new Set([...friendIds, ...groupMemberIds])]
      if (allKnownIds.length === 0) { setSuggestions([]); return }
      const { data } = await supabase.from('profiles').select('id, name, email').in('id', allKnownIds).or(`email.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`).limit(5)
      setSuggestions((data || []).filter((p) => !memberIds.includes(p.id)))
      setShowSuggestions(true)
    }
    const timer = setTimeout(searchPeople, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, members])

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccess('')
    let profileId = selectedPerson?.id
    let profileEmail = selectedPerson?.email
    if (!profileId && searchQuery) {
      const { data: profile } = await supabase.from('profiles').select('id, email').eq('email', searchQuery).single()
      if (!profile) { setError('No user found with that email.'); return }
      profileId = profile.id; profileEmail = profile.email
    }
    if (!profileId) { setError('Select a person to add.'); return }
    if (members.some((m) => m.user_id === profileId)) { setError('Already in the group.'); return }
    const { error: addError } = await supabase.from('group_members').insert({ group_id: groupId, user_id: profileId })
    if (addError) { setError(addError.message); return }
    const { ensureFriendshipsWithAll } = await import('@/lib/friends')
    const memberIds = members.map((m) => m.user_id)
    await ensureFriendshipsWithAll(profileId, memberIds)
    setSuccess(`Added ${profileEmail} to the group!`)
    setSearchQuery(''); setSelectedPerson(null); setShowSuggestions(false)
    fetchGroup()
  }

  if (loading) return <p className="p-8">Loading...</p>
  if (!group) return <p className="p-8">Group not found.</p>

  const displayBalances = showSimplified ? simplifiedBalances : balances

  const AddMemberForm = () => (
    <div className="mb-6">
      <form onSubmit={handleAddMember}>
        {selectedPerson ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center justify-between border border-purple-300 bg-purple-50 rounded px-3 py-2">
              <div>
                <span className="font-medium text-purple-700">{selectedPerson.name}</span>
                <span className="text-gray-400 text-sm ml-2">{selectedPerson.email}</span>
              </div>
              <button type="button" onClick={() => { setSelectedPerson(null); setSearchQuery('') }} className="text-gray-400 hover:text-red-500 text-sm">✕</button>
            </div>
            <button type="submit" className="bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-800">Add</button>
          </div>
        ) : (
          <div className="relative">
            <div className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSelectedPerson(null) }}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
                placeholder="Search by name or email to add"
                className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button type="submit" className="bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-800">Add</button>
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                {suggestions.map((person) => (
                  <button key={person.id} type="button" onClick={() => { setSelectedPerson(person); setSearchQuery(person.email); setShowSuggestions(false) }}
                    className="w-full text-left px-4 py-3 hover:bg-purple-50 border-b border-gray-100 last:border-b-0">
                    <p className="text-sm font-medium text-gray-800">{person.name}</p>
                    <p className="text-xs text-gray-400">{person.email}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </form>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      {success && <p className="text-purple-500 text-sm mt-2">{success}</p>}
    </div>
  )

  return (
    <AuthGuard>
      <div>
        <a href="/dashboard" className="text-purple-600 hover:underline text-sm">&larr; Back to Dashboard</a>

        <h1 className="text-2xl font-bold text-purple-700 mt-4 mb-2">{group.name}</h1>

        {/* Member circles + add button */}
        <div className="flex items-center gap-1 mb-4">
          {members.map((member, index) => {
            const name = (member.profiles as any)?.name || 'Unknown'
            return (
              <div key={member.user_id} className="group relative">
                <div className={`w-9 h-9 rounded-full ${getColor(index)} flex items-center justify-center text-white text-xs font-bold cursor-default`}>
                  {getInitials(name)}
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                  {name}
                </div>
              </div>
            )
          })}
          <button
            onClick={() => setActiveTab('members')}
            className="w-9 h-9 rounded-full border-2 border-dashed border-purple-300 flex items-center justify-center text-purple-400 hover:border-purple-500 hover:text-purple-600 text-lg"
          >
            +
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 mb-6">
          {groupTotals.length > 0 && (
            <p className="text-sm text-gray-500">
              Total:{' '}
              {groupTotals.map((t, i) => (
                <span key={t.currency} className="font-semibold text-purple-700">
                  {i > 0 ? ' + ' : ''}{getSymbol(t.currency)}{t.amount.toFixed(2)}
                </span>
              ))}
            </p>
          )}
          <span className="text-gray-300">|</span>
          <p className="text-sm text-gray-500">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          <span className="text-gray-300">|</span>
          <p className="text-sm text-gray-500">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Balances */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-700">Balances</h2>
            {balances.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-500">Simplify Debts</span>
                <div onClick={() => setShowSimplified(!showSimplified)} className={`w-10 h-5 rounded-full relative transition-colors ${showSimplified ? 'bg-purple-700' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${showSimplified ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </label>
            )}
          </div>
          {displayBalances.length === 0 ? (
            <p className="text-gray-400 text-sm">All settled up!</p>
          ) : (
            <ul className="space-y-2">
              {displayBalances.map((b, i) => (
                <li key={i} className="border border-gray-200 rounded p-3 flex justify-between items-center">
                  <p className="text-sm text-gray-700">
                    <span className="text-red-500 font-medium">{b.fromName}</span>{' owes '}<span className="text-purple-500 font-medium">{b.toName}</span>
                  </p>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-purple-700">{getSymbol(b.currency)}{b.amount.toFixed(2)}</p>
                    
                      <a
                      href={`/groups/${groupId}/settle?from=${b.from}&to=${b.to}&fromName=${encodeURIComponent(b.fromName)}&toName=${encodeURIComponent(b.toName)}&amount=${b.amount.toFixed(2)}&currency=${b.currency}`}
                      onClick={(e) => {
                        if (!showSimplified && simplifiedBalances.length === 0) {
                          if (!window.confirm('Simplified debts show everyone is settled up. These debts cancel each other out and no payment is needed. Are you sure you want to settle anyway?')) {
                            e.preventDefault()
                          }
                        }
                      }}
                      className="text-xs bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600"
                    >
                      Settle Up
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Spending breakdown toggle */}
        <div className="mb-8">
          <button onClick={() => setShowStats(!showStats)} className="text-sm text-purple-600 hover:underline">
            {showStats ? 'Hide spending breakdown' : 'Show spending breakdown'}
          </button>
          {showStats && (
            <div className="mt-3 space-y-2">
              {personSpending.map((person) => (
                <div key={person.userId} className="border border-gray-200 rounded p-3">
                  <p className="font-medium text-gray-800 mb-1">{person.name}</p>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="text-gray-400">Paid: </span>
                      {Object.keys(person.paid).length === 0 ? <span className="text-gray-300">Nothing</span> :
                        Object.entries(person.paid).map(([c, a]) => <span key={c} className="text-purple-700 font-medium">{getSymbol(c)}{a.toFixed(2)} </span>)}
                    </div>
                    <div>
                      <span className="text-gray-400">Share: </span>
                      {Object.keys(person.owes).length === 0 ? <span className="text-gray-300">Nothing</span> :
                        Object.entries(person.owes).map(([c, a]) => <span key={c} className="text-gray-700 font-medium">{getSymbol(c)}{a.toFixed(2)} </span>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b mb-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('activity')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'activity' ? 'border-purple-700 text-purple-700' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Activity
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'members' ? 'border-purple-700 text-purple-700' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Members ({members.length})
            </button>
          </div>
        </div>

        {/* Activity tab */}
        {activeTab === 'activity' && (
          <div>
            <div className="flex justify-end mb-4">
              <a href={`/groups/${groupId}/new`} className="bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-800 text-sm">+ Add Expense</a>
            </div>

            {(() => {
              const activity = [
                ...expenses.map((e) => ({ ...e, type: 'expense' as const, sortDate: e.created_at })),
                ...settlements.map((s) => ({ ...s, type: 'settlement' as const, sortDate: s.created_at })),
              ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())

              if (activity.length === 0) return <p className="text-gray-400 text-sm">No activity yet.</p>

              return (
                <ul className="space-y-3">
                  {activity.map((item) => {
                    if (item.type === 'settlement') {
                      const payerName = (item as any).payer?.name || (item as any).payer?.email || 'Unknown'
                      const payeeName = (item as any).payee?.name || (item as any).payee?.email || 'Unknown'
                      const symbol = getSymbol(item.currency)
                      return (
                        <li key={item.id} className="border border-purple-200 bg-purple-50 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center">
                                <span className="text-purple-700 text-lg">✓</span>
                              </div>
                              <div>
                                <p className="font-medium text-purple-700">Settlement</p>
                                <p className="text-sm text-gray-500">{payerName} paid {payeeName}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{new Date(item.date).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <p className="text-lg font-bold text-purple-700">{symbol}{parseFloat(item.amount).toFixed(2)}</p>
                          </div>
                        </li>
                      )
                    }

                    const expense = item
                    const payer = (expense.profiles as any)?.name || (expense.profiles as any)?.email || 'Unknown'
                    const symbol = getSymbol(expense.currency)
                    const firstLetter = expense.description.charAt(0).toUpperCase()

                    return (
                      <li key={expense.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                              <span className="text-gray-500 text-lg font-bold">{firstLetter}</span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{expense.description}</p>
                              <p className="text-sm text-gray-500 mt-0.5">Paid by <span className="text-purple-600">{payer}</span></p>
                              <p className="text-xs text-gray-400 mt-0.5">{new Date(expense.date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-purple-700">{symbol}{parseFloat(expense.amount).toFixed(2)}</p>
                            <div className="flex gap-2 mt-1 justify-end">
                              <a href={`/groups/${groupId}/edit/${expense.id}`} className="text-xs text-purple-600 hover:underline">Edit</a>
                              <button onClick={() => handleDelete(expense.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex flex-wrap gap-2">
                            {expense.expense_splits?.map((split: any) => (
                              <span key={split.user_id} className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full">
                                {split.profiles?.name || split.profiles?.email}: {symbol}{parseFloat(split.amount_owed).toFixed(2)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )
            })()}
          </div>
        )}

        {/* Members tab */}
        {activeTab === 'members' && (
          <div>
            <AddMemberForm />

            <ul className="space-y-2">
              {members.map((member, index) => {
                const name = (member.profiles as any)?.name || 'Unknown'
                const email = (member.profiles as any)?.email || ''
                return (
                  <li key={member.user_id} className="border border-gray-200 rounded-lg p-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full ${getColor(index)} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                      {getInitials(name)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{name}</p>
                      <p className="text-xs text-gray-400">{email}</p>
                      <p className="text-xs text-gray-300">Joined {new Date(member.joined_at).toLocaleDateString()}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
