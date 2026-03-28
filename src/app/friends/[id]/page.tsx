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

export default function FriendDetail() {
  const params = useParams()
  const friendId = params.id as string

  const [friend, setFriend] = useState<any>(null)
  const [expenses, setExpenses] = useState<any[]>([])
  const [balances, setBalances] = useState<{ currency: string; amount: number }[]>([])
  const [settlements, setSettlements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const currentUserId = session.user.id

      // Get friend profile
      const { data: friendData } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', friendId)
        .single()

      setFriend(friendData)

      // Get all expenses where both you and the friend are involved
      const { data: allExpenses } = await supabase
        .from('expenses')
        .select('*, profiles!paid_by(name, email), expense_splits(user_id, amount_owed, profiles(name, email))')
        .order('created_at', { ascending: false })

      // Filter to expenses involving both you and the friend
      const sharedExpenses = (allExpenses || []).filter((expense) => {
        const involvedUsers = expense.expense_splits?.map((s: any) => s.user_id) || []
        const payerInvolved = expense.paid_by === currentUserId || expense.paid_by === friendId
        const splitInvolved = involvedUsers.includes(currentUserId) && involvedUsers.includes(friendId)
        return payerInvolved && splitInvolved
      })

      setExpenses(sharedExpenses)

      // Calculate balances between you and friend
      const netByCurrency: Record<string, number> = {}

      for (const expense of sharedExpenses) {
        const currency = expense.currency
        if (!netByCurrency[currency]) netByCurrency[currency] = 0

        const paidBy = expense.paid_by

        for (const split of expense.expense_splits || []) {
          if (split.user_id === paidBy) continue

          const amount = parseFloat(split.amount_owed)

          if (paidBy === currentUserId && split.user_id === friendId) {
            // Friend owes me
            netByCurrency[currency] -= amount
          } else if (paidBy === friendId && split.user_id === currentUserId) {
            // I owe friend
            netByCurrency[currency] += amount
          }
        }
      }

      // Get settlements between you and friend
      const { data: settlementData } = await supabase
        .from('settlements')
        .select('*, payer:profiles!paid_by(name, email), payee:profiles!paid_to(name, email)')

      for (const settlement of (settlementData || [])) {
        const currency = settlement.currency
        if (!netByCurrency[currency]) netByCurrency[currency] = 0
        const amount = parseFloat(settlement.amount)

        if (settlement.paid_by === currentUserId && settlement.paid_to === friendId) {
          netByCurrency[currency] -= amount
        } else if (settlement.paid_by === friendId && settlement.paid_to === currentUserId) {
          netByCurrency[currency] += amount
        }
      }

      const balanceList = Object.entries(netByCurrency)
        .map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }))
        .filter((b) => b.amount !== 0)

      // Filter settlements between you and friend
      const friendSettlements = (settlementData || []).filter((s: any) =>
        (s.paid_by === currentUserId && s.paid_to === friendId) ||
        (s.paid_by === friendId && s.paid_to === currentUserId)
      )
      setSettlements(friendSettlements)

      setBalances(balanceList)
      setLoading(false)
    }

    fetchData()
  }, [friendId])

  if (loading) return <p className="p-8">Loading...</p>
  if (!friend) return <p className="p-8">Friend not found.</p>

  return (
    <AuthGuard>
      <div>
        <a href="/dashboard" className="text-purple-600 hover:underline text-sm">&larr; Back to Dashboard</a>

        <h1 className="text-2xl font-bold text-purple-700 mt-4 mb-2">{friend.name}</h1>
        <p className="text-gray-400 text-sm mb-6">{friend.email}</p>

        {/* Balance summary */}
        <div className="border border-gray-200 rounded p-4 mb-8">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">Balance</h2>
          {balances.length === 0 ? (
            <p className="text-lg font-bold text-gray-300">All settled up!</p>
          ) : (
            balances.map((b) => (
              <div key={b.currency} className="flex justify-between items-center">
                <p className={`text-lg font-bold ${b.amount > 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {b.amount > 0
                    ? `You owe ${getSymbol(b.currency)}${b.amount.toFixed(2)}`
                    : `Owes you ${getSymbol(b.currency)}${Math.abs(b.amount).toFixed(2)}`
                  }
                </p>
                <a
                  href={`/friends/${friendId}/settle?from=${b.amount > 0 ? 'me' : friendId}&to=${b.amount > 0 ? friendId : 'me'}&fromName=${b.amount > 0 ? 'You' : encodeURIComponent(friend.name)}&toName=${b.amount > 0 ? encodeURIComponent(friend.name) : 'You'}&amount=${Math.abs(b.amount).toFixed(2)}&currency=${b.currency}`}
                  className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                >
                  Settle Up
                </a>
              </div>
            ))
          )}
        </div>

        {/* Activity */}
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Activity</h2>

        {(() => {
          const activity = [
            ...expenses.map((e) => ({ ...e, type: 'expense' as const, sortDate: e.created_at })),
            ...settlements.map((s) => ({ ...s, type: 'settlement' as const, sortDate: s.created_at })),
          ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())

          if (activity.length === 0) {
            return <p className="text-gray-400 text-sm">No activity yet.</p>
          }

          return (
            <ul className="space-y-3">
              {activity.map((item) => {
                if (item.type === 'settlement') {
                  const payerName = (item as any).payer?.name || (item as any).payer?.email || 'Unknown'
                  const payeeName = (item as any).payee?.name || (item as any).payee?.email || 'Unknown'
                  const symbol = getSymbol(item.currency)

                  return (
                    <li key={item.id} className="border border-green-200 bg-green-50 rounded p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-green-700">Settlement</p>
                          <p className="text-sm text-gray-500 mt-1">
                            <span className="text-green-600">{payerName}</span>
                            {' paid '}
                            <span className="text-green-600">{payeeName}</span>
                            {' on '}
                            {new Date(item.date).toLocaleDateString()}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-green-700">
                          {symbol}{parseFloat(item.amount).toFixed(2)}
                        </p>
                      </div>
                    </li>
                  )
                }

                const expense = item
                const payer = (expense.profiles as any)?.name || (expense.profiles as any)?.email || 'Unknown'
                const symbol = getSymbol(expense.currency)

                return (
                  <li key={expense.id} className="border border-gray-200 rounded p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-800">{expense.description}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Paid by <span className="text-purple-600">{payer}</span> on {new Date(expense.date).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-purple-700">
                        {symbol}{parseFloat(expense.amount).toFixed(2)}
                      </p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex flex-wrap gap-2">
                        {expense.expense_splits?.map((split: any) => (
                          <span
                            key={split.user_id}
                            className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded"
                          >
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
    </AuthGuard>
  )
}