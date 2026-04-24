import { supabase } from '@/lib/supabase'
import ExploreContent, { type ListingRow } from '@/components/explore/ExploreContent'

export default async function ExplorePage() {
  const { data } = await supabase
    .from('listings')
    .select(
      `
      id,
      title,
      county,
      size,
      condition,
      release_year,
      price,
      is_player_fit,
      user_id,
      profiles (username, avatar_url),
      listing_images (image_url, image_type)
    `,
    )
    .eq('is_sold', false)
    .order('created_at', { ascending: false })
    .limit(40)

  const listings = (data ?? []) as unknown as ListingRow[]

  return <ExploreContent listings={listings} initialLikedIds={[]} />
}
