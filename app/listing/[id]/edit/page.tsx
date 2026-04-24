import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import EditListingContent from '@/components/listing/EditListingContent'
import { type ListingDetail } from '@/components/listing/ListingDetailContent'

type Props = { params: Promise<{ id: string }> }

export default async function EditListingPage({ params }: Props) {
  const { id } = await params

  const { data, error } = await supabase
    .from('listings')
    .select(`
      id, title, county, size, condition, release_year, price,
      description, is_sold, is_player_fit, created_at, user_id,
      sold_to_user_id, sold_at,
      profiles (username, avatar_url, county, bio),
      listing_images (id, image_url, image_type, sort_order)
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') notFound()
    throw new Error(`Failed to load listing: ${error.message} (${error.code})`)
  }
  if (!data) notFound()

  return <EditListingContent listing={data as unknown as ListingDetail} />
}
