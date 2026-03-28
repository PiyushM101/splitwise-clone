'use client'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function NewFriendExpense() {
  const router = useRouter()

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [friendEmail, setFriendEmail] = useState('')
  const [whoPaid, setWhoPaid] = useState<'me' | 'friend'>('me')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const symbol = getSymbol(currency)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const totalAmount = parseFloat(amount)
    if (isNaN(totalAmount) || totalAmount <= 0) {
      setError('Enter a valid amount.')
      setLoading(false)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Find the friend
    const { data: friend } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', friendEmail)
      .single()

    if (!friend) {
      setError('No user found with that email.')
      setLoading(false)
      return
    }

    if (friend.id === session.user.id) {
      setError("You can't add an expense with yourself.")
      setLoading(false)
      return
    }

    const paidBy = whoPaid === 'me' ? session.user.id : friend.id
    const splitAmount = Math.round((totalAmount / 2) * 100) / 100

    // Create the expense without a group
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        group_id: null,
        description,
        amount: totalAmount,
        currency,
        paid_by: paidBy,
        created_by: session.user.id,
        date,
        split_method: 'equal',
      })
      .select()
      .single()

    if (expenseError) {
      setError(expenseError.message)
      setLoading(false)
      return
    }

    // Split equally between you and friend
    const splits = [
      {
        expense_id: expense.id,
        user_id: session.user.id,
        amount_owed: splitAmount,
      },
      {
        expense_id: expense.id,
        user_id: friend.id,
        amount_owed: Math.round((totalAmount - splitAmount) * 100) / 100,
      },
    ]

    const { error: splitError } = await supabase
      .from('expense_splits')
      .insert(splits)

    if (splitError) {
      setError(splitError.message)
      setLoading(false)
      return
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Friend's Email</label>
            <input
              type="email"
              value={friendEmail}
              onChange={(e) => setFriendEmail(e.target.value)}
              placeholder="friend@example.com"
              required
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

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
            <label className="block text-sm font-medium text-gray-700 mb-2">Who paid?</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setWhoPaid('me')}
                className={`flex-1 py-2 rounded text-sm ${
                  whoPaid === 'me'
                    ? 'bg-purple-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                I paid
              </button>
              <button
                type="button"
                onClick={() => setWhoPaid('friend')}
                className={`flex-1 py-2 rounded text-sm ${
                  whoPaid === 'friend'
                    ? 'bg-purple-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Friend paid
              </button>
            </div>
          </div>

          {amount && (
            <div className="bg-purple-50 rounded p-3">
              <p className="text-sm text-gray-600">
                Split equally: {symbol}{(parseFloat(amount) / 2).toFixed(2)} each
              </p>
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