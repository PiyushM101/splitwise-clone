'use client'
import { supabase } from '@/lib/supabase'
import { useCallback, useEffect, useState } from 'react'
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

export default function EditExpense() {
  const params = useParams()
  const groupId = params.id as string
  const expenseId = params.expenseId as string
  const router = useRouter()

  const [members, setMembers] = useState<any[]>([])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [paidBy, setPaidBy] = useState('')
  const [splitWith, setSplitWith] = useState<string[]>([])
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const { data: memberData } = await supabase
      .from('group_members')
      .select('user_id, profiles(id, name, email)')
      .eq('group_id', groupId)

    if (memberData) setMembers(memberData)

    const { data: expense } = await supabase
      .from('expenses')
      .select('*, expense_splits(user_id, amount_owed)')
      .eq('id', expenseId)
      .single()

    if (expense) {
      setDescription(expense.description)
      setAmount(parseFloat(String(expense.amount)).toString())
      setCurrency(expense.currency)
      setPaidBy(expense.paid_by)
      const rawDate = expense.date as string
      setDate(typeof rawDate === 'string' ? rawDate.slice(0, 10) : '')
      setSplitWith((expense.expense_splits as any[])?.map((s: any) => s.user_id) ?? [])
    }

    setPageLoading(false)
  }, [groupId, expenseId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleSplitWith = (userId: string) => {
    if (splitWith.includes(userId)) {
      setSplitWith(splitWith.filter((id) => id !== userId))
    } else {
      setSplitWith([...splitWith, userId])
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (splitWith.length === 0) {
      setError('Select at least one person to split with.')
      setLoading(false)
      return
    }

    const totalAmount = parseFloat(amount)
    if (isNaN(totalAmount) || totalAmount <= 0) {
      setError('Enter a valid amount.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('expenses')
      .update({
        description,
        amount: totalAmount,
        currency,
        paid_by: paidBy,
        date,
      })
      .eq('id', expenseId)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    const { error: deleteError } = await supabase
      .from('expense_splits')
      .delete()
      .eq('expense_id', expenseId)

    if (deleteError) {
      setError(deleteError.message)
      setLoading(false)
      return
    }

    const splitAmount = Math.round((totalAmount / splitWith.length) * 100) / 100
    const splits = splitWith.map((userId, index) => ({
      expense_id: expenseId,
      user_id: userId,
      amount_owed:
        index === 0
          ? Math.round((totalAmount - splitAmount * (splitWith.length - 1)) * 100) / 100
          : splitAmount,
    }))

    const { error: splitError } = await supabase
      .from('expense_splits')
      .insert(splits)

    if (splitError) {
      setError(splitError.message)
      setLoading(false)
      return
    }

    router.push(`/groups/${groupId}`)
  }

  if (pageLoading) return <p className="p-8">Loading...</p>

  return (
    <AuthGuard>
      <div className="max-w-md mx-auto">
        <a href={`/groups/${groupId}`} className="text-purple-600 hover:underline text-sm">
          &larr; Back to Group
        </a>

        <h1 className="text-2xl font-bold text-purple-700 mt-4 mb-6">Edit Expense</h1>

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                <option key={m.user_id} value={m.user_id}>
                  {(m.profiles as any)?.name || (m.profiles as any)?.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Split equally with</label>
            <div className="space-y-2">
              {members.map((m) => (
                <label key={m.user_id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={splitWith.includes(m.user_id)}
                    onChange={() => toggleSplitWith(m.user_id)}
                    className="accent-purple-700"
                  />
                  <span className="text-gray-700">
                    {(m.profiles as any)?.name || (m.profiles as any)?.email}
                  </span>
                  {splitWith.includes(m.user_id) && amount && (
                    <span className="text-gray-400 text-sm ml-auto">
                      {getSymbol(currency)}{(parseFloat(amount) / splitWith.length).toFixed(2)}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-700 text-white py-2 rounded hover:bg-purple-800 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </AuthGuard>
  )
}
