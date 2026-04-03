import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ListingDetailContent, { type ListingDetail } from '@/components/listing/ListingDetailContent'

export default async function ListingPage(props: PageProps<'/listing/[id]'>) {
  const { id } = await props.params

  const { data, error } = await supabase
    .from('listings')
    .select(`
      id, title, county, size, condition, release_year, price,
      description, is_sold, created_at, user_id,
      profiles (username, avatar_url, county, bio),
      listing_images (id, image_url, image_type, sort_order)
    `)
    .eq('id', id)
    .single()

  if (!data || error) notFound()

  const listing = data as unknown as ListingDetail

  // Sort images: main/front first, then by sort_order, nulls last
  const ORDER: Record<string, number> = { main: 0, front: 1, back: 2, tag: 3, detail: 4 }
  listing.listing_images.sort((a, b) => {
    const ao = ORDER[a.image_type] ?? 5
    const bo = ORDER[b.image_type] ?? 5
    if (ao !== bo) return ao - bo
    return (a.sort_order ?? 99) - (b.sort_order ?? 99)
  })

  return <ListingDetailContent listing={listing} />
}
