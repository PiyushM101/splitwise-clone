'use client'
import { supabase } from '@/lib/supabase'
import { useCallback, useEffect, useState } from 'react'
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

export default function GroupDetail() {
  const params = useParams()
  const groupId = params.id as string

  const [group, setGroup] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchGroup = useCallback(async () => {
    const { data: groupData } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single()

    setGroup(groupData)

    const { data: memberData } = await supabase
      .from('group_members')
      .select('user_id, joined_at, profiles(name, email)')
      .eq('group_id', groupId)

    setMembers(memberData || [])

    const { data: expenseData } = await supabase
      .from('expenses')
      .select('*, profiles!paid_by(name, email), expense_splits(user_id, amount_owed, profiles(name, email))')
      .eq('group_id', groupId)
      .order('date', { ascending: false })

    setExpenses(expenseData || [])
    setLoading(false)
  }, [groupId])

  useEffect(() => {
    fetchGroup()
  }, [fetchGroup])

  const handleDelete = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return

    await supabase.from('expense_splits').delete().eq('expense_id', expenseId)
    await supabase.from('expenses').delete().eq('id', expenseId)
    fetchGroup()
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', newEmail)
      .single()

    if (!profile) {
      setError('No user found with that email.')
      return
    }

    const alreadyMember = members.some((m) => m.user_id === profile.id)
    if (alreadyMember) {
      setError('This person is already in the group.')
      return
    }

    const { error: addError } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: profile.id })

    if (addError) {
      setError(addError.message)
      return
    }

    setSuccess(`Added ${profile.email} to the group!`)
    setNewEmail('')
    fetchGroup()
  }

  if (loading) return <p className="p-8">Loading...</p>
  if (!group) return <p className="p-8">Group not found.</p>

  return (
    <AuthGuard>
      <div>
        <a href="/dashboard" className="text-purple-600 hover:underline text-sm">&larr; Back to Dashboard</a>

        <h1 className="text-2xl font-bold text-purple-700 mt-4 mb-6">{group.name}</h1>

        {/* Members list */}
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Members</h2>
        <ul className="space-y-2 mb-8">
          {members.map((member) => (
            <li
              key={member.user_id}
              className="border border-gray-200 rounded p-3 flex justify-between items-center"
            >
              <div>
                <span className="font-medium text-gray-800">
                  {(member.profiles as any)?.name || 'Unknown'}
                </span>
                <span className="text-gray-400 text-sm ml-2">
                  {(member.profiles as any)?.email}
                </span>
              </div>
            </li>
          ))}
        </ul>

        {/* Add member form */}
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Add a Member</h2>
        <form onSubmit={handleAddMember} className="flex gap-3 mb-10">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Enter their email"
            required
            className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="submit"
            className="bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-800"
          >
            Add
          </button>
        </form>

        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        {success && <p className="text-green-600 text-sm mt-2">{success}</p>}

        {/* Expenses */}
        <div className="border-t pt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Expenses</h2>
            <a
              href={`/groups/${groupId}/new`}
              className="bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-800 text-sm"
            >
              + Add Expense
            </a>
          </div>

          {expenses.length === 0 ? (
            <p className="text-gray-400 text-sm">No expenses yet.</p>
          ) : (
            <ul className="space-y-3">
              {expenses.map((expense) => {
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
                      <div className="text-right">
                        <p className="text-lg font-bold text-purple-700">
                          {symbol}{parseFloat(expense.amount).toFixed(2)}
                        </p>
                        <div className="flex gap-2 mt-1 justify-end">
                          <a
                            href={`/groups/${groupId}/edit/${expense.id}`}
                            className="text-xs text-purple-600 hover:underline"
                          >
                            Edit
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDelete(expense.id)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Split details */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-400 mb-2">Split between:</p>
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
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
