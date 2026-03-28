'use client'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AuthGuard from '@/components/AuthGuard'

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

export default function NewExpense() {
  const params = useParams()
  const groupId = params.id as string
  const router = useRouter()

  const [members, setMembers] = useState<any[]>([])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [paidBy, setPaidBy] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal')
  const [splitWith, setSplitWith] = useState<string[]>([])
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({})
  const [percentages, setPercentages] = useState<Record<string, string>>({})
  const [shares, setShares] = useState<Record<string, string>>({})
  const [adjustments, setAdjustments] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from('group_members')
        .select('user_id, profiles(id, name, email)')
        .eq('group_id', groupId)

      if (data) {
        setMembers(data)
        setSplitWith(data.map((m) => m.user_id))

        const defaults: Record<string, string> = {}
        const zeroDefaults: Record<string, string> = {}
        const shareDefaults: Record<string, string> = {}
        data.forEach((m) => {
          defaults[m.user_id] = ''
          zeroDefaults[m.user_id] = '0'
          shareDefaults[m.user_id] = '1'
        })
        setExactAmounts(defaults)
        setPercentages(defaults)
        setShares(shareDefaults)
        setAdjustments(zeroDefaults)

        const { data: { session } } = await supabase.auth.getSession()
        if (session) setPaidBy(session.user.id)
      }
    }

    fetchMembers()
  }, [groupId])

  const toggleSplitWith = (userId: string) => {
    if (splitWith.includes(userId)) {
      setSplitWith(splitWith.filter((id) => id !== userId))
    } else {
      setSplitWith([...splitWith, userId])
    }
  }

  const getMemberName = (m: any) => (m.profiles as any)?.name || (m.profiles as any)?.email || 'Unknown'

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
      const splits = members
        .filter((m) => parseFloat(exactAmounts[m.user_id]) > 0)
        .map((m) => ({
          userId: m.user_id,
          amountOwed: parseFloat(exactAmounts[m.user_id]) || 0,
        }))
      const sum = splits.reduce((acc, s) => acc + s.amountOwed, 0)
      if (Math.abs(sum - totalAmount) > 0.01) return null
      return splits
    }

    if (splitMethod === 'percentage') {
      const splits = members
        .filter((m) => parseFloat(percentages[m.user_id]) > 0)
        .map((m) => ({
          userId: m.user_id,
          amountOwed: Math.round((totalAmount * (parseFloat(percentages[m.user_id]) || 0)) / 100 * 100) / 100,
        }))
      const totalPct = members.reduce((acc, m) => acc + (parseFloat(percentages[m.user_id]) || 0), 0)
      if (Math.abs(totalPct - 100) > 0.01) return null
      return splits
    }

    if (splitMethod === 'shares') {
      const totalShares = members.reduce((acc, m) => acc + (parseFloat(shares[m.user_id]) || 0), 0)
      if (totalShares <= 0) return null
      return members
        .filter((m) => parseFloat(shares[m.user_id]) > 0)
        .map((m) => ({
          userId: m.user_id,
          amountOwed: Math.round((totalAmount * (parseFloat(shares[m.user_id]) || 0) / totalShares) * 100) / 100,
        }))
    }

    if (splitMethod === 'adjustments') {
      const totalAdj = members.reduce((acc, m) => acc + (parseFloat(adjustments[m.user_id]) || 0), 0)
      const remainder = totalAmount - totalAdj
      if (remainder < 0) return null
      const equalPart = Math.round((remainder / members.length) * 100) / 100
      return members.map((m, index) => {
        const adj = parseFloat(adjustments[m.user_id]) || 0
        let owed = equalPart + adj
        if (index === 0) {
          owed = Math.round((remainder - equalPart * (members.length - 1) + adj) * 100) / 100
        }
        return { userId: m.user_id, amountOwed: owed }
      }).filter((s) => s.amountOwed > 0)
    }

    return null
  }

  const getValidationMessage = (): string | null => {
    const totalAmount = parseFloat(amount)
    if (!amount || isNaN(totalAmount)) return null

    if (splitMethod === 'exact') {
      const sum = members.reduce((acc, m) => acc + (parseFloat(exactAmounts[m.user_id]) || 0), 0)
      const diff = Math.round((totalAmount - sum) * 100) / 100
      if (diff !== 0) return `${diff > 0 ? diff.toFixed(2) + ' left to assign' : 'Over by ' + Math.abs(diff).toFixed(2)}`
    }

    if (splitMethod === 'percentage') {
      const totalPct = members.reduce((acc, m) => acc + (parseFloat(percentages[m.user_id]) || 0), 0)
      const diff = Math.round((100 - totalPct) * 100) / 100
      if (diff !== 0) return `${diff > 0 ? diff + '% left to assign' : 'Over by ' + Math.abs(diff) + '%'}`
    }

    if (splitMethod === 'adjustments') {
      const totalAdj = members.reduce((acc, m) => acc + (parseFloat(adjustments[m.user_id]) || 0), 0)
      if (totalAdj > totalAmount) return 'Adjustments exceed the total amount'
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const splits = calculateSplits()
    if (!splits || splits.length === 0) {
      setError(getValidationMessage() || 'Invalid split. Check your numbers.')
      setLoading(false)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setLoading(false)
      return
    }

    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        group_id: groupId,
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

    router.push(`/groups/${groupId}`)
  }

  const symbol = getSymbol(currency)

  return (
    <AuthGuard>
      <div className="max-w-md mx-auto">
        <a href={`/groups/${groupId}`} className="text-purple-600 hover:underline text-sm">
          &larr; Back to Group
        </a>

        <h1 className="text-2xl font-bold text-purple-700 mt-4 mb-6">Add Expense</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Dinner, Groceries"
              required
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paid by</label>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>{getMemberName(m)}</option>
              ))}
            </select>
          </div>

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

            {splitMethod === 'equal' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">Select who to split with equally.</p>
                {members.map((m) => (
                  <label key={m.user_id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={splitWith.includes(m.user_id)}
                      onChange={() => toggleSplitWith(m.user_id)}
                      className="accent-purple-700"
                    />
                    <span className="text-gray-700">{getMemberName(m)}</span>
                    {splitWith.includes(m.user_id) && amount && splitWith.length > 0 && (
                      <span className="text-gray-400 text-sm ml-auto">
                        {symbol}{(parseFloat(amount) / splitWith.length).toFixed(2)}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {splitMethod === 'exact' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">Enter exact amount each person owes.</p>
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2">
                    <span className="text-gray-700 text-sm w-32 truncate">{getMemberName(m)}</span>
                    <div className="flex items-center flex-1">
                      <span className="text-gray-400 text-sm mr-1">{symbol}</span>
                      <input
                        type="number"
                        step="0.01"
                        value={exactAmounts[m.user_id] || ''}
                        onChange={(e) => setExactAmounts({ ...exactAmounts, [m.user_id]: e.target.value })}
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

            {splitMethod === 'percentage' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">Enter percentage for each person. Must total 100%.</p>
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2">
                    <span className="text-gray-700 text-sm w-32 truncate">{getMemberName(m)}</span>
                    <div className="flex items-center flex-1">
                      <input
                        type="number"
                        step="0.01"
                        value={percentages[m.user_id] || ''}
                        onChange={(e) => setPercentages({ ...percentages, [m.user_id]: e.target.value })}
                        placeholder="0"
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="text-gray-400 text-sm ml-1">%</span>
                    </div>
                    {amount && percentages[m.user_id] && (
                      <span className="text-gray-400 text-xs">
                        {symbol}{(parseFloat(amount) * (parseFloat(percentages[m.user_id]) || 0) / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
                {getValidationMessage() && (
                  <p className="text-xs text-orange-500">{getValidationMessage()}</p>
                )}
              </div>
            )}

            {splitMethod === 'shares' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">Enter share count for each person. Split is proportional.</p>
                {members.map((m) => {
                  const totalShares = members.reduce((acc, m2) => acc + (parseFloat(shares[m2.user_id]) || 0), 0)
                  const preview = totalShares > 0 && amount
                    ? (parseFloat(amount) * (parseFloat(shares[m.user_id]) || 0) / totalShares).toFixed(2)
                    : null
                  return (
                    <div key={m.user_id} className="flex items-center gap-2">
                      <span className="text-gray-700 text-sm w-32 truncate">{getMemberName(m)}</span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={shares[m.user_id] || ''}
                        onChange={(e) => setShares({ ...shares, [m.user_id]: e.target.value })}
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

            {splitMethod === 'adjustments' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">Enter extra amount each person owes. The rest is split equally.</p>
                {members.map((m) => {
                  const totalAdj = members.reduce((acc, m2) => acc + (parseFloat(adjustments[m2.user_id]) || 0), 0)
                  const remainder = amount ? parseFloat(amount) - totalAdj : 0
                  const equalPart = remainder > 0 ? remainder / members.length : 0
                  const adj = parseFloat(adjustments[m.user_id]) || 0
                  const preview = amount ? (equalPart + adj).toFixed(2) : null
                  return (
                    <div key={m.user_id} className="flex items-center gap-2">
                      <span className="text-gray-700 text-sm w-32 truncate">{getMemberName(m)}</span>
                      <div className="flex items-center">
                        <span className="text-gray-400 text-sm mr-1">+{symbol}</span>
                        <input
                          type="number"
                          step="0.01"
                          value={adjustments[m.user_id] || ''}
                          onChange={(e) => setAdjustments({ ...adjustments, [m.user_id]: e.target.value })}
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
