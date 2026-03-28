import { supabase } from './supabase'

export async function ensureFriendship(userIdA: string, userIdB: string) {
  if (userIdA === userIdB) return

  // Check if friendship already exists in either direction (any status)
  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .or(
      `and(user_id.eq.${userIdA},friend_id.eq.${userIdB}),and(user_id.eq.${userIdB},friend_id.eq.${userIdA})`
    )

  if (existing && existing.length > 0) {
    // If there's a pending one, upgrade it to accepted
    for (const f of existing) {
      if (f.status === 'pending') {
        await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('id', f.id)
      }
    }
    return
  }

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