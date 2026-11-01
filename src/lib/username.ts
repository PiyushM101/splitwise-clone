import { supabase } from './supabase'

// Mirrors the profiles_username_format check constraint in
// supabase/migrations/0001_add_username.sql. Keep the two in step.
export const USERNAME_RULES = '3-20 characters, starting with a letter. Letters, numbers and underscores only.'

const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/

export function normalizeUsername(input: string) {
  return input.trim().toLowerCase()
}

// Returns an error message, or null when the username is well formed.
export function validateUsername(input: string) {
  const username = normalizeUsername(input)

  if (!username) return 'Pick a username.'
  if (username.length < 3) return 'Username must be at least 3 characters.'
  if (username.length > 20) return 'Username must be 20 characters or fewer.'
  if (!/^[a-z]/.test(username)) return 'Username must start with a letter.'
  if (!USERNAME_PATTERN.test(username)) return 'Username can only contain letters, numbers and underscores.'

  return null
}

// Checked up front so signup and renames can show a friendly message instead of
// surfacing the unique index violation. The index is still the real guard.
export async function isUsernameTaken(input: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', normalizeUsername(input))
    .limit(1)

  return (data || []).length > 0
}
