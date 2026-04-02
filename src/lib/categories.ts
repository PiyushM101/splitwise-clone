export const CATEGORIES = [
  { value: 'Food & Drink', emoji: '🍔', keywords: ['lunch', 'dinner', 'breakfast', 'coffee', 'beer', 'drinks', 'restaurant', 'pizza', 'burger', 'sushi', 'bar', 'cafe', 'brunch', 'snack', 'takeout', 'delivery', 'wine', 'cocktail', 'pub', 'food', 'eat', 'meal', 'dine', 'taco', 'noodle', 'ramen', 'steak', 'bbq', 'juice', 'tea', 'boba', 'donut', 'ice cream', 'dessert'] },
  { value: 'Groceries', emoji: '🛒', keywords: ['grocery', 'groceries', 'supermarket', 'walmart', 'costco', 'trader joe', 'whole foods', 'aldi', 'target', 'market', 'produce', 'milk', 'eggs', 'bread'] },
  { value: 'Transport', emoji: '🚗', keywords: ['uber', 'lyft', 'taxi', 'cab', 'gas', 'fuel', 'parking', 'toll', 'bus', 'train', 'metro', 'subway', 'transit', 'car', 'ride', 'petrol', 'diesel', 'auto'] },
  { value: 'Rent', emoji: '🏠', keywords: ['rent', 'lease', 'mortgage', 'housing', 'apartment'] },
  { value: 'Utilities', emoji: '💡', keywords: ['electric', 'electricity', 'water', 'gas bill', 'internet', 'wifi', 'phone bill', 'utility', 'utilities', 'cable', 'power', 'heating', 'ac'] },
  { value: 'Entertainment', emoji: '🎬', keywords: ['movie', 'movies', 'cinema', 'concert', 'show', 'theater', 'theatre', 'netflix', 'spotify', 'game', 'games', 'bowling', 'arcade', 'karaoke', 'club', 'party', 'festival', 'ticket', 'tickets'] },
  { value: 'Shopping', emoji: '🛍️', keywords: ['amazon', 'clothes', 'clothing', 'shoes', 'shirt', 'dress', 'jacket', 'shopping', 'mall', 'store', 'electronics', 'gadget', 'furniture', 'decor'] },
  { value: 'Travel', emoji: '✈️', keywords: ['flight', 'hotel', 'airbnb', 'hostel', 'resort', 'vacation', 'trip', 'travel', 'booking', 'luggage', 'airport', 'cruise', 'tour', 'visa', 'passport'] },
  { value: 'Health', emoji: '🏥', keywords: ['doctor', 'hospital', 'medicine', 'pharmacy', 'drug', 'prescription', 'dental', 'dentist', 'gym', 'fitness', 'health', 'medical', 'therapy', 'vitamin', 'insurance'] },
  { value: 'Education', emoji: '📚', keywords: ['book', 'books', 'course', 'class', 'tuition', 'school', 'college', 'university', 'study', 'tutorial', 'exam', 'textbook', 'supplies'] },
  { value: 'Gifts', emoji: '🎁', keywords: ['gift', 'present', 'birthday', 'wedding', 'anniversary', 'christmas', 'holiday', 'surprise', 'flowers', 'card'] },
  { value: 'Sports', emoji: '⚽', keywords: ['sports', 'football', 'basketball', 'soccer', 'tennis', 'golf', 'swim', 'ski', 'yoga', 'hiking', 'cycling', 'run', 'marathon', 'equipment'] },
  { value: 'Subscriptions', emoji: '📱', keywords: ['subscription', 'membership', 'plan', 'monthly', 'annual', 'premium', 'pro', 'plus', 'hulu', 'disney', 'apple', 'google', 'cloud'] },
  { value: 'Personal Care', emoji: '💇', keywords: ['haircut', 'salon', 'barber', 'spa', 'massage', 'nail', 'beauty', 'skincare', 'cosmetic', 'makeup', 'grooming'] },
  { value: 'Household', emoji: '🧹', keywords: ['cleaning', 'laundry', 'repair', 'maintenance', 'plumber', 'handyman', 'tools', 'garden', 'lawn', 'trash', 'supplies', 'household'] },
  { value: 'Pets', emoji: '🐾', keywords: ['pet', 'dog', 'cat', 'vet', 'veterinary', 'pet food', 'grooming', 'kennel', 'fish', 'bird', 'animal'] },
  { value: 'Other', emoji: '📦', keywords: [] },
]

export function getCategoryEmoji(category: string): string {
  return CATEGORIES.find((c) => c.value === category)?.emoji || '📦'
}

export function detectCategory(description: string): string | null {
  const lower = description.toLowerCase()
  for (const cat of CATEGORIES) {
    for (const keyword of cat.keywords) {
      if (lower.includes(keyword)) {
        return cat.value
      }
    }
  }
  return null
}
