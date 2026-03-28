import { supabase } from './supabase'

export async function ensureFriendship(userIdA: string, userIdB: string) {
  if (userIdA === userIdB) return

  // Check if friendship already exists in either direction
  const { data: existing } = await supabase
    .from('friendships')
    .select('id')
    .or(
      `and(user_id.eq.${userIdA},friend_id.eq.${userIdB}),and(user_id.eq.${userIdB},friend_id.eq.${userIdA})`
    )

  if (existing && existing.length > 0) return

  // Create accepted friendship
  await supabase
    .from('friendships')
    .insert({ user_id: userIdA, friend_id: userIdB, status: 'accepted' })
}

export async function ensureFriendshipsWithAll(userId: string, otherUserIds: string[]) {
  for (const otherId of otherUserIds) {
    await ensureFriendship(userId, otherId)
  }
}