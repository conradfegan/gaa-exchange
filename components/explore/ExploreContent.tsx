'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

export type ListingRow = {
  id: string
  title: string
  county: string
  size: string
  condition: string
  release_year: number | null
  price: number
  user_id: string
  profiles: { username: string; avatar_url: string | null } | null
  listing_images: { image_url: string; image_type: string }[]
}

type Props = {
  listings: ListingRow[]
  initialLikedIds: string[]
}

export default function ExploreContent({ listings, initialLikedIds }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'county' | 'size' | 'price'>('county')
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set(initialLikedIds))
  const [pending, setPending] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return listings
    return listings.filter(
      (l) =>
        l.county.toLowerCase().includes(q) ||
        l.size.toLowerCase().includes(q) ||
        l.title.toLowerCase().includes(q),
    )
  }, [listings, searchQuery])

  async function toggleLike(e: React.MouseEvent, listingId: string) {
    e.preventDefault()
    e.stopPropagation()
    if (pending.has(listingId)) return

    const wasLiked = likedIds.has(listingId)

    // Optimistic update
    setLikedIds((prev) => {
      const next = new Set(prev)
      wasLiked ? next.delete(listingId) : next.add(listingId)
      return next
    })
    setPending((prev) => new Set(prev).add(listingId))

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        // Revert — not signed in
        setLikedIds((prev) => {
          const next = new Set(prev)
          wasLiked ? next.add(listingId) : next.delete(listingId)
          return next
        })
        return
      }

      if (wasLiked) {
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('listing_id', listingId)
      } else {
        await supabase.from('likes').insert({ user_id: user.id, listing_id: listingId })
      }
    } catch {
      // Revert on error
      setLikedIds((prev) => {
        const next = new Set(prev)
        wasLiked ? next.add(listingId) : next.delete(listingId)
        return next
      })
    } finally {
      setPending((prev) => {
        const next = new Set(prev)
        next.delete(listingId)
        return next
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header
        className="px-4 pt-10 pb-4"
        style={{ background: 'linear-gradient(135deg, #1D7A47 0%, #438F68 100%)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white tracking-tight">Explore Page</h1>
          <button aria-label="Cart" className="p-1">
            <CartIcon />
          </button>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2.5 shadow-sm">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search by county or size..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-sm text-gray-700 placeholder-gray-400 bg-transparent outline-none"
          />
        </div>
      </header>

      {/* ── Filters ── */}
      <div className="flex gap-2 px-4 py-3 bg-white border-b border-gray-100">
        {(
          [
            { key: 'county', label: 'County', icon: true },
            { key: 'size', label: 'Size', icon: false },
            { key: 'price', label: 'Price', icon: false },
          ] as const
        ).map(({ key, label, icon }) => {
          const active = activeFilter === key
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              {icon && <SlidersIcon color={active ? '#ffffff' : '#374151'} />}
              {label}
            </button>
          )
        })}
      </div>

      {/* ── Listings ── */}
      <div className="px-4 pt-4 pb-8">
        <h2 className="text-base font-bold text-black mb-3">Trending Jerseys</h2>

        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-16">No listings found.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((listing) => {
              const mainImage =
                listing.listing_images.find(
                  (img) => img.image_type === 'main' || img.image_type === 'front',
                ) ?? listing.listing_images[0]

              const isLiked = likedIds.has(listing.id)
              const initial = listing.profiles?.username?.[0]?.toUpperCase() ?? '?'

              return (
                <Link
                  key={listing.id}
                  href={`/listing/${listing.id}`}
                  className="block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.98] transition-transform"
                >
                  {/* Image + seller avatar */}
                  <div className="relative aspect-square bg-gray-100">
                    {mainImage ? (
                      <Image
                        src={mainImage.image_url}
                        alt={listing.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 200px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <PlaceholderJersey />
                      </div>
                    )}

                    {/* Seller avatar */}
                    <div className="absolute top-2 left-2 w-8 h-8 rounded-full bg-primary border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-[11px] font-bold text-white">
                      {listing.profiles?.avatar_url ? (
                        <Image
                          src={listing.profiles.avatar_url}
                          alt={initial}
                          fill
                          className="object-cover"
                          sizes="32px"
                        />
                      ) : (
                        initial
                      )}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="px-2.5 pt-2 pb-2">
                    <p className="text-xs font-bold text-gray-900 leading-snug truncate">
                      {listing.title}
                    </p>
                    {listing.release_year && (
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-none">
                        {listing.release_year}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 leading-none mt-0.5">{listing.size}</p>

                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm font-bold text-gray-900">
                        £{Number(listing.price).toFixed(0)}
                      </p>
                      <button
                        onClick={(e) => toggleLike(e, listing.id)}
                        aria-label={isLiked ? 'Unlike' : 'Like'}
                        className="p-1 -mr-0.5 -mb-0.5"
                      >
                        <HeartIcon filled={isLiked} />
                      </button>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Icons ─────────────────────────────────────────── */

function CartIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="3" y1="6" x2="21" y2="6" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16 10a4 4 0 01-8 0"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="8" stroke="#9CA3AF" strokeWidth="2" />
      <path d="M21 21l-4.35-4.35" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SlidersIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <line x1="4" y1="6" x2="20" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="18" x2="20" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="6" r="2" fill={color} />
      <circle cx="16" cy="12" r="2" fill={color} />
      <circle cx="10" cy="18" r="2" fill={color} />
    </svg>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        stroke={filled ? '#1D7A47' : '#D1D5DB'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? '#1D7A47' : 'none'}
      />
    </svg>
  )
}

function PlaceholderJersey() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path
        d="M8 16l8-6h4l4 4 4-4h4l8 6-4 6H28v16H20V22h-4L8 16z"
        fill="#E5E7EB"
        stroke="#D1D5DB"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
