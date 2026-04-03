'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

/* ── Types ───────────────────────────────────────────────────── */

type Profile = {
  id: string
  username: string
  avatar_url: string | null
  county: string | null
  bio: string | null
}

type Listing = {
  id: string
  title: string
  county: string
  size: string
  condition: string
  release_year: number | null
  price: number
  is_sold: boolean
  listing_images: { image_url: string; image_type: string }[]
}

type Review = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer_id: string
  reviewer_username: string | null
  reviewer_avatar: string | null
}

type Tab = 'store' | 'reviews'

/* ── Helpers ─────────────────────────────────────────────────── */

function avatarColor(username: string) {
  const colors = ['#1D7A47', '#2563EB', '#7C3AED', '#DB2777', '#D97706', '#0891B2']
  let h = 0
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}

/* ── Page ────────────────────────────────────────────────────── */

export default function ProfilePage() {
  const router = useRouter()
  const [user,     setUser]     = useState<User | null>(null)
  const [profile,  setProfile]  = useState<Profile | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [reviews,  setReviews]  = useState<Review[]>([])
  const [tab,      setTab]      = useState<Tab>('store')
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setUser(user)

      const [profileRes, listingsRes, reviewsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, avatar_url, county, bio')
          .eq('id', user.id)
          .maybeSingle(),

        supabase
          .from('listings')
          .select('id, title, county, size, condition, release_year, price, is_sold, listing_images(image_url, image_type)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('reviews')
          .select('id, rating, comment, created_at, reviewer_id')
          .eq('reviewed_user_id', user.id)
          .order('created_at', { ascending: false }),
      ])

      const profileData  = profileRes.data as Profile | null
      const listingsData = (listingsRes.data ?? []) as unknown as Listing[]
      const rawReviews   = reviewsRes.data ?? []

      let enrichedReviews: Review[] = []
      if (rawReviews.length > 0) {
        const reviewerIds = [...new Set(rawReviews.map((r: { reviewer_id: string }) => r.reviewer_id))]
        const { data: reviewerProfiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', reviewerIds)

        const profileMap = Object.fromEntries(
          (reviewerProfiles ?? []).map((p: { id: string; username: string; avatar_url: string | null }) => [p.id, p])
        )
        enrichedReviews = rawReviews.map((r: { id: string; rating: number; comment: string | null; created_at: string; reviewer_id: string }) => ({
          ...r,
          reviewer_username: profileMap[r.reviewer_id]?.username ?? null,
          reviewer_avatar:   profileMap[r.reviewer_id]?.avatar_url ?? null,
        }))
      }

      setProfile(profileData)
      setListings(listingsData)
      setReviews(enrichedReviews)
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

  const username    = profile?.username ?? user?.email?.split('@')[0] ?? 'You'
  const initial     = username[0]?.toUpperCase() ?? '?'
  const bgColor     = avatarColor(username)
  const activeCount = listings.filter(l => !l.is_sold).length
  const soldCount   = listings.filter(l => l.is_sold).length
  const avgRating   = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null

  return (
    <>
      <style>{`
        @keyframes _spin { to { transform: rotate(360deg); } }
        .listing-card { transition: transform 0.14s ease, box-shadow 0.14s ease; }
        .listing-card:active { transform: scale(0.965); box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        .tab-pill { transition: background-color 0.16s ease, color 0.16s ease; }
        .edit-btn:active { transform: scale(0.97); }
      `}</style>

      <div style={{ backgroundColor: '#F5F7F5', minHeight: '100dvh' }}>

        {/* ── Profile header with green-tinted background ── */}
        <div style={{
          background: 'linear-gradient(160deg, #1a6b3e 0%, #1D7A47 45%, #23934f 100%)',
          padding: '52px 20px 0',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Subtle texture rings */}
          <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.06)', pointerEvents: 'none' }} />

          {/* Edit button — top right */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <Link
              href="/profile/edit"
              className="edit-btn"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                backgroundColor: 'transparent',
                color: 'rgba(255,255,255,0.70)',
                fontSize: 12, fontWeight: 600,
                padding: '6px 0',
                textDecoration: 'none',
                border: 'none',
                letterSpacing: '0.1px',
                transition: 'color 0.12s ease, transform 0.12s ease',
              }}
            >
              <EditIcon color="rgba(255,255,255,0.70)" />
              Edit
            </Link>
          </div>

          {/* Avatar + name block */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 16 }}>
            {/* Avatar with ring */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 80, height: 80, borderRadius: 24,
                backgroundColor: bgColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 30, fontWeight: 800, color: '#ffffff',
                overflow: 'hidden', position: 'relative',
                boxShadow: '0 0 0 3px rgba(255,255,255,0.35), 0 6px 20px rgba(0,0,0,0.25)',
              }}>
                {profile?.avatar_url ? (
                  <Image src={profile.avatar_url} alt={username} fill className="object-cover" sizes="80px" />
                ) : initial}
              </div>
              {/* Verified dot */}
              <div style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 22, height: 22, borderRadius: '50%',
                backgroundColor: '#ffffff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
              }}>
                <span style={{ fontSize: 11, color: '#1D7A47', fontWeight: 800 }}>✓</span>
              </div>
            </div>

            {/* Name + county */}
            <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
              <h1 style={{
                fontSize: 22, fontWeight: 800, color: '#ffffff',
                letterSpacing: '-0.5px', lineHeight: 1.15,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                marginBottom: 4,
              }}>
                {username}
              </h1>
              {profile?.county && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <PinIcon color="rgba(255,255,255,0.65)" />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
                    {profile.county}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          <div style={{ marginBottom: 20, minHeight: 20 }}>
            {profile?.bio ? (
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.80)', lineHeight: 1.6, maxWidth: 340 }}>
                {profile.bio}
              </p>
            ) : (
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.40)', fontStyle: 'italic' }}>
                No bio yet — tap Edit Profile to add one.
              </p>
            )}
          </div>

          {/* Stats strip — white card bridging header and body */}
          <div style={{
            backgroundColor: '#ffffff',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            display: 'flex',
            alignItems: 'stretch',
            paddingTop: 2,
          }}>
            <StatCell value={activeCount} label="Listed" />
            <div style={{ width: 1, backgroundColor: '#F0F0F0', margin: '14px 0' }} />
            <StatCell value={soldCount} label="Sold" accent />
            <div style={{ width: 1, backgroundColor: '#F0F0F0', margin: '14px 0' }} />
            <StatCell
              value={reviews.length}
              label="Reviews"
              extra={avgRating ? `★ ${avgRating}` : undefined}
            />
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{
          backgroundColor: '#ffffff',
          display: 'flex',
          padding: '0 16px 0',
          gap: 8,
          borderBottom: '1px solid #EFEFEF',
        }}>
          {(['store', 'reviews'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="tab-pill"
              style={{
                padding: '12px 4px 11px',
                fontSize: 14, fontWeight: 700,
                background: 'none', border: 'none', cursor: 'pointer',
                color: tab === t ? '#1D7A47' : '#BBBBBB',
                borderBottom: tab === t ? '2.5px solid #1D7A47' : '2.5px solid transparent',
                marginBottom: -1,
                letterSpacing: '-0.1px',
                minWidth: 72,
                textAlign: 'center',
              }}
            >
              {t === 'store' ? '🏪  Store' : '⭐  Reviews'}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div style={{ padding: '18px 14px 32px' }}>

          {/* Store tab */}
          {tab === 'store' && (
            listings.length === 0 ? (
              <EmptyState
                icon={<EmptyJerseyIcon />}
                title="No listings yet"
                subtitle="Your jerseys for sale will appear here. Tap the + button to create your first listing."
                action={{ label: 'List a Jersey', href: '/sell' }}
              />
            ) : (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#AAAAAA', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 12 }}>
                  {activeCount} active · {soldCount} sold
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                  {listings.map(listing => (
                    <ProfileListingCard key={listing.id} listing={listing} />
                  ))}
                </div>
              </>
            )
          )}

          {/* Reviews tab */}
          {tab === 'reviews' && (
            reviews.length === 0 ? (
              <EmptyState
                icon={<EmptyStarIcon />}
                title="No reviews yet"
                subtitle="Buyers can leave reviews after a completed sale. They'll show up here."
              />
            ) : (
              <>
                {avgRating && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    backgroundColor: '#ffffff', borderRadius: 16,
                    padding: '14px 16px', marginBottom: 14,
                    boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
                  }}>
                    <span style={{ fontSize: 32, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-1px' }}>{avgRating}</span>
                    <div>
                      <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
                        {[1,2,3,4,5].map(n => (
                          <span key={n} style={{ fontSize: 15, color: n <= Math.round(parseFloat(avgRating)) ? '#F59E0B' : '#E5E7EB' }}>★</span>
                        ))}
                      </div>
                      <p style={{ fontSize: 12, color: '#AAAAAA', fontWeight: 500 }}>
                        Based on {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {reviews.map(review => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              </>
            )
          )}
        </div>
      </div>
    </>
  )
}

/* ── Sub-components ──────────────────────────────────────────── */

function StatCell({ value, label, extra, accent }: { value: number; label: string; extra?: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '16px 0 14px' }}>
      <p style={{ fontSize: 22, fontWeight: 800, color: accent ? '#1D7A47' : '#0a0a0a', letterSpacing: '-0.5px', lineHeight: 1 }}>
        {value}
      </p>
      {extra && (
        <p style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', marginTop: 2, letterSpacing: '0.1px' }}>{extra}</p>
      )}
      <p style={{ fontSize: 11, color: '#BBBBBB', fontWeight: 500, marginTop: 4, letterSpacing: '0.2px' }}>{label}</p>
    </div>
  )
}

function ProfileListingCard({ listing }: { listing: Listing }) {
  const mainImage =
    listing.listing_images.find(i => i.image_type === 'main' || i.image_type === 'front') ??
    listing.listing_images[0]

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="listing-card"
      style={{
        display: 'block',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        overflow: 'hidden',
        textDecoration: 'none',
        boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
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

        {/* Status badge */}
        {listing.is_sold ? (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            backgroundColor: 'rgba(10,10,10,0.72)',
            color: '#ffffff', fontSize: 9, fontWeight: 700,
            letterSpacing: '0.8px', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 20,
            backdropFilter: 'blur(4px)',
          }}>
            Sold
          </div>
        ) : (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            backgroundColor: 'rgba(29,122,71,0.85)',
            color: '#ffffff', fontSize: 9, fontWeight: 700,
            letterSpacing: '0.8px', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 20,
            backdropFilter: 'blur(4px)',
          }}>
            Active
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '10px 11px 13px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#0a0a0a', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.1px' }}>
          {listing.title}
        </p>
        <p style={{ fontSize: 11, color: '#BBBBBB', marginBottom: 8, fontWeight: 500 }}>
          {listing.county}{listing.release_year ? ` · ${listing.release_year}` : ''}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#1D7A47', letterSpacing: '-0.4px' }}>
            £{Number(listing.price).toFixed(0)}
          </p>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#888888', backgroundColor: '#F2F2F2', padding: '3px 8px', borderRadius: 20 }}>
            {listing.size}
          </span>
        </div>
      </div>
    </Link>
  )
}

function ReviewCard({ review }: { review: Review }) {
  const initial = review.reviewer_username?.[0]?.toUpperCase() ?? '?'
  const bg      = avatarColor(review.reviewer_username ?? review.reviewer_id)
  const dateStr = new Date(review.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: 16,
      padding: '16px',
      boxShadow: '0 1px 6px rgba(0,0,0,0.055)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: review.comment ? 12 : 0 }}>
        {/* Reviewer avatar */}
        <div style={{
          width: 38, height: 38, borderRadius: 12,
          backgroundColor: bg, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, color: '#ffffff',
          overflow: 'hidden', position: 'relative',
        }}>
          {review.reviewer_avatar ? (
            <Image src={review.reviewer_avatar} alt={initial} fill className="object-cover" sizes="38px" />
          ) : initial}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + date row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {review.reviewer_username ?? 'Anonymous'}
            </p>
            <p style={{ fontSize: 11, color: '#CCCCCC', fontWeight: 500, flexShrink: 0, marginLeft: 8 }}>{dateStr}</p>
          </div>

          {/* Stars */}
          <div style={{ display: 'flex', gap: 2 }}>
            {[1,2,3,4,5].map(n => (
              <span key={n} style={{ fontSize: 13, color: n <= review.rating ? '#F59E0B' : '#E8E8E8', lineHeight: 1 }}>★</span>
            ))}
          </div>
        </div>
      </div>

      {/* Review text */}
      {review.comment ? (
        <p style={{ fontSize: 14, color: '#3A3A3A', lineHeight: 1.65, paddingLeft: 49 }}>
          {review.comment}
        </p>
      ) : (
        <p style={{ fontSize: 13, color: '#D0D0D0', fontStyle: 'italic', paddingLeft: 49 }}>No written review.</p>
      )}
    </div>
  )
}

function EmptyState({
  icon, title, subtitle, action,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  action?: { label: string; href: string }
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
      <div style={{
        width: 68, height: 68, borderRadius: 22,
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 18,
      }}>
        {icon}
      </div>
      <p style={{ fontSize: 16, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.3px', marginBottom: 7 }}>{title}</p>
      <p style={{ fontSize: 14, color: '#AAAAAA', lineHeight: 1.55, maxWidth: 260, marginBottom: action ? 24 : 0 }}>{subtitle}</p>
      {action && (
        <Link
          href={action.href}
          style={{
            backgroundColor: '#1D7A47', color: '#ffffff',
            fontSize: 14, fontWeight: 700,
            padding: '12px 24px', borderRadius: 999,
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(29,122,71,0.28)',
          }}
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}

/* ── Icons ───────────────────────────────────────────────────── */

function EditIcon({ color = '#555555' }: { color?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PinIcon({ color = '#AAAAAA' }: { color?: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={color} strokeWidth="2" />
      <circle cx="12" cy="10" r="3" stroke={color} strokeWidth="2" />
    </svg>
  )
}

function PlaceholderJersey() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
      <path d="M8 16l8-6h4l4 4 4-4h4l8 6-4 6H28v16H20V22h-4L8 16z" fill="#EEEEEE" stroke="#DDDDDD" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function EmptyJerseyIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 48 48" fill="none">
      <path d="M8 16l8-6h4l4 4 4-4h4l8 6-4 6H28v16H20V22h-4L8 16z" fill="#DDDDDD" stroke="#CCCCCC" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function EmptyStarIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#CCCCCC" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
