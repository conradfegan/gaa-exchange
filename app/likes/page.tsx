'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/* ── Types ───────────────────────────────────────────────────── */

type LikedListing = {
  id: string
  title: string
  county: string
  size: string
  condition: string
  release_year: number | null
  price: number
  is_sold: boolean
  is_player_fit: boolean
  listing_images: { image_url: string; image_type: string }[]
}

/* ── Page ────────────────────────────────────────────────────── */

export default function LikesPage() {
  const router = useRouter()
  const [listings, setListings] = useState<LikedListing[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data } = await supabase
        .from('likes')
        .select(`
          listing_id,
          listings (
            id, title, county, size, condition, release_year, price, is_sold, is_player_fit,
            listing_images (image_url, image_type)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const items = (data ?? [])
        .map((row: { listing_id: string; listings: unknown }) => row.listings)
        .filter(Boolean) as LikedListing[]

      setListings(items)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes _spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid #EBEBEB', borderTopColor: '#1D7A47', animation: '_spin 0.75s linear infinite' }} />
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes _spin { to { transform: rotate(360deg); } }
        .like-card { transition: transform 0.14s ease, box-shadow 0.14s ease; }
        .like-card:active { transform: scale(0.965); box-shadow: 0 1px 4px rgba(0,0,0,0.06) !important; }
      `}</style>

      <div style={{ backgroundColor: '#FAFAFA', minHeight: '100dvh' }}>

        {/* ── Header ── */}
        <header style={{ backgroundColor: '#ffffff', padding: '52px 20px 18px', borderBottom: '1px solid #F2F2F2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.5px' }}>
              Liked Items
            </h1>
            {listings.length > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 700, color: '#1D7A47',
                backgroundColor: '#F0FBF5',
                padding: '3px 9px', borderRadius: 20,
                letterSpacing: '0.1px',
              }}>
                {listings.length}
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, color: '#AAAAAA', fontWeight: 500 }}>
            Your saved jerseys in one place
          </p>
        </header>

        {/* ── Empty state ── */}
        {listings.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '72px 28px', textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: 24,
              backgroundColor: '#ffffff',
              boxShadow: '0 1px 10px rgba(0,0,0,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
            }}>
              <HeartOutlineIcon />
            </div>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px', marginBottom: 8 }}>
              No saved jerseys yet
            </p>
            <p style={{ fontSize: 14, color: '#AAAAAA', lineHeight: 1.6, maxWidth: 260, marginBottom: 32 }}>
              Tap the heart on any jersey to save it here for later.
            </p>
            <Link
              href="/explore"
              style={{
                backgroundColor: '#1D7A47', color: '#ffffff',
                fontSize: 15, fontWeight: 700,
                padding: '14px 28px', borderRadius: 999,
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(29,122,71,0.28)',
                letterSpacing: '-0.1px',
              }}
            >
              Browse Jerseys
            </Link>
          </div>
        ) : (
          /* ── Grid ── */
          <div style={{ padding: '18px 14px 32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
              {listings.map(listing => (
                <LikeCard key={listing.id} listing={listing} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/* ── Card ────────────────────────────────────────────────────── */

function LikeCard({ listing }: { listing: LikedListing }) {
  const mainImage =
    listing.listing_images.find(i => i.image_type === 'main' || i.image_type === 'front') ??
    listing.listing_images[0]

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="like-card"
      style={{
        display: 'block',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        overflow: 'hidden',
        textDecoration: 'none',
        boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
        position: 'relative',
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', aspectRatio: '1 / 1', backgroundColor: '#F4F4F4' }}>
        {mainImage ? (
          <Image
            src={mainImage.image_url}
            alt={listing.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 200px"
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PlaceholderJersey />
          </div>
        )}

        {/* Sold overlay */}
        {listing.is_sold && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.38)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: 11, fontWeight: 800, color: '#ffffff',
              letterSpacing: '1px', textTransform: 'uppercase',
              backgroundColor: 'rgba(0,0,0,0.55)',
              padding: '5px 12px', borderRadius: 20,
              backdropFilter: 'blur(4px)',
            }}>
              Sold
            </span>
          </div>
        )}

        {/* Heart badge — always filled since it's the likes page */}
        <div style={{
          position: 'absolute', top: 8, right: 8,
          width: 28, height: 28, borderRadius: 9,
          backgroundColor: 'rgba(255,255,255,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
        }}>
          <HeartFilledIcon />
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 11px 13px' }}>
        <p style={{
          fontSize: 13, fontWeight: 700, color: '#0a0a0a',
          marginBottom: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          letterSpacing: '-0.1px',
        }}>
          {listing.title}
        </p>
        <p style={{ fontSize: 11, color: '#BBBBBB', marginBottom: listing.is_player_fit ? 5 : 8, fontWeight: 500 }}>
          {listing.county}{listing.release_year ? ` · ${listing.release_year}` : ''}
        </p>
        {listing.is_player_fit && (
          <span style={{
            display: 'inline-block',
            fontSize: 10, fontWeight: 700, color: '#1D7A47',
            backgroundColor: '#F0FBF5',
            border: '1px solid #C8EDD8',
            padding: '2px 7px', borderRadius: 20,
            letterSpacing: '0.1px',
            marginBottom: 7,
          }}>
            Player Fit
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#1D7A47', letterSpacing: '-0.4px' }}>
            £{Number(listing.price).toFixed(0)}
          </p>
          <span style={{
            fontSize: 10, fontWeight: 600, color: '#888888',
            backgroundColor: '#F2F2F2',
            padding: '3px 8px', borderRadius: 20,
          }}>
            {listing.size}
          </span>
        </div>
      </div>
    </Link>
  )
}

/* ── Icons ───────────────────────────────────────────────────── */

function HeartOutlineIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        stroke="#DDDDDD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

function HeartFilledIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        fill="#1D7A47" stroke="#1D7A47" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

function PlaceholderJersey() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
      <path
        d="M8 16l8-6h4l4 4 4-4h4l8 6-4 6H28v16H20V22h-4L8 16z"
        fill="#EEEEEE" stroke="#DDDDDD" strokeWidth="1.5" strokeLinejoin="round"
      />
    </svg>
  )
}
