'use client'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

export default function FriendSettle() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const friendId = searchParams.get('to') === 'me' ? searchParams.get('from') : searchParams.get('to')

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [fromName, setFromName] = useState('')
  const [toName, setToName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const fromNameParam = searchParams.get('fromName')
    const toNameParam = searchParams.get('toName')
    const amountParam = searchParams.get('amount')
    const currencyParam = searchParams.get('currency')

    if (fromParam) setFrom(fromParam)
    if (toParam) setTo(toParam)
    if (fromNameParam) setFromName(decodeURIComponent(fromNameParam))
    if (toNameParam) setToName(decodeURIComponent(toNameParam))
    if (amountParam) setAmount(amountParam)
    if (currencyParam) setCurrency(currencyParam)
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const settlementAmount = parseFloat(amount)
    if (isNaN(settlementAmount) || settlementAmount <= 0) {
      setError('Enter a valid amount.')
      setLoading(false)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Determine who is paying whom
    const paidBy = from === 'me' ? session.user.id : from
    const paidTo = to === 'me' ? session.user.id : to

    // Create settlement record
    const { error: settlementError } = await supabase
      .from('settlements')
      .insert({
        group_id: null, // Friend settlements don't belong to a group
        paid_by: paidBy,
        paid_to: paidTo,
        amount: settlementAmount,
        currency,
        date,
      })

    if (settlementError) {
      setError(settlementError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  const symbol = getSymbol(currency)

  return (
    <AuthGuard>
      <div className="max-w-md mx-auto">
        <a href={`/friends/${friendId}`} className="text-purple-600 hover:underline text-sm">
          &larr; Back to {toName}
        </a>

        <h1 className="text-2xl font-bold text-purple-700 mt-4 mb-6">Settle Up</h1>

        <div className="bg-purple-50 rounded p-4 mb-6">
          <p className="text-sm text-gray-600">
            {fromName} pays {toName} {symbol}{amount}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input
              type="text"
              value={fromName}
              readOnly
              className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="text"
              value={toName}
              readOnly
              className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-50"
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
                {Object.entries(CURRENCIES).map(([code, sym]) => (
                  <option key={code} value={code}>{sym} {code}</option>
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

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-800 disabled:opacity-50"
          >
            {loading ? 'Recording...' : 'Record Payment'}
          </button>
        </form>
      </div>
    </AuthGuard>
  )
}