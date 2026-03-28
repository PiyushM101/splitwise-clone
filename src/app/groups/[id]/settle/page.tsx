'use client'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
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

export default function SettlePage() {
  const params = useParams()
  const groupId = params.id as string
  const searchParams = useSearchParams()
  const router = useRouter()

  const [amount, setAmount] = useState(searchParams.get('amount') || '')
  const [currency, setCurrency] = useState(searchParams.get('currency') || 'USD')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const fromId = searchParams.get('from') || ''
  const toId = searchParams.get('to') || ''
  const fromName = searchParams.get('fromName') || 'Someone'
  const toName = searchParams.get('toName') || 'Someone'

  const symbol = getSymbol(currency)

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const settleAmount = parseFloat(amount)
    if (isNaN(settleAmount) || settleAmount <= 0) {
      setError('Enter a valid amount.')
      setLoading(false)
      return
    }

    const { error: settleError } = await supabase
      .from('settlements')
      .insert({
        group_id: groupId,
        paid_by: fromId,
        paid_to: toId,
        amount: settleAmount,
        currency,
        date,
      })

    if (settleError) {
      setError(settleError.message)
      setLoading(false)
      return
    }

    router.push(`/groups/${groupId}`)
  }

  return (
    <AuthGuard>
      <div className="max-w-md mx-auto">
        <a href={`/groups/${groupId}`} className="text-purple-600 hover:underline text-sm">
          &larr; Back to Group
        </a>

        <h1 className="text-2xl font-bold text-purple-700 mt-4 mb-6">Settle Up</h1>

        <div className="bg-purple-50 rounded p-4 mb-6">
          <p className="text-sm text-gray-700">
            <span className="font-medium text-red-500">{fromName}</span>
            {' pays '}
            <span className="font-medium text-green-600">{toName}</span>
          </p>
        </div>

        <form onSubmit={handleSettle} className="space-y-4">
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

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-700 text-white py-2 rounded hover:bg-purple-800 disabled:opacity-50"
          >
            {loading ? 'Recording...' : `Record ${symbol}${amount || '0.00'} Payment`}
          </button>
        </form>
      </div>
    </AuthGuard>
  )
}