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
  is_player_fit: boolean
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

/* ── County dot colours ─────────────────────────────────────── */

const COUNTY_DOT: Record<string, string> = {
  Antrim: '#C8950A',    Armagh: '#E05A00',    Cavan: '#003F87',
  Derry: '#B8001E',     Donegal: '#C49A00',   Down: '#B8001E',
  Fermanagh: '#005C2A', Monaghan: '#0057A8',  Tyrone: '#B8001E',
  Galway: '#7A1432',    Leitrim: '#1D8A3A',   Mayo: '#B8001E',
  Roscommon: '#003F87', Sligo: '#444444',
  Carlow: '#B8001E',    Dublin: '#002D72',     Kildare: '#B8001E',
  Kilkenny: '#1a1a1a',  Laois: '#003F87',     Longford: '#003F87',
  Louth: '#B8001E',     Meath: '#006633',     Offaly: '#006633',
  Westmeath: '#6B1A3C', Wexford: '#4A2080',   Wicklow: '#003F87',
  Clare: '#003F87',     Cork: '#B8001E',       Kerry: '#005C2A',
  Limerick: '#005C2A',  Tipperary: '#003F87',  Waterford: '#003F87',
}

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
  const [showDeletedToast, setShowDeletedToast] = useState(false)

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
          .select('id, title, county, size, condition, release_year, price, is_sold, is_player_fit, listing_images(image_url, image_type)')
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

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('deleted=1')) {
      setShowDeletedToast(true)
      const t = setTimeout(() => setShowDeletedToast(false), 3500)
      return () => clearTimeout(t)
    }
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes _spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid #EBEBEB', borderTopColor: '#1D7A47', animation: '_spin 0.75s linear infinite' }} />
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
  const countyDot = profile?.county ? (COUNTY_DOT[profile.county] ?? '#1D7A47') : null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes _spin { to { transform: rotate(360deg); } }
        @keyframes _toast-in { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        .lcard { transition: transform 0.13s ease, box-shadow 0.13s ease; }
        .lcard:active { transform: scale(0.963); box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
        .edit-ghost:active { transform: scale(0.96); opacity: 0.75; }
        .tab-btn { transition: color 0.14s ease, border-color 0.14s ease; }
      `}</style>

      <div style={{ backgroundColor: '#F7F8F7', minHeight: '100dvh' }}>

        {/* ── Profile header ── */}
        <div style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #EFEFEF',
          paddingTop: 52,
          paddingBottom: 0,
        }}>
          {/* Edit button row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 20px', marginBottom: 20 }}>
            <Link
              href="/profile/edit"
              className="edit-ghost"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                border: '1px solid #E4E4E4',
                borderRadius: 999,
                padding: '6px 14px',
                fontSize: 12, fontWeight: 600, color: '#555555',
                textDecoration: 'none',
                backgroundColor: '#ffffff',
                letterSpacing: '-0.1px',
                transition: 'transform 0.13s ease, opacity 0.13s ease',
              }}
            >
              <EditIcon />
              Edit profile
            </Link>
          </div>

          {/* Avatar + identity */}
          <div style={{ padding: '0 20px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            {/* Avatar */}
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <div style={{
                width: 84, height: 84, borderRadius: '50%',
                backgroundColor: bgColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, fontWeight: 800, color: '#ffffff',
                overflow: 'hidden', position: 'relative',
                boxShadow: '0 0 0 3px #ffffff, 0 0 0 4.5px #E8EDE9, 0 4px 18px rgba(0,0,0,0.10)',
              }}>
                {profile?.avatar_url ? (
                  <Image src={profile.avatar_url} alt={username} fill className="object-cover" sizes="84px" />
                ) : initial}
              </div>
              {/* Verified badge */}
              <div style={{
                position: 'absolute', bottom: 1, right: 1,
                width: 24, height: 24, borderRadius: '50%',
                backgroundColor: '#1D7A47',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 0 2px #ffffff',
              }}>
                <CheckIcon />
              </div>
            </div>

            {/* Name */}
            <h1 style={{
              fontSize: 22, fontWeight: 800, color: '#0a0a0a',
              letterSpacing: '-0.6px', lineHeight: 1.15,
              marginBottom: 8,
            }}>
              {username}
            </h1>

            {/* County chip */}
            {profile?.county && countyDot && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                backgroundColor: '#F6F6F6',
                border: '1px solid #EBEBEB',
                borderRadius: 999,
                padding: '5px 12px 5px 9px',
                marginBottom: profile?.bio ? 14 : 0,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  backgroundColor: countyDot,
                  flexShrink: 0,
                  display: 'inline-block',
                }} />
                <span style={{ fontSize: 12, color: '#444444', fontWeight: 600, letterSpacing: '0.05px' }}>
                  {profile.county}
                </span>
              </div>
            )}

            {/* Bio */}
            {profile?.bio ? (
              <p style={{
                fontSize: 14, color: '#666666', lineHeight: 1.6,
                maxWidth: 300, marginTop: profile?.county ? 14 : 4,
              }}>
                {profile.bio}
              </p>
            ) : (
              <p style={{
                fontSize: 13, color: '#CCCCCC', fontStyle: 'italic',
                marginTop: profile?.county ? 14 : 4,
              }}>
                No bio yet
              </p>
            )}
          </div>

          {/* Stats row */}
          <div style={{
            display: 'flex',
            borderTop: '1px solid #F2F2F2',
          }}>
            <StatCell value={activeCount} label="Listed" />
            <div style={{ width: 1, backgroundColor: '#F2F2F2', flexShrink: 0 }} />
            <StatCell value={soldCount} label="Sold" green />
            <div style={{ width: 1, backgroundColor: '#F2F2F2', flexShrink: 0 }} />
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
          padding: '0 20px',
          borderBottom: '1px solid #EFEFEF',
          marginTop: 8,
        }}>
          {(['store', 'reviews'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="tab-btn"
              style={{
                padding: '13px 0 12px',
                marginRight: 28,
                fontSize: 14, fontWeight: 600,
                background: 'none', border: 'none', cursor: 'pointer',
                color: tab === t ? '#0a0a0a' : '#BBBBBB',
                borderBottom: tab === t ? '2px solid #1D7A47' : '2px solid transparent',
                marginBottom: -1,
                letterSpacing: '-0.15px',
              }}
            >
              {t === 'store' ? 'Store' : 'Reviews'}
              {t === 'reviews' && reviews.length > 0 && (
                <span style={{
                  marginLeft: 6, fontSize: 11, fontWeight: 700,
                  color: tab === 'reviews' ? '#1D7A47' : '#CCCCCC',
                  letterSpacing: '0px',
                }}>
                  {reviews.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div style={{ padding: '16px 14px 96px' }}>

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
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 14,
                }}>
                  <p style={{
                    fontSize: 11, fontWeight: 700, color: '#AAAAAA',
                    letterSpacing: '0.6px', textTransform: 'uppercase',
                  }}>
                    {activeCount} active · {soldCount} sold
                  </p>
                  <Link
                    href="/sell"
                    style={{
                      fontSize: 12, fontWeight: 700, color: '#1D7A47',
                      textDecoration: 'none',
                      letterSpacing: '-0.1px',
                    }}
                  >
                    + Add listing
                  </Link>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
                    backgroundColor: '#ffffff',
                    borderRadius: 16,
                    padding: '18px 20px',
                    marginBottom: 12,
                    border: '1px solid #F0F0F0',
                    display: 'flex', alignItems: 'center', gap: 16,
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 40, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-2px', lineHeight: 1 }}>
                        {avgRating}
                      </p>
                      <p style={{ fontSize: 10, color: '#CCCCCC', fontWeight: 500, marginTop: 4, letterSpacing: '0.2px' }}>
                        out of 5
                      </p>
                    </div>
                    <div style={{ flex: 1, borderLeft: '1px solid #F0F0F0', paddingLeft: 16 }}>
                      <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
                        {[1,2,3,4,5].map(n => (
                          <span key={n} style={{ fontSize: 18, color: n <= Math.round(parseFloat(avgRating)) ? '#F59E0B' : '#EBEBEB', lineHeight: 1 }}>★</span>
                        ))}
                      </div>
                      <p style={{ fontSize: 13, color: '#888888', fontWeight: 500, lineHeight: 1.4 }}>
                        {reviews.length} {reviews.length === 1 ? 'rating' : 'ratings'} from verified buyers
                      </p>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {reviews.map(review => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              </>
            )
          )}
        </div>
      </div>

      {/* ── Deleted toast ── */}
      {showDeletedToast && (
        <div style={{
          position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 80,
          backgroundColor: '#1D7A47', color: '#ffffff',
          borderRadius: 14, padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.20)',
          animation: '_toast-in 0.3s ease',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M20 6L9 17l-5-5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', margin: 0 }}>Listing deleted successfully</p>
        </div>
      )}
    </>
  )
}

/* ── Sub-components ──────────────────────────────────────────── */

function StatCell({ value, label, extra, green }: { value: number; label: string; extra?: string; green?: boolean }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '16px 0 15px' }}>
      <p style={{
        fontSize: 22, fontWeight: 800,
        color: green ? '#1D7A47' : '#0a0a0a',
        letterSpacing: '-0.8px', lineHeight: 1,
      }}>
        {value}
      </p>
      {extra && (
        <p style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', marginTop: 3, letterSpacing: '0px' }}>
          {extra}
        </p>
      )}
      <p style={{ fontSize: 11, color: '#BBBBBB', fontWeight: 500, marginTop: 4, letterSpacing: '0.1px' }}>
        {label}
      </p>
    </div>
  )
}

function ProfileListingCard({ listing }: { listing: Listing }) {
  const mainImage =
    listing.listing_images.find(i => i.image_type === 'main' || i.image_type === 'front') ??
    listing.listing_images[0]

  return (
    <div style={{ position: 'relative' }}>
      <Link
        href={`/listing/${listing.id}`}
        className="lcard"
        style={{
          display: 'block',
          backgroundColor: '#ffffff',
          borderRadius: 14,
          overflow: 'hidden',
          textDecoration: 'none',
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
          border: '1px solid rgba(0,0,0,0.04)',
        }}
      >
        {/* Image */}
        <div style={{ position: 'relative', aspectRatio: '1 / 1', backgroundColor: '#F5F5F5' }}>
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
          <div style={{
            position: 'absolute', top: 8, left: 8,
            backgroundColor: listing.is_sold ? 'rgba(10,10,10,0.65)' : 'rgba(29,122,71,0.88)',
            color: '#ffffff', fontSize: 9, fontWeight: 700,
            letterSpacing: '0.7px', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 20,
            backdropFilter: 'blur(6px)',
          }}>
            {listing.is_sold ? 'Sold' : 'Active'}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '10px 11px 8px' }}>
          <p style={{
            fontSize: 13, fontWeight: 700, color: '#0a0a0a',
            marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            letterSpacing: '-0.15px',
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
            <p style={{ fontSize: 15, fontWeight: 800, color: '#1D7A47', letterSpacing: '-0.5px' }}>
              £{Number(listing.price).toFixed(0)}
            </p>
            <span style={{
              fontSize: 10, fontWeight: 600, color: '#999999',
              backgroundColor: '#F4F4F4', padding: '3px 8px', borderRadius: 20,
            }}>
              {listing.size}
            </span>
          </div>
        </div>
      </Link>

      {/* Edit action — outside the card Link to avoid nested interactive elements */}
      <Link
        href={`/listing/${listing.id}/edit`}
        style={{
          position: 'absolute',
          top: 8, right: 8,
          zIndex: 5,
          width: 28, height: 28,
          borderRadius: 9,
          backgroundColor: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 6px rgba(0,0,0,0.14)',
          textDecoration: 'none',
        }}
        aria-label="Edit listing"
      >
        <CardPencilIcon />
      </Link>
    </div>
  )
}

function ReviewCard({ review }: { review: Review }) {
  const initial = review.reviewer_username?.[0]?.toUpperCase() ?? '?'
  const bg      = avatarColor(review.reviewer_username ?? review.reviewer_id)
  const dateStr = new Date(review.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: 14,
      padding: '15px 16px',
      border: '1px solid #F0F0F0',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: review.comment ? 11 : 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          backgroundColor: bg, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: '#ffffff',
          overflow: 'hidden', position: 'relative',
        }}>
          {review.reviewer_avatar ? (
            <Image src={review.reviewer_avatar} alt={initial} fill className="object-cover" sizes="36px" />
          ) : initial}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {review.reviewer_username ?? 'Anonymous'}
            </p>
            <p style={{ fontSize: 11, color: '#CCCCCC', fontWeight: 500, flexShrink: 0, marginLeft: 8 }}>{dateStr}</p>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {[1,2,3,4,5].map(n => (
              <span key={n} style={{ fontSize: 12, color: n <= review.rating ? '#F59E0B' : '#E8E8E8', lineHeight: 1 }}>★</span>
            ))}
          </div>
        </div>
      </div>

      {review.comment ? (
        <p style={{ fontSize: 13.5, color: '#3A3A3A', lineHeight: 1.65, paddingLeft: 47 }}>
          {review.comment}
        </p>
      ) : (
        <p style={{ fontSize: 13, color: '#D8D8D8', fontStyle: 'italic', paddingLeft: 47 }}>No written review.</p>
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 24px', textAlign: 'center' }}>
      <div style={{
        width: 64, height: 64, borderRadius: 20,
        backgroundColor: '#ffffff',
        border: '1px solid #EFEFEF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 18,
      }}>
        {icon}
      </div>
      <p style={{ fontSize: 16, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px', marginBottom: 8 }}>{title}</p>
      <p style={{ fontSize: 14, color: '#AAAAAA', lineHeight: 1.55, maxWidth: 250, marginBottom: action ? 24 : 0 }}>{subtitle}</p>
      {action && (
        <Link
          href={action.href}
          style={{
            backgroundColor: '#1D7A47', color: '#ffffff',
            fontSize: 14, fontWeight: 700,
            padding: '12px 26px', borderRadius: 999,
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(29,122,71,0.25)',
          }}
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}

/* ── Icons ───────────────────────────────────────────────────── */

function EditIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#666666" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#666666" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M20 6L9 17l-5-5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlaceholderJersey() {
  return (
    <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
      <path d="M8 16l8-6h4l4 4 4-4h4l8 6-4 6H28v16H20V22h-4L8 16z" fill="#EEEEEE" stroke="#DDDDDD" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function EmptyJerseyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
      <path d="M8 16l8-6h4l4 4 4-4h4l8 6-4 6H28v16H20V22h-4L8 16z" fill="#E0E0E0" stroke="#D0D0D0" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function CardPencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#444444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#444444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EmptyStarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#CCCCCC" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
