'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import logo from '@/public/logo.png'

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

    setLikedIds((prev) => {
      const next = new Set(prev)
      wasLiked ? next.delete(listingId) : next.add(listingId)
      return next
    })
    setPending((prev) => new Set(prev).add(listingId))

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLikedIds((prev) => {
          const next = new Set(prev)
          wasLiked ? next.add(listingId) : next.delete(listingId)
          return next
        })
        return
      }

      if (wasLiked) {
        await supabase.from('likes').delete().eq('user_id', user.id).eq('listing_id', listingId)
      } else {
        await supabase.from('likes').insert({ user_id: user.id, listing_id: listingId })
      }
    } catch {
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
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAFA' }}>

      {/* ── Header ── */}
      <header className="bg-white px-4 pt-12 pb-3">
        <div className="flex items-center justify-between mb-4">
          <Image
            src={logo}
            alt="GAA Exchange"
            width={140}
            height={44}
            className="object-contain"
          />
          <button aria-label="Bag" className="p-1 transition-all duration-200 active:scale-90">
            <BagIcon />
          </button>
        </div>

        {/* Search bar */}
        <div
          className="flex items-center gap-2.5 rounded-full px-4 py-3"
          style={{ backgroundColor: '#F5F5F5' }}
        >
          <SearchIcon />
          <input
            type="search"
            placeholder="Search by county or size..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-sm text-gray-800 bg-transparent outline-none"
            style={{ color: '#1a1a1a' }}
          />
        </div>
      </header>

      {/* ── Filters ── */}
      <div className="bg-white px-4 pt-3 pb-3 flex gap-2">
        {(
          [
            { key: 'county', label: 'County', icon: true },
            { key: 'size',   label: 'Size',   icon: false },
            { key: 'price',  label: 'Price',  icon: false },
          ] as const
        ).map(({ key, label, icon }) => {
          const active = activeFilter === key
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
              style={
                active
                  ? { backgroundColor: '#1D7A47', color: '#ffffff', border: '1px solid #1D7A47' }
                  : { backgroundColor: '#ffffff', color: '#555555', border: '1px solid #E0E0E0' }
              }
            >
              {icon && <SlidersIcon color={active ? '#ffffff' : '#777777'} />}
              {label}
            </button>
          )
        })}
      </div>

      {/* ── Listings ── */}
      <div className="px-4 pt-5 pb-10">
        {/* Section heading + divider */}
        <div className="mb-4">
          <h2 className="text-base font-bold text-black mb-2">Trending Jerseys</h2>
          <div className="h-px bg-gray-200" />
        </div>

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
                  className="block bg-white rounded-xl overflow-hidden transition-all duration-200 active:scale-[0.97]"
                  style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}
                >
                  {/* ── Image area ── */}
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

                    {/* Seller avatar — top right */}
                    <div
                      className="absolute top-2 right-2 w-7 h-7 rounded-full border-2 border-white overflow-hidden flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: '#1D7A47', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
                    >
                      {listing.profiles?.avatar_url ? (
                        <Image
                          src={listing.profiles.avatar_url}
                          alt={initial}
                          fill
                          className="object-cover"
                          sizes="28px"
                        />
                      ) : (
                        initial
                      )}
                    </div>

                    {/* Verified badge — bottom left */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-0.5 bg-white rounded-full px-1.5 py-0.5"
                      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}
                    >
                      <span className="text-[10px] font-semibold" style={{ color: '#1D7A47' }}>✓</span>
                      <span className="text-[9px] font-medium" style={{ color: '#1D7A47' }}>Verified</span>
                    </div>
                  </div>

                  {/* ── Card body ── */}
                  <div className="p-2.5 pt-2">
                    {/* Title */}
                    <p className="text-sm font-bold text-black leading-snug truncate">
                      {listing.title}
                    </p>

                    {/* County · Year */}
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#888888' }}>
                      {listing.county}{listing.release_year ? ` · ${listing.release_year}` : ''}
                    </p>

                    {/* Size pill */}
                    <div className="mt-1.5">
                      <span
                        className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: '#F5F5F5', color: '#888888' }}
                      >
                        {listing.size}
                      </span>
                    </div>

                    {/* Price + heart */}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm font-bold" style={{ color: '#1D7A47' }}>
                        £{Number(listing.price).toFixed(0)}
                      </p>
                      <button
                        onClick={(e) => toggleLike(e, listing.id)}
                        aria-label={isLiked ? 'Unlike' : 'Like'}
                        className="p-1 -mr-0.5 transition-all duration-200 active:scale-90"
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

/* ── Icons ─────────────────────────────────────────────────── */

function BagIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z"
        stroke="#111111"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 6h18"
        stroke="#111111"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M16 10a4 4 0 01-8 0"
        stroke="#111111"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="8" stroke="#AAAAAA" strokeWidth="2" />
      <path d="M21 21l-4.35-4.35" stroke="#AAAAAA" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SlidersIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <line x1="4" y1="6"  x2="20" y2="6"  stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="18" x2="20" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="9"  cy="6"  r="2" fill={color} />
      <circle cx="15" cy="12" r="2" fill={color} />
      <circle cx="9"  cy="18" r="2" fill={color} />
    </svg>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        stroke={filled ? '#1D7A47' : '#CCCCCC'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? '#1D7A47' : 'none'}
      />
    </svg>
  )
}

function PlaceholderJersey() {
  return (
    <svg width="52" height="52" viewBox="0 0 48 48" fill="none">
      <path
        d="M8 16l8-6h4l4 4 4-4h4l8 6-4 6H28v16H20V22h-4L8 16z"
        fill="#EEEEEE"
        stroke="#DDDDDD"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
