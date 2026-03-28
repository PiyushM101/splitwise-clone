'use client'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthGuard from '@/components/AuthGuard'
import { ensureFriendship } from '@/lib/friends'

const CURRENCIES = [
  { code: 'USD', symbol: '$' }, { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' }, { code: 'INR', symbol: '₹' },
  { code: 'JPY', symbol: '¥' }, { code: 'CNY', symbol: '¥' },
  { code: 'CAD', symbol: 'C$' }, { code: 'AUD', symbol: 'A$' },
  { code: 'CHF', symbol: 'Fr' }, { code: 'KRW', symbol: '₩' },
  { code: 'SGD', symbol: 'S$' }, { code: 'HKD', symbol: 'HK$' },
  { code: 'NZD', symbol: 'NZ$' }, { code: 'MXN', symbol: 'Mex$' },
  { code: 'BRL', symbol: 'R$' }, { code: 'ARS', symbol: 'AR$' },
  { code: 'CLP', symbol: 'CL$' }, { code: 'COP', symbol: 'COL$' },
  { code: 'PEN', symbol: 'S/.' }, { code: 'ZAR', symbol: 'R' },
  { code: 'NGN', symbol: '₦' }, { code: 'KES', symbol: 'KSh' },
  { code: 'EGP', symbol: 'E£' }, { code: 'GHS', symbol: 'GH₵' },
  { code: 'MAD', symbol: 'MAD' }, { code: 'AED', symbol: 'د.إ' },
  { code: 'SAR', symbol: '﷼' }, { code: 'QAR', symbol: 'QR' },
  { code: 'KWD', symbol: 'KD' }, { code: 'BHD', symbol: 'BD' },
  { code: 'OMR', symbol: 'OMR' }, { code: 'ILS', symbol: '₪' },
  { code: 'TRY', symbol: '₺' }, { code: 'RUB', symbol: '₽' },
  { code: 'PLN', symbol: 'zł' }, { code: 'CZK', symbol: 'Kč' },
  { code: 'HUF', symbol: 'Ft' }, { code: 'SEK', symbol: 'kr' },
  { code: 'NOK', symbol: 'kr' }, { code: 'DKK', symbol: 'kr' },
  { code: 'RON', symbol: 'lei' }, { code: 'BGN', symbol: 'лв' },
  { code: 'HRK', symbol: 'kn' }, { code: 'THB', symbol: '฿' },
  { code: 'MYR', symbol: 'RM' }, { code: 'IDR', symbol: 'Rp' },
  { code: 'PHP', symbol: '₱' }, { code: 'VND', symbol: '₫' },
  { code: 'TWD', symbol: 'NT$' }, { code: 'PKR', symbol: '₨' },
  { code: 'BDT', symbol: '৳' }, { code: 'LKR', symbol: 'Rs' },
  { code: 'NPR', symbol: 'रू' },
]

const getSymbol = (code: string) => CURRENCIES.find((c) => c.code === code)?.symbol || code

type SplitMethod = 'equal' | 'exact' | 'percentage' | 'shares' | 'adjustments'
type Person = { id: string; name: string; email: string }

export default function NewFriendExpense() {
  const router = useRouter()

  const [currentUser, setCurrentUser] = useState<Person | null>(null)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [paidBy, setPaidBy] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Friend search
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Person[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedFriends, setSelectedFriends] = useState<Person[]>([])

  // Split state
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal')
  const [splitWith, setSplitWith] = useState<string[]>([])
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({})
  const [percentages, setPercentages] = useState<Record<string, string>>({})
  const [shares, setShares] = useState<Record<string, string>>({})
  const [adjustments, setAdjustments] = useState<Record<string, string>>({})

  const symbol = getSymbol(currency)

  // All people involved (me + selected friends)
  const allPeople: Person[] = currentUser
    ? [currentUser, ...selectedFriends]
    : selectedFriends

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        setCurrentUser(profile)
        setPaidBy(profile.id)
        setSplitWith([profile.id])
      }
    }
    loadUser()
  }, [])

  // Update split arrays when friends change
  useEffect(() => {
    const ids = allPeople.map((p) => p.id)
    setSplitWith(ids)

    const newExact: Record<string, string> = {}
    const newPct: Record<string, string> = {}
    const newShares: Record<string, string> = {}
    const newAdj: Record<string, string> = {}
    ids.forEach((id) => {
      newExact[id] = exactAmounts[id] || ''
      newPct[id] = percentages[id] || ''
      newShares[id] = shares[id] || '1'
      newAdj[id] = adjustments[id] || '0'
    })
    setExactAmounts(newExact)
    setPercentages(newPct)
    setShares(newShares)
    setAdjustments(newAdj)
  }, [selectedFriends, currentUser])

  // Search friends
  useEffect(() => {
    const search = async () => {
      if (searchQuery.length < 2) {
        setSuggestions([])
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const selectedIds = selectedFriends.map((f) => f.id)

      // Get friend IDs
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`)
        .eq('status', 'accepted')

      const friendIds = (friendships || []).map((f) =>
        f.user_id === session.user.id ? f.friend_id : f.user_id
      )

      // Also get group member IDs
      const { data: myGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', session.user.id)

      let groupMemberIds: string[] = []
      if (myGroups && myGroups.length > 0) {
        const groupIds = myGroups.map((g) => g.group_id)
        const { data: groupMembers } = await supabase
          .from('group_members')
          .select('user_id')
          .in('group_id', groupIds)
          .neq('user_id', session.user.id)

        groupMemberIds = (groupMembers || []).map((m) => m.user_id)
      }

      // Combine and deduplicate
      const allKnownIds = [...new Set([...friendIds, ...groupMemberIds])]

      if (allKnownIds.length === 0) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', allKnownIds)
        .or(`email.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
        .limit(5)

      const filtered = (data || []).filter((p) => !selectedIds.includes(p.id))
      setSuggestions(filtered)
      setShowSuggestions(true)
    }

    const timer = setTimeout(search, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, selectedFriends])

  const addFriend = (friend: Person) => {
    setSelectedFriends([...selectedFriends, friend])
    setSearchQuery('')
    setShowSuggestions(false)
  }

  const removeFriend = (friendId: string) => {
    setSelectedFriends(selectedFriends.filter((f) => f.id !== friendId))
  }

  const toggleSplitWith = (userId: string) => {
    if (splitWith.includes(userId)) {
      setSplitWith(splitWith.filter((id) => id !== userId))
    } else {
      setSplitWith([...splitWith, userId])
    }
  }

  const getName = (person: Person) => person.name || person.email

  const calculateSplits = (): { userId: string; amountOwed: number }[] | null => {
    const totalAmount = parseFloat(amount)
    if (isNaN(totalAmount) || totalAmount <= 0) return null

    if (splitMethod === 'equal') {
      if (splitWith.length === 0) return null
      const splitAmount = Math.round((totalAmount / splitWith.length) * 100) / 100
      return splitWith.map((userId, index) => ({
        userId,
        amountOwed:
          index === 0
            ? Math.round((totalAmount - splitAmount * (splitWith.length - 1)) * 100) / 100
            : splitAmount,
      }))
    }

    if (splitMethod === 'exact') {
      const splits = allPeople
        .filter((p) => parseFloat(exactAmounts[p.id]) > 0)
        .map((p) => ({
          userId: p.id,
          amountOwed: parseFloat(exactAmounts[p.id]) || 0,
        }))
      const sum = splits.reduce((acc, s) => acc + s.amountOwed, 0)
      if (Math.abs(sum - totalAmount) > 0.01) return null
      return splits
    }

    if (splitMethod === 'percentage') {
      const splits = allPeople
        .filter((p) => parseFloat(percentages[p.id]) > 0)
        .map((p) => ({
          userId: p.id,
          amountOwed: Math.round((totalAmount * (parseFloat(percentages[p.id]) || 0)) / 100 * 100) / 100,
        }))
      const totalPct = allPeople.reduce((acc, p) => acc + (parseFloat(percentages[p.id]) || 0), 0)
      if (Math.abs(totalPct - 100) > 0.01) return null
      return splits
    }

    if (splitMethod === 'shares') {
      const totalShares = allPeople.reduce((acc, p) => acc + (parseFloat(shares[p.id]) || 0), 0)
      if (totalShares <= 0) return null
      return allPeople
        .filter((p) => parseFloat(shares[p.id]) > 0)
        .map((p) => ({
          userId: p.id,
          amountOwed: Math.round((totalAmount * (parseFloat(shares[p.id]) || 0) / totalShares) * 100) / 100,
        }))
    }

    if (splitMethod === 'adjustments') {
      const totalAdj = allPeople.reduce((acc, p) => acc + (parseFloat(adjustments[p.id]) || 0), 0)
      const remainder = totalAmount - totalAdj
      if (remainder < 0) return null
      const equalPart = Math.round((remainder / allPeople.length) * 100) / 100
      return allPeople.map((p, index) => {
        const adj = parseFloat(adjustments[p.id]) || 0
        let owed = equalPart + adj
        if (index === 0) {
          owed = Math.round((remainder - equalPart * (allPeople.length - 1) + adj) * 100) / 100
        }
        return { userId: p.id, amountOwed: owed }
      }).filter((s) => s.amountOwed > 0)
    }

    return null
  }

  const getValidationMessage = (): string | null => {
    const totalAmount = parseFloat(amount)
    if (!amount || isNaN(totalAmount)) return null

    if (splitMethod === 'exact') {
      const sum = allPeople.reduce((acc, p) => acc + (parseFloat(exactAmounts[p.id]) || 0), 0)
      const diff = Math.round((totalAmount - sum) * 100) / 100
      if (diff !== 0) return `${diff > 0 ? diff.toFixed(2) + ' left to assign' : 'Over by ' + Math.abs(diff).toFixed(2)}`
    }

    if (splitMethod === 'percentage') {
      const totalPct = allPeople.reduce((acc, p) => acc + (parseFloat(percentages[p.id]) || 0), 0)
      const diff = Math.round((100 - totalPct) * 100) / 100
      if (diff !== 0) return `${diff > 0 ? diff + '% left to assign' : 'Over by ' + Math.abs(diff) + '%'}`
    }

    if (splitMethod === 'adjustments') {
      const totalAdj = allPeople.reduce((acc, p) => acc + (parseFloat(adjustments[p.id]) || 0), 0)
      if (totalAdj > totalAmount) return 'Adjustments exceed the total amount'
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (selectedFriends.length === 0) {
      setError('Add at least one friend.')
      setLoading(false)
      return
    }

    const splits = calculateSplits()
    if (!splits || splits.length === 0) {
      setError(getValidationMessage() || 'Invalid split. Check your numbers.')
      setLoading(false)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        group_id: null,
        description,
        amount: parseFloat(amount),
        currency,
        paid_by: paidBy,
        created_by: session.user.id,
        date,
        split_method: splitMethod,
      })
      .select()
      .single()

    if (expenseError) {
      setError(expenseError.message)
      setLoading(false)
      return
    }

    const splitRows = splits.map((s) => ({
      expense_id: expense.id,
      user_id: s.userId,
      amount_owed: s.amountOwed,
    }))

    const { error: splitError } = await supabase
      .from('expense_splits')
      .insert(splitRows)

    if (splitError) {
      setError(splitError.message)
      setLoading(false)
      return
    }

    // Auto-friend all involved people
    for (const friend of selectedFriends) {
      await ensureFriendship(session.user.id, friend.id)
    }

    router.push('/dashboard')
  }

  return (
    <AuthGuard>
      <div className="max-w-md mx-auto">
        <a href="/dashboard" className="text-purple-600 hover:underline text-sm">
          &larr; Back to Dashboard
        </a>

        <h1 className="text-2xl font-bold text-purple-700 mt-4 mb-6">Add Friend Expense</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Friend search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Friends</label>

            {/* Selected friends chips */}
            {selectedFriends.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedFriends.map((friend) => (
                  <span
                    key={friend.id}
                    className="flex items-center gap-1 bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm"
                  >
                    {friend.name}
                    <button
                      type="button"
                      onClick={() => removeFriend(friend.id)}
                      className="text-purple-400 hover:text-red-500 ml-1"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
              placeholder="Search by name or email"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                {suggestions.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => addFriend(person)}
                    className="w-full text-left px-4 py-3 hover:bg-purple-50 border-b border-gray-100 last:border-b-0"
                  >
                    <p className="text-sm font-medium text-gray-800">{person.name}</p>
                    <p className="text-xs text-gray-400">{person.email}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Lunch, Movie tickets"
              required
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Amount and Currency */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Paid by */}
          {allPeople.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paid by</label>
              <select
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {allPeople.map((p) => (
                  <option key={p.id} value={p.id}>{getName(p)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Split method */}
          {allPeople.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Split method</label>
              <div className="flex flex-wrap gap-1 mb-4">
                {(['equal', 'exact', 'percentage', 'shares', 'adjustments'] as SplitMethod[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setSplitMethod(method)}
                    className={`px-3 py-1 rounded text-sm capitalize ${
                      splitMethod === method
                        ? 'bg-purple-700 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>

              {/* Equal */}
              {splitMethod === 'equal' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">Select who to split with equally.</p>
                  {allPeople.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={splitWith.includes(p.id)}
                        onChange={() => toggleSplitWith(p.id)}
                        className="accent-purple-700"
                      />
                      <span className="text-gray-700">{getName(p)}</span>
                      {splitWith.includes(p.id) && amount && splitWith.length > 0 && (
                        <span className="text-gray-400 text-sm ml-auto">
                          {symbol}{(parseFloat(amount) / splitWith.length).toFixed(2)}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}

              {/* Exact */}
              {splitMethod === 'exact' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">Enter exact amount each person owes.</p>
                  {allPeople.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="text-gray-700 text-sm w-32 truncate">{getName(p)}</span>
                      <div className="flex items-center flex-1">
                        <span className="text-gray-400 text-sm mr-1">{symbol}</span>
                        <input
                          type="number"
                          step="0.01"
                          value={exactAmounts[p.id] || ''}
                          onChange={(e) => setExactAmounts({ ...exactAmounts, [p.id]: e.target.value })}
                          placeholder="0.00"
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  ))}
                  {getValidationMessage() && (
                    <p className="text-xs text-orange-500">{getValidationMessage()}</p>
                  )}
                </div>
              )}

              {/* Percentage */}
              {splitMethod === 'percentage' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">Enter percentage for each person. Must total 100%.</p>
                  {allPeople.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="text-gray-700 text-sm w-32 truncate">{getName(p)}</span>
                      <div className="flex items-center flex-1">
                        <input
                          type="number"
                          step="0.01"
                          value={percentages[p.id] || ''}
                          onChange={(e) => setPercentages({ ...percentages, [p.id]: e.target.value })}
                          placeholder="0"
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <span className="text-gray-400 text-sm ml-1">%</span>
                      </div>
                      {amount && percentages[p.id] && (
                        <span className="text-gray-400 text-xs">
                          {symbol}{(parseFloat(amount) * (parseFloat(percentages[p.id]) || 0) / 100).toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
                  {getValidationMessage() && (
                    <p className="text-xs text-orange-500">{getValidationMessage()}</p>
                  )}
                </div>
              )}

              {/* Shares */}
              {splitMethod === 'shares' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">Enter share count for each person. Split is proportional.</p>
                  {allPeople.map((p) => {
                    const totalShares = allPeople.reduce((acc, p2) => acc + (parseFloat(shares[p2.id]) || 0), 0)
                    const preview = totalShares > 0 && amount
                      ? (parseFloat(amount) * (parseFloat(shares[p.id]) || 0) / totalShares).toFixed(2)
                      : null
                    return (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="text-gray-700 text-sm w-32 truncate">{getName(p)}</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={shares[p.id] || ''}
                          onChange={(e) => setShares({ ...shares, [p.id]: e.target.value })}
                          placeholder="1"
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <span className="text-gray-400 text-xs">shares</span>
                        {preview && (
                          <span className="text-gray-400 text-xs ml-auto">{symbol}{preview}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Adjustments */}
              {splitMethod === 'adjustments' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">Enter extra amount each person owes. The rest is split equally.</p>
                  {allPeople.map((p) => {
                    const totalAdj = allPeople.reduce((acc, p2) => acc + (parseFloat(adjustments[p2.id]) || 0), 0)
                    const remainder = amount ? parseFloat(amount) - totalAdj : 0
                    const equalPart = remainder > 0 ? remainder / allPeople.length : 0
                    const adj = parseFloat(adjustments[p.id]) || 0
                    const preview = amount ? (equalPart + adj).toFixed(2) : null
                    return (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="text-gray-700 text-sm w-32 truncate">{getName(p)}</span>
                        <div className="flex items-center">
                          <span className="text-gray-400 text-sm mr-1">+{symbol}</span>
                          <input
                            type="number"
                            step="0.01"
                            value={adjustments[p.id] || ''}
                            onChange={(e) => setAdjustments({ ...adjustments, [p.id]: e.target.value })}
                            placeholder="0"
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        {preview && (
                          <span className="text-gray-400 text-xs ml-auto">Total: {symbol}{preview}</span>
                        )}
                      </div>
                    )
                  })}
                  {getValidationMessage() && (
                    <p className="text-xs text-orange-500">{getValidationMessage()}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-700 text-white py-2 rounded hover:bg-purple-800 disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Expense'}
          </button>
        </form>
      </div>
    </AuthGuard>
  )
}