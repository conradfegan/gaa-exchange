'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/* ── Types ───────────────────────────────────────────────────── */

export type ListingDetail = {
  id: string
  title: string
  county: string
  size: string
  condition: string
  release_year: number | null
  price: number
  description: string | null
  is_sold: boolean
  created_at: string
  user_id: string
  profiles: {
    username: string
    avatar_url: string | null
    county: string | null
    bio: string | null
  } | null
  listing_images: {
    id: string
    image_url: string
    image_type: string
    sort_order: number | null
  }[]
}

/* ── Constants ───────────────────────────────────────────────── */

const CONDITION_META: Record<string, { label: string; bg: string; color: string }> = {
  new:      { label: 'Brand New', bg: '#F0FBF5', color: '#1D7A47' },
  like_new: { label: 'Like New',  bg: '#F0FBF5', color: '#1D7A47' },
  good:     { label: 'Good',      bg: '#EEF6FF', color: '#2563EB' },
  fair:     { label: 'Fair',      bg: '#FFF7ED', color: '#C2410C' },
  poor:     { label: 'Poor',      bg: '#FFF1F2', color: '#BE123C' },
}

/* ── Component ───────────────────────────────────────────────── */

export default function ListingDetailContent({ listing }: { listing: ListingDetail }) {
  const router = useRouter()
  const galleryRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx]     = useState(0)
  const [isLiked, setIsLiked]         = useState(false)
  const [likePending, setLikePending] = useState(false)

  const images  = listing.listing_images
  const hasImgs = images.length > 0
  const cond    = CONDITION_META[listing.condition] ?? { label: listing.condition, bg: '#F5F5F5', color: '#555555' }
  const initial = listing.profiles?.username?.[0]?.toUpperCase() ?? '?'

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase
        .from('likes')
        .select('listing_id')
        .eq('user_id', data.user.id)
        .eq('listing_id', listing.id)
        .maybeSingle()
        .then(({ data: row }) => setIsLiked(!!row))
    })
  }, [listing.id])

  useEffect(() => {
    const el = galleryRef.current
    if (!el) return
    function onScroll() {
      const idx = Math.round(el!.scrollLeft / el!.offsetWidth)
      setActiveIdx(idx)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  function scrollTo(idx: number) {
    const el = galleryRef.current
    if (!el) return
    el.scrollTo({ left: idx * el.offsetWidth, behavior: 'smooth' })
    setActiveIdx(idx)
  }

  async function toggleLike() {
    if (likePending) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setLikePending(true)
    const was = isLiked
    setIsLiked(!was)
    try {
      if (was) {
        await supabase.from('likes').delete().eq('user_id', user.id).eq('listing_id', listing.id)
      } else {
        await supabase.from('likes').insert({ user_id: user.id, listing_id: listing.id })
      }
    } catch {
      setIsLiked(was)
    } finally {
      setLikePending(false)
    }
  }

  return (
    <>
      <style>{`
        .gallery-track { scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
        .gallery-track::-webkit-scrollbar { display: none; }
        .gallery-slide { scroll-snap-align: start; }
        .btn-tap:active  { transform: scale(0.97); }
        .like-btn:active { transform: scale(0.85); }
        .dot-btn { transition: width 0.22s ease, background-color 0.22s ease; }
      `}</style>

      {/* Scroll content */}
      <div style={{ backgroundColor: '#ffffff', minHeight: '100dvh', paddingBottom: 152 }}>

        {/* ── Gallery ─────────────────────────────────────────── */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', backgroundColor: '#F4F4F4', overflow: 'hidden' }}>
          {hasImgs ? (
            <div
              ref={galleryRef}
              className="gallery-track"
              style={{ display: 'flex', width: '100%', height: '100%', overflowX: 'auto' }}
            >
              {images.map((img, i) => (
                <div
                  key={img.id}
                  className="gallery-slide"
                  style={{ flexShrink: 0, width: '100%', height: '100%', position: 'relative' }}
                >
                  <Image
                    src={img.image_url}
                    alt={`${listing.title} — ${img.image_type}`}
                    fill
                    className="object-cover"
                    sizes="100vw"
                    priority={i === 0}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlaceholderJersey />
            </div>
          )}

          {/* Back button */}
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            style={{
              position: 'absolute', top: 52, left: 16, zIndex: 10,
              width: 38, height: 38, borderRadius: 13,
              backgroundColor: 'rgba(255,255,255,0.94)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.14)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          >
            <BackIcon />
          </button>

          {/* Image counter */}
          {images.length > 1 && (
            <div style={{
              position: 'absolute', top: 52, right: 16, zIndex: 10,
              backgroundColor: 'rgba(0,0,0,0.42)',
              borderRadius: 20, padding: '5px 11px',
              fontSize: 12, fontWeight: 600, color: '#ffffff',
              backdropFilter: 'blur(6px)',
              letterSpacing: '0.2px',
            }}>
              {activeIdx + 1} / {images.length}
            </div>
          )}

          {/* Sold overlay badge */}
          {listing.is_sold && (
            <div style={{
              position: 'absolute', bottom: 16, left: 16, zIndex: 10,
              backgroundColor: 'rgba(10,10,10,0.82)',
              color: '#ffffff',
              fontSize: 11, fontWeight: 700, letterSpacing: '1px',
              padding: '6px 14px', borderRadius: 20, textTransform: 'uppercase',
              backdropFilter: 'blur(4px)',
            }}>
              Sold
            </div>
          )}
        </div>

        {/* Dot indicators */}
        {images.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 14, paddingBottom: 2 }}>
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => scrollTo(i)}
                aria-label={`View image ${i + 1}`}
                className="dot-btn"
                style={{
                  width: i === activeIdx ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  backgroundColor: i === activeIdx ? '#1D7A47' : '#E0E0E0',
                }}
              />
            ))}
          </div>
        )}

        {/* ── Content ─────────────────────────────────────────── */}
        <div style={{ padding: '28px 20px 0' }}>

          {/* Title row: heading + like button */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 14 }}>
            <h1 style={{
              flex: 1,
              fontSize: 24,
              fontWeight: 800,
              color: '#0a0a0a',
              letterSpacing: '-0.6px',
              lineHeight: 1.18,
            }}>
              {listing.title}
            </h1>

            {/* Like button — intentional rounded square */}
            <button
              onClick={toggleLike}
              className="like-btn"
              aria-label={isLiked ? 'Unlike' : 'Save listing'}
              style={{
                flexShrink: 0,
                marginTop: 2,
                width: 42,
                height: 42,
                borderRadius: 14,
                backgroundColor: isLiked ? '#F0FBF5' : '#F5F5F5',
                border: isLiked ? '1.5px solid #C8EDD8' : '1.5px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.12s ease',
              }}
            >
              <HeartIcon filled={isLiked} />
            </button>
          </div>

          {/* Meta chips row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginBottom: 20 }}>
            <MetaPill text={listing.county} />
            {listing.release_year && <MetaPill text={String(listing.release_year)} />}
            <MetaPill text={listing.size} />
            {/* Condition with colour */}
            <span style={{
              fontSize: 12, fontWeight: 700,
              padding: '5px 11px', borderRadius: 20,
              backgroundColor: cond.bg, color: cond.color,
              letterSpacing: '0.1px',
            }}>
              {cond.label}
            </span>
          </div>

          {/* Price — prominent */}
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 4,
            marginBottom: 24,
          }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: '#1D7A47', letterSpacing: '-1px', lineHeight: 1 }}>
              £{Number(listing.price).toFixed(0)}
            </span>
            {listing.is_sold && (
              <span style={{ fontSize: 13, fontWeight: 600, color: '#AAAAAA', marginLeft: 8 }}>· Sold</span>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, backgroundColor: '#F0F0F0', marginBottom: 24 }} />

          {/* Description */}
          {listing.description && (
            <>
              <h2 style={{ fontSize: 12, fontWeight: 700, color: '#AAAAAA', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 10 }}>
                Description
              </h2>
              <p style={{ fontSize: 15, color: '#2E2E2E', lineHeight: 1.7, marginBottom: 28, whiteSpace: 'pre-wrap' }}>
                {listing.description}
              </p>
              <div style={{ height: 1, backgroundColor: '#F0F0F0', marginBottom: 24 }} />
            </>
          )}

          {/* Seller section */}
          <h2 style={{ fontSize: 12, fontWeight: 700, color: '#AAAAAA', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 12 }}>
            Listed by
          </h2>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            backgroundColor: '#F9F9F9',
            borderRadius: 18,
            padding: '16px 18px',
            marginBottom: 28,
          }}>
            {/* Avatar */}
            <div style={{
              width: 48, height: 48, borderRadius: 16,
              backgroundColor: '#1D7A47',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 19, fontWeight: 800, color: '#ffffff',
              flexShrink: 0,
              overflow: 'hidden',
              position: 'relative',
            }}>
              {listing.profiles?.avatar_url ? (
                <Image
                  src={listing.profiles.avatar_url}
                  alt={listing.profiles.username}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              ) : initial}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 16, fontWeight: 700, color: '#0a0a0a',
                letterSpacing: '-0.2px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                marginBottom: 2,
              }}>
                {listing.profiles?.username ?? 'Unknown seller'}
              </p>
              <p style={{ fontSize: 13, color: '#AAAAAA', fontWeight: 500 }}>
                {listing.profiles?.county ? `${listing.profiles.county} · ` : ''}GAA Exchange seller
              </p>
            </div>

            {/* Verified pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              backgroundColor: '#F0FBF5',
              border: '1px solid #C8EDD8',
              borderRadius: 20, padding: '5px 10px',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#1D7A47' }}>✓</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#1D7A47' }}>Verified</span>
            </div>
          </div>

          {/* Report */}
          <div style={{ textAlign: 'center', paddingBottom: 4 }}>
            <button
              type="button"
              style={{
                fontSize: 13, color: '#CCCCCC',
                background: 'none', border: 'none', cursor: 'pointer',
                fontWeight: 500, padding: '8px 0',
              }}
            >
              Report this listing
            </button>
          </div>

        </div>
      </div>

      {/* ── Sticky action bar ────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        bottom: 64,
        left: 0, right: 0,
        zIndex: 30,
        backgroundColor: '#ffffff',
        borderTop: '1px solid #EFEFEF',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
        padding: '14px 20px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>

        {/* Price block */}
        <div style={{ flexShrink: 0, minWidth: 64 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#BBBBBB', letterSpacing: '0.4px', textTransform: 'uppercase', lineHeight: 1, marginBottom: 4 }}>
            Price
          </p>
          <p style={{ fontSize: 24, fontWeight: 800, color: '#1D7A47', letterSpacing: '-0.6px', lineHeight: 1 }}>
            £{Number(listing.price).toFixed(0)}
          </p>
        </div>

        {/* Vertical divider */}
        <div style={{ width: 1, height: 36, backgroundColor: '#EFEFEF', flexShrink: 0 }} />

        {/* Message Seller CTA */}
        <Link
          href={`/messages?seller=${listing.user_id}&listing=${listing.id}`}
          className="btn-tap"
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: listing.is_sold ? '#D4D4D4' : '#1D7A47',
            color: '#ffffff',
            fontSize: 16, fontWeight: 700,
            padding: '15px 0',
            borderRadius: 999,
            textDecoration: 'none',
            letterSpacing: '-0.15px',
            boxShadow: listing.is_sold ? 'none' : '0 4px 18px rgba(29,122,71,0.30)',
            pointerEvents: listing.is_sold ? 'none' : 'auto',
            transition: 'transform 0.12s ease',
          }}
        >
          <MessageIcon />
          {listing.is_sold ? 'Item Sold' : 'Message Seller'}
        </Link>
      </div>
    </>
  )
}

/* ── Small components ────────────────────────────────────────── */

function MetaPill({ text }: { text: string }) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 600, color: '#666666',
      padding: '5px 11px', borderRadius: 20,
      backgroundColor: '#F2F2F2',
    }}>
      {text}
    </span>
  )
}

/* ── Icons ───────────────────────────────────────────────────── */

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M19 12H5M12 19l-7-7 7-7" stroke="#0a0a0a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
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

function MessageIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
        stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

function PlaceholderJersey() {
  return (
    <svg width="80" height="80" viewBox="0 0 48 48" fill="none">
      <path
        d="M8 16l8-6h4l4 4 4-4h4l8 6-4 6H28v16H20V22h-4L8 16z"
        fill="#E8E8E8" stroke="#DDDDDD" strokeWidth="1.5" strokeLinejoin="round"
      />
    </svg>
  )
}
