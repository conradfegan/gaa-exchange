'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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
  is_player_fit: boolean
  created_at: string
  user_id: string
  sold_to_user_id: string | null
  sold_at: string | null
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

const REPORT_REASONS = [
  'Suspected counterfeit',
  'Misleading description',
  'Inappropriate content',
  'Scam / suspicious behaviour',
  'Other',
] as const

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
  const [reportOpen,    setReportOpen]    = useState(false)
  const [reportVisible, setReportVisible] = useState(false)
  const reportCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sale / review state
  const [localIsSold,   setLocalIsSold]   = useState(listing.is_sold)
  const [localSoldToId, setLocalSoldToId] = useState<string | null>(listing.sold_to_user_id)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [hasReviewed,   setHasReviewed]   = useState(false)

  // Mark-as-sold sheet
  const [soldOpen,    setSoldOpen]    = useState(false)
  const [soldVisible, setSoldVisible] = useState(false)
  const soldCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Leave-review sheet
  const [reviewOpen,    setReviewOpen]    = useState(false)
  const [reviewVisible, setReviewVisible] = useState(false)
  const reviewCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Delete sheet
  const [deleteOpen,    setDeleteOpen]    = useState(false)
  const [deleteVisible, setDeleteVisible] = useState(false)
  const deleteCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const images  = listing.listing_images
  const hasImgs = images.length > 0
  const cond    = CONDITION_META[listing.condition] ?? { label: listing.condition, bg: '#F5F5F5', color: '#555555' }
  const initial = listing.profiles?.username?.[0]?.toUpperCase() ?? '?'

  const isSeller = currentUserId !== null && currentUserId === listing.user_id
  const isEligibleBuyer = useMemo(() =>
    localIsSold &&
    currentUserId !== null &&
    currentUserId === localSoldToId &&
    currentUserId !== listing.user_id,
    [localIsSold, currentUserId, localSoldToId, listing.user_id]
  )

  useEffect(() => {
    if (reportOpen) {
      setReportVisible(true)
      document.body.style.overflow = 'hidden'
    } else {
      setReportVisible(false)
      document.body.style.overflow = ''
    }
    return () => {
      if (reportCloseTimer.current) clearTimeout(reportCloseTimer.current)
      document.body.style.overflow = ''
    }
  }, [reportOpen])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      const uid = data.user.id
      setCurrentUserId(uid)

      supabase
        .from('likes')
        .select('listing_id')
        .eq('user_id', uid)
        .eq('listing_id', listing.id)
        .maybeSingle()
        .then(({ data: row }) => setIsLiked(!!row))

      // Check if this user is the eligible buyer and has already reviewed
      const eligible = localIsSold && uid === localSoldToId && uid !== listing.user_id
      if (eligible) {
        supabase
          .from('reviews')
          .select('id')
          .eq('reviewer_id', uid)
          .eq('reviewed_user_id', listing.user_id)
          .maybeSingle()
          .then(({ data: row }) => setHasReviewed(!!row))
      }
    })
  }, [listing.id, listing.user_id, localIsSold, localSoldToId])

  // Sold sheet scroll lock
  useEffect(() => {
    if (soldOpen) { setSoldVisible(true); document.body.style.overflow = 'hidden' }
    else          { setSoldVisible(false); document.body.style.overflow = '' }
    return () => {
      if (soldCloseTimer.current) clearTimeout(soldCloseTimer.current)
      document.body.style.overflow = ''
    }
  }, [soldOpen])

  // Review sheet scroll lock
  useEffect(() => {
    if (reviewOpen) { setReviewVisible(true); document.body.style.overflow = 'hidden' }
    else            { setReviewVisible(false); document.body.style.overflow = '' }
    return () => {
      if (reviewCloseTimer.current) clearTimeout(reviewCloseTimer.current)
      document.body.style.overflow = ''
    }
  }, [reviewOpen])

  // Delete sheet scroll lock
  useEffect(() => {
    if (deleteOpen) { setDeleteVisible(true); document.body.style.overflow = 'hidden' }
    else            { setDeleteVisible(false); document.body.style.overflow = '' }
    return () => {
      if (deleteCloseTimer.current) clearTimeout(deleteCloseTimer.current)
      document.body.style.overflow = ''
    }
  }, [deleteOpen])

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

  async function openReport() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setReportOpen(true)
  }

  function closeReport() {
    setReportVisible(false)
    reportCloseTimer.current = setTimeout(() => setReportOpen(false), 280)
  }

  function openSoldSheet()  { setSoldOpen(true) }
  function closeSoldSheet() {
    setSoldVisible(false)
    soldCloseTimer.current = setTimeout(() => setSoldOpen(false), 280)
  }

  function openReviewSheet()  { setReviewOpen(true) }
  function closeReviewSheet() {
    setReviewVisible(false)
    reviewCloseTimer.current = setTimeout(() => setReviewOpen(false), 280)
  }

  function openDeleteSheet()  { setDeleteOpen(true) }
  function closeDeleteSheet() {
    setDeleteVisible(false)
    deleteCloseTimer.current = setTimeout(() => setDeleteOpen(false), 280)
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
        @keyframes sheet-up   { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes sheet-down { from { transform: translateY(0); }   to { transform: translateY(100%); } }
        @keyframes fade-in    { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fade-out   { from { opacity: 1; } to { opacity: 0; } }
        .rsheet-enter { animation: sheet-up   0.28s cubic-bezier(0.32,0.72,0,1) forwards; }
        .rsheet-exit  { animation: sheet-down 0.28s cubic-bezier(0.32,0.72,0,1) forwards; }
        .rfade-enter  { animation: fade-in    0.22s ease forwards; }
        .rfade-exit   { animation: fade-out   0.22s ease forwards; }
        .report-reason-row { transition: background-color 0.1s ease; }
        .report-reason-row:active { background-color: #F8F8F8; }
        .report-btn:active { background-color: #FEE2E2 !important; border-color: #FCA5A5 !important; transform: scale(0.98); }
        .buyer-row { transition: background-color 0.1s ease; }
        .buyer-row:active { background-color: #F8F8F8; }
        .sold-inline-btn:active { opacity: 0.75; transform: scale(0.98); }
        .star-tap { transition: transform 0.1s ease; }
        .star-tap:active { transform: scale(0.85); }
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
          {localIsSold && (
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
            {listing.is_player_fit && (
              <span style={{
                fontSize: 12, fontWeight: 700,
                padding: '5px 11px', borderRadius: 20,
                backgroundColor: '#F0FBF5',
                color: '#1D7A47',
                border: '1px solid #C8EDD8',
                letterSpacing: '0.1px',
              }}>
                Player Fit
              </span>
            )}
          </div>

          {/* Price — prominent */}
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 4,
            marginBottom: 24,
          }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: '#1D7A47', letterSpacing: '-1px', lineHeight: 1 }}>
              £{Number(listing.price).toFixed(0)}
            </span>
            {localIsSold && (
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
            {isSeller ? 'Your Listing' : 'Listed by'}
          </h2>

          <Link
            href={`/profile/${listing.user_id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              backgroundColor: '#F9F9F9',
              borderRadius: 18,
              padding: '16px 18px',
              marginBottom: 28,
              textDecoration: 'none',
            }}
          >
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

            {/* Verified pill + chevron */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                backgroundColor: '#F0FBF5',
                border: '1px solid #C8EDD8',
                borderRadius: 20, padding: '5px 10px',
              }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#1D7A47' }}>✓</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#1D7A47' }}>Verified</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="#C8C8C8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </Link>

          {/* ── Seller: edit listing button ── */}
          {isSeller && (
            <Link
              href={`/listing/${listing.id}/edit`}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 14, fontWeight: 700, color: '#0a0a0a',
                backgroundColor: '#F5F5F5',
                border: '1.5px solid #E4E4E4',
                borderRadius: 14,
                padding: '13px 20px', marginBottom: 12,
                textDecoration: 'none',
                transition: 'opacity 0.1s ease, transform 0.1s ease',
              }}
            >
              <PencilIcon />
              Edit Listing
            </Link>
          )}

          {/* ── Seller: mark-as-sold inline button ── */}
          {isSeller && !localIsSold && (
            <button
              onClick={openSoldSheet}
              className="sold-inline-btn"
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 14, fontWeight: 700, color: '#0a0a0a',
                backgroundColor: '#F5F5F5',
                border: '1.5px solid #E4E4E4',
                borderRadius: 14, cursor: 'pointer',
                padding: '13px 20px', marginBottom: 12,
                transition: 'opacity 0.1s ease, transform 0.1s ease',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="9" stroke="#0a0a0a" strokeWidth="1.8" />
                <path d="M8 12l3 3 5-5" stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Mark as Sold
            </button>
          )}

          {/* ── Seller: sold confirmation info ── */}
          {isSeller && localIsSold && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              backgroundColor: '#F6FDF9', border: '1px solid #C8EDD8',
              borderRadius: 14, padding: '12px 16px', marginBottom: 12,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, backgroundColor: '#1D7A47',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1D7A47', marginBottom: 1 }}>Marked as sold</p>
                {listing.sold_at && (
                  <p style={{ fontSize: 12, color: '#7BB898', fontWeight: 500 }}>
                    {new Date(listing.sold_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Eligible buyer: leave a review ── */}
          {isEligibleBuyer && !hasReviewed && (
            <button
              onClick={openReviewSheet}
              className="btn-tap"
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 14, fontWeight: 700, color: '#ffffff',
                backgroundColor: '#1D7A47', border: 'none',
                borderRadius: 14, cursor: 'pointer',
                padding: '13px 20px', marginBottom: 12,
                boxShadow: '0 4px 14px rgba(29,122,71,0.28)',
                transition: 'transform 0.12s ease',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#fff" />
              </svg>
              Leave a Review
            </button>
          )}

          {/* ── Eligible buyer: already reviewed ── */}
          {isEligibleBuyer && hasReviewed && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              backgroundColor: '#F6FDF9', border: '1px solid #C8EDD8',
              borderRadius: 14, padding: '12px 16px', marginBottom: 12,
            }}>
              <span style={{ fontSize: 15, color: '#1D7A47' }}>★</span>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1D7A47' }}>You reviewed this purchase</p>
            </div>
          )}

          {/* ── Seller: delete listing ── */}
          {isSeller && (
            <button
              type="button"
              onClick={openDeleteSheet}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 14, fontWeight: 600, color: '#BE123C',
                backgroundColor: '#FEF2F2',
                border: '1.5px solid #FECACA',
                borderRadius: 14, cursor: 'pointer',
                padding: '13px 20px', marginBottom: 12,
                transition: 'opacity 0.1s ease, transform 0.1s ease',
              }}
            >
              <TrashIcon />
              Delete Listing
            </button>
          )}

          {/* Report */}
          <div style={{ paddingBottom: 4, marginTop: 4 }}>
            <button
              type="button"
              onClick={openReport}
              className="report-btn"
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                fontSize: 14, fontWeight: 600, color: '#C0392B',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 14,
                cursor: 'pointer',
                padding: '13px 20px',
                transition: 'background-color 0.13s ease, border-color 0.13s ease',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke="#C0392B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 22v-7" stroke="#C0392B" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
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

        {/* CTA — varies by role */}
        {isSeller ? (
          localIsSold ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#F5F5F5', borderRadius: 999, padding: '15px 0',
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#AAAAAA' }}>Listing Sold ✓</span>
            </div>
          ) : (
            <button
              onClick={openSoldSheet}
              className="btn-tap"
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                backgroundColor: '#0a0a0a', color: '#ffffff',
                fontSize: 16, fontWeight: 700,
                padding: '15px 0', borderRadius: 999,
                border: 'none', cursor: 'pointer',
                letterSpacing: '-0.15px',
                boxShadow: '0 4px 18px rgba(0,0,0,0.22)',
                transition: 'transform 0.12s ease',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="1.8" />
                <path d="M8 12l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Mark as Sold
            </button>
          )
        ) : isEligibleBuyer && !hasReviewed ? (
          <button
            onClick={openReviewSheet}
            className="btn-tap"
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: '#1D7A47', color: '#ffffff',
              fontSize: 16, fontWeight: 700,
              padding: '15px 0', borderRadius: 999,
              border: 'none', cursor: 'pointer',
              letterSpacing: '-0.15px',
              boxShadow: '0 4px 18px rgba(29,122,71,0.30)',
              transition: 'transform 0.12s ease',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#fff" />
            </svg>
            Leave a Review
          </button>
        ) : (
          <Link
            href={`/messages?seller=${listing.user_id}&listing=${listing.id}`}
            className="btn-tap"
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: localIsSold ? '#D4D4D4' : '#1D7A47',
              color: '#ffffff',
              fontSize: 16, fontWeight: 700,
              padding: '15px 0',
              borderRadius: 999,
              textDecoration: 'none',
              letterSpacing: '-0.15px',
              boxShadow: localIsSold ? 'none' : '0 4px 18px rgba(29,122,71,0.30)',
              pointerEvents: localIsSold ? 'none' : 'auto',
              transition: 'transform 0.12s ease',
            }}
          >
            <MessageIcon />
            {localIsSold ? 'Item Sold' : 'Message Seller'}
          </Link>
        )}
      </div>

      {/* ── Mark-as-Sold sheet ───────────────────────────────── */}
      {soldOpen && (
        <>
          <div className={soldVisible ? 'rfade-enter' : 'rfade-exit'} onClick={closeSoldSheet} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.38)', zIndex: 55 }} />
          <div className={soldVisible ? 'rsheet-enter' : 'rsheet-exit'} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 60, boxShadow: '0 -4px 40px rgba(0,0,0,0.12)', maxHeight: '88dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0' }} />
            </div>
            <MarkAsSoldSheet
              listingId={listing.id}
              sellerId={listing.user_id}
              onClose={closeSoldSheet}
              onSold={buyerId => { setLocalIsSold(true); setLocalSoldToId(buyerId); closeSoldSheet() }}
            />
          </div>
        </>
      )}

      {/* ── Leave-Review sheet ────────────────────────────────── */}
      {reviewOpen && (
        <>
          <div className={reviewVisible ? 'rfade-enter' : 'rfade-exit'} onClick={closeReviewSheet} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.38)', zIndex: 55 }} />
          <div className={reviewVisible ? 'rsheet-enter' : 'rsheet-exit'} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 60, boxShadow: '0 -4px 40px rgba(0,0,0,0.12)', maxHeight: '88dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0' }} />
            </div>
            <LeaveReviewSheet
              listingId={listing.id}
              sellerId={listing.user_id}
              sellerName={listing.profiles?.username ?? 'this seller'}
              onClose={closeReviewSheet}
              onReviewed={() => { setHasReviewed(true); closeReviewSheet() }}
            />
          </div>
        </>
      )}

      {/* ── Report sheet ─────────────────────────────────────── */}
      {reportOpen && (
        <>
          <div
            className={reportVisible ? 'rfade-enter' : 'rfade-exit'}
            onClick={closeReport}
            style={{
              position: 'fixed', inset: 0,
              backgroundColor: 'rgba(0,0,0,0.38)',
              zIndex: 55,
            }}
          />
          <div
            className={reportVisible ? 'rsheet-enter' : 'rsheet-exit'}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              zIndex: 60,
              boxShadow: '0 -4px 40px rgba(0,0,0,0.12)',
              maxHeight: '88dvh',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0' }} />
            </div>
            <ReportSheet listingId={listing.id} onClose={closeReport} />
          </div>
        </>
      )}

      {/* ── Delete sheet ──────────────────────────────────────── */}
      {deleteOpen && (
        <>
          <div
            className={deleteVisible ? 'rfade-enter' : 'rfade-exit'}
            onClick={closeDeleteSheet}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.38)', zIndex: 55 }}
          />
          <div
            className={deleteVisible ? 'rsheet-enter' : 'rsheet-exit'}
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 60, boxShadow: '0 -4px 40px rgba(0,0,0,0.12)', maxHeight: '60dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0' }} />
            </div>
            <DeleteSheet
              listingId={listing.id}
              sellerId={listing.user_id}
              onClose={closeDeleteSheet}
              onDeleted={() => router.push('/profile?deleted=1')}
            />
          </div>
        </>
      )}
    </>
  )
}

/* ── Mark-as-Sold sheet ──────────────────────────────────────── */

type Buyer = { id: string; username: string; avatar_url: string | null }

function avatarBg(s: string) {
  const c = ['#1D7A47','#2563EB','#7C3AED','#DB2777','#D97706','#0891B2']
  let h = 0
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}

function MarkAsSoldSheet({
  listingId, sellerId, onClose, onSold,
}: {
  listingId: string
  sellerId: string
  onClose: () => void
  onSold: (buyerId: string) => void
}) {
  const [buyers,       setBuyers]       = useState<Buyer[]>([])
  const [selected,     setSelected]     = useState<string | null>(null)
  const [loadingBuyers, setLoadingBuyers] = useState(true)
  const [submitState,  setSubmitState]  = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error,        setError]        = useState<string | null>(null)

  useEffect(() => {
    async function fetchBuyers() {
      // All users who have exchanged messages with the seller
      const { data: msgs } = await supabase
        .from('messages')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${sellerId},receiver_id.eq.${sellerId}`)

      const ids = [...new Set(
        (msgs ?? [])
          .map(m => m.sender_id === sellerId ? m.receiver_id : m.sender_id)
          .filter(id => id !== sellerId)
      )]

      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', ids)
        setBuyers((profiles ?? []) as Buyer[])
      }
      setLoadingBuyers(false)
    }
    fetchBuyers()
  }, [sellerId])

  async function handleConfirm() {
    if (!selected) { setError('Please select the buyer.'); return }
    setSubmitState('loading')
    setError(null)
    const { error: err } = await supabase
      .from('listings')
      .update({ is_sold: true, sold_to_user_id: selected, sold_at: new Date().toISOString() })
      .eq('id', listingId)
    if (err) { setSubmitState('error'); setError('Something went wrong. Please try again.'); return }
    // Best-effort: insert a system notification into the conversation thread
    await supabase.from('messages').insert({
      sender_id:   sellerId,
      receiver_id: selected,
      listing_id:  listingId,
      content:     'This jersey has been marked as sold to you. You can now leave a review for the seller.',
      is_system:   true,
    })
    setSubmitState('success')
    setTimeout(() => onSold(selected), 1400)
  }

  if (submitState === 'success') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 28px 48px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#F0FBF5', border: '1.5px solid #C8EDD8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="#1D7A47" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p style={{ fontSize: 18, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px', marginBottom: 8 }}>Listing marked as sold</p>
        <p style={{ fontSize: 14, color: '#888888', lineHeight: 1.55 }}>The buyer can now leave you a review.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '10px 20px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px', marginBottom: 3 }}>Mark as Sold</p>
            <p style={{ fontSize: 13, color: '#AAAAAA', fontWeight: 500 }}>Select the buyer you agreed the sale with.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}><CloseIcon /></button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '0 20px', WebkitOverflowScrolling: 'touch' as const, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }}>
        {loadingBuyers ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <style>{`@keyframes _sp{to{transform:rotate(360deg)}}`}</style>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #EBEBEB', borderTopColor: '#1D7A47', animation: '_sp 0.75s linear infinite' }} />
          </div>
        ) : buyers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 0' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#0a0a0a', marginBottom: 8 }}>No conversations found</p>
            <p style={{ fontSize: 13, color: '#AAAAAA', lineHeight: 1.55, maxWidth: 260, margin: '0 auto' }}>
              Message the buyer about this listing first, then come back to mark it as sold.
            </p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              {buyers.map((buyer, idx) => {
                const isSelected = selected === buyer.id
                const isLast     = idx === buyers.length - 1
                const bInitial   = buyer.username[0]?.toUpperCase() ?? '?'
                return (
                  <button
                    key={buyer.id}
                    onClick={() => { setSelected(buyer.id); setError(null) }}
                    className="buyer-row"
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 4px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      borderBottom: isLast ? 'none' : '1px solid #F4F4F4',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 13,
                      backgroundColor: avatarBg(buyer.username),
                      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: 800, color: '#ffffff',
                      overflow: 'hidden', position: 'relative',
                    }}>
                      {buyer.avatar_url
                        ? <Image src={buyer.avatar_url} alt={bInitial} fill className="object-cover" sizes="40px" />
                        : bInitial}
                    </div>
                    <span style={{ flex: 1, fontSize: 15, fontWeight: isSelected ? 700 : 500, color: '#0a0a0a' }}>
                      {buyer.username}
                    </span>
                    {isSelected ? (
                      <span style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: '#1D7A47', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                    ) : (
                      <span style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid #E0E0E0', flexShrink: 0 }} />
                    )}
                  </button>
                )
              })}
            </div>

            {error && <p style={{ fontSize: 13, color: '#BE123C', fontWeight: 500, marginBottom: 14, paddingLeft: 4 }}>{error}</p>}

            <button
              onClick={handleConfirm}
              disabled={submitState === 'loading'}
              style={{
                width: '100%', backgroundColor: submitState === 'loading' ? '#888888' : '#0a0a0a',
                color: '#ffffff', fontSize: 16, fontWeight: 700,
                padding: '15px 0', borderRadius: 999, border: 'none',
                cursor: submitState === 'loading' ? 'default' : 'pointer',
                boxShadow: '0 4px 18px rgba(0,0,0,0.20)',
                transition: 'background-color 0.15s ease', letterSpacing: '-0.1px',
              }}
            >
              {submitState === 'loading' ? 'Confirming…' : 'Confirm Sale'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Leave-Review sheet ───────────────────────────────────────── */

function LeaveReviewSheet({
  listingId, sellerId, sellerName, onClose, onReviewed,
}: {
  listingId: string
  sellerId: string
  sellerName: string
  onClose: () => void
  onReviewed: () => void
}) {
  const [rating,      setRating]      = useState(0)
  const [hovered,     setHovered]     = useState(0)
  const [comment,     setComment]     = useState('')
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error,       setError]       = useState<string | null>(null)

  useEffect(() => {
    if (submitState === 'success') {
      const t = setTimeout(onReviewed, 2000)
      return () => clearTimeout(t)
    }
  }, [submitState, onReviewed])

  async function handleSubmit() {
    if (rating === 0) { setError('Please select a star rating.'); return }
    setSubmitState('loading')
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { onClose(); return }

      // Idempotent: if already reviewed this seller, treat as success
      const { data: existing } = await supabase
        .from('reviews').select('id')
        .eq('reviewer_id', user.id).eq('reviewed_user_id', sellerId).maybeSingle()
      if (existing) { setSubmitState('success'); return }

      const { error: insertErr } = await supabase.from('reviews').insert({
        reviewer_id:      user.id,
        reviewed_user_id: sellerId,
        rating,
        comment: comment.trim() || null,
      })
      if (insertErr) throw insertErr
      setSubmitState('success')
    } catch {
      setSubmitState('error')
      setError('Something went wrong. Please try again.')
    }
  }

  if (submitState === 'success') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 28px 48px', textAlign: 'center' }}>
        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 18 }}>⭐</div>
        <p style={{ fontSize: 18, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px', marginBottom: 8 }}>Review submitted</p>
        <p style={{ fontSize: 14, color: '#888888', lineHeight: 1.55 }}>Thanks for helping the GAA Exchange community.</p>
      </div>
    )
  }

  const displayRating = hovered || rating
  const ratingLabels  = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '10px 20px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px', marginBottom: 3 }}>Leave a Review</p>
            <p style={{ fontSize: 13, color: '#AAAAAA', fontWeight: 500 }}>How was your experience with {sellerName}?</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}><CloseIcon /></button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '0 20px', WebkitOverflowScrolling: 'touch' as const, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }}>

        {/* Star picker */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#AAAAAA', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 14 }}>Rating</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                className="star-tap"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 40, lineHeight: 1,
                  color: n <= displayRating ? '#F59E0B' : '#E8E8E8',
                  padding: '0 1px',
                  transition: 'color 0.1s ease',
                }}
              >
                ★
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p style={{ fontSize: 13, color: '#888888', fontWeight: 600, marginTop: 10 }}>
              {ratingLabels[rating]}
            </p>
          )}
        </div>

        {/* Comment */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#AAAAAA', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 8 }}>
            Written review <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </p>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Describe your experience…"
            rows={3}
            maxLength={500}
            style={{
              width: '100%', backgroundColor: '#F5F5F5',
              border: '1px solid transparent', borderRadius: 14,
              padding: '12px 14px', fontSize: 14, color: '#1a1a1a',
              fontWeight: 400, lineHeight: 1.55,
              resize: 'none', outline: 'none',
              boxSizing: 'border-box', fontFamily: 'inherit',
            }}
            onFocus={e => { e.currentTarget.style.border = '1px solid #1D7A47'; e.currentTarget.style.backgroundColor = '#ffffff' }}
            onBlur={e => { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.backgroundColor = '#F5F5F5' }}
          />
        </div>

        {error && <p style={{ fontSize: 13, color: '#BE123C', fontWeight: 500, marginBottom: 14, paddingLeft: 4 }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitState === 'loading'}
          style={{
            width: '100%',
            backgroundColor: submitState === 'loading' ? '#A0C8B4' : '#1D7A47',
            color: '#ffffff', fontSize: 16, fontWeight: 700,
            padding: '15px 0', borderRadius: 999, border: 'none',
            cursor: submitState === 'loading' ? 'default' : 'pointer',
            boxShadow: submitState === 'loading' ? 'none' : '0 4px 18px rgba(29,122,71,0.28)',
            transition: 'background-color 0.15s ease', letterSpacing: '-0.1px',
          }}
        >
          {submitState === 'loading' ? 'Submitting…' : 'Submit Review'}
        </button>
      </div>
    </div>
  )
}

/* ── Report sheet component ──────────────────────────────────── */

function ReportSheet({ listingId, onClose }: { listingId: string; onClose: () => void }) {
  const [reason, setReason] = useState<string | null>(null)
  const [details, setDetails] = useState('')
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (submitState === 'success') {
      const t = setTimeout(onClose, 2400)
      return () => clearTimeout(t)
    }
  }, [submitState, onClose])

  async function handleSubmit() {
    if (!reason) { setError('Please select a reason before submitting.'); return }
    setSubmitState('loading')
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { onClose(); return }

      // Prevent duplicate reports from the same user on the same listing
      const { data: existing } = await supabase
        .from('reports')
        .select('id')
        .eq('reporter_id', user.id)
        .eq('listing_id', listingId)
        .maybeSingle()

      if (existing) {
        // Already reported — surface success to avoid revealing report data
        setSubmitState('success')
        return
      }

      const { error: insertErr } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          listing_id: listingId,
          reason,
          details: details.trim() || null,
        })

      if (insertErr) throw insertErr
      setSubmitState('success')
    } catch {
      setSubmitState('error')
      setError('Something went wrong. Please try again.')
    }
  }

  if (submitState === 'success') {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 28px 48px',
        textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          backgroundColor: '#F0FBF5', border: '1.5px solid #C8EDD8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 18,
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="#1D7A47" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p style={{ fontSize: 18, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px', marginBottom: 8 }}>
          Report submitted
        </p>
        <p style={{ fontSize: 14, color: '#888888', lineHeight: 1.55, maxWidth: 260 }}>
          Thanks for letting us know. We review all reports and take action where necessary.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '10px 20px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px', marginBottom: 3 }}>
              Report Listing
            </p>
            <p style={{ fontSize: 13, color: '#AAAAAA', fontWeight: 500 }}>
              Help us keep GAA Exchange safe and genuine.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{
        overflowY: 'auto', flex: 1, minHeight: 0,
        padding: '0 20px',
        WebkitOverflowScrolling: 'touch' as const,
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)',
      }}>
        {/* Reason rows */}
        <div style={{ marginBottom: 20 }}>
          {REPORT_REASONS.map((r, idx) => {
            const isSelected = reason === r
            const isLast = idx === REPORT_REASONS.length - 1
            return (
              <button
                key={r}
                onClick={() => { setReason(r); setError(null) }}
                className="report-reason-row"
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '15px 4px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: isLast ? 'none' : '1px solid #F4F4F4',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#0a0a0a' : '#333333' }}>
                  {r}
                </span>
                {isSelected ? (
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%',
                    backgroundColor: '#1D7A47',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                ) : (
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: '1.5px solid #E0E0E0',
                    flexShrink: 0,
                  }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Details textarea */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#AAAAAA', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 8 }}>
            Additional details <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </p>
          <textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            placeholder="Describe the issue…"
            rows={3}
            maxLength={500}
            style={{
              width: '100%',
              backgroundColor: '#F5F5F5',
              border: '1px solid transparent',
              borderRadius: 14,
              padding: '12px 14px',
              fontSize: 14, color: '#1a1a1a', fontWeight: 400,
              lineHeight: 1.55,
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
            onFocus={e => { e.currentTarget.style.border = '1px solid #1D7A47'; e.currentTarget.style.backgroundColor = '#ffffff' }}
            onBlur={e => { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.backgroundColor = '#F5F5F5' }}
          />
        </div>

        {/* Error message */}
        {error && (
          <p style={{ fontSize: 13, color: '#BE123C', fontWeight: 500, marginBottom: 14, paddingLeft: 4 }}>
            {error}
          </p>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={submitState === 'loading'}
          style={{
            width: '100%',
            backgroundColor: submitState === 'loading' ? '#A0C8B4' : '#1D7A47',
            color: '#ffffff',
            fontSize: 16, fontWeight: 700,
            padding: '15px 0',
            borderRadius: 999,
            border: 'none', cursor: submitState === 'loading' ? 'default' : 'pointer',
            boxShadow: submitState === 'loading' ? 'none' : '0 4px 18px rgba(29,122,71,0.28)',
            transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
            letterSpacing: '-0.1px',
          }}
        >
          {submitState === 'loading' ? 'Submitting…' : 'Submit Report'}
        </button>
      </div>
    </div>
  )
}

/* ── Delete sheet ────────────────────────────────────────────── */

function DeleteSheet({
  listingId,
  sellerId,
  onClose,
  onDeleted,
}: {
  listingId: string
  sellerId:  string
  onClose:   () => void
  onDeleted: () => void
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (state === 'success') {
      const t = setTimeout(onDeleted, 1200)
      return () => clearTimeout(t)
    }
  }, [state, onDeleted])

  async function handleDelete() {
    setState('loading')
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.id !== sellerId) {
        setError('You are not authorised to delete this listing.')
        setState('error')
        return
      }

      // 1. Delete messages referencing this listing (listing_id is NOT NULL on messages)
      const { error: msgErr } = await supabase.from('messages').delete().eq('listing_id', listingId)
      if (msgErr) throw msgErr

      // 2. Delete likes
      const { error: likeErr } = await supabase.from('likes').delete().eq('listing_id', listingId)
      if (likeErr) throw likeErr

      // 3. Delete reports
      const { error: repErr } = await supabase.from('reports').delete().eq('listing_id', listingId)
      if (repErr) throw repErr

      // 4. Delete listing images
      const { error: imgErr } = await supabase.from('listing_images').delete().eq('listing_id', listingId)
      if (imgErr) throw imgErr

      // 5. Delete the listing itself (user_id eq is the server-side ownership guard)
      const { error: listErr } = await supabase
        .from('listings')
        .delete()
        .eq('id', listingId)
        .eq('user_id', user.id)
      if (listErr) throw listErr

      setState('success')
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  if (state === 'success') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 28px 48px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#F0FBF5', border: '1.5px solid #C8EDD8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="#1D7A47" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p style={{ fontSize: 18, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px', marginBottom: 8 }}>Listing deleted</p>
        <p style={{ fontSize: 14, color: '#888888', lineHeight: 1.55 }}>Your listing has been removed.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '10px 20px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px', marginBottom: 3 }}>Delete Listing?</p>
            <p style={{ fontSize: 13, color: '#AAAAAA', fontWeight: 500 }}>This action cannot be undone.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ padding: '4px 20px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {error && (
          <p style={{ fontSize: 13, color: '#BE123C', fontWeight: 500, paddingLeft: 4 }}>{error}</p>
        )}

        <button
          type="button"
          onClick={onClose}
          disabled={state === 'loading'}
          style={{ width: '100%', backgroundColor: '#F5F5F5', color: '#0a0a0a', fontSize: 16, fontWeight: 600, padding: '15px 0', borderRadius: 999, border: 'none', cursor: 'pointer' }}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={state === 'loading'}
          style={{
            width: '100%',
            backgroundColor: state === 'loading' ? '#F5C6C6' : '#DC2626',
            color: '#ffffff',
            fontSize: 16, fontWeight: 700,
            padding: '15px 0', borderRadius: 999,
            border: 'none',
            cursor: state === 'loading' ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: state === 'loading' ? 'none' : '0 4px 16px rgba(220,38,38,0.30)',
            transition: 'background-color 0.15s ease',
          }}
        >
          {state === 'loading' ? (
            <>
              <style>{`@keyframes _dsp{to{transform:rotate(360deg)}}`}</style>
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: '_dsp 0.75s linear infinite', flexShrink: 0 }} />
              Deleting…
            </>
          ) : (
            'Delete Listing'
          )}
        </button>
      </div>
    </div>
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

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#F2F2F2" />
      <path d="M15 9l-6 6M9 9l6 6" stroke="#888888" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

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

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <polyline points="3 6 5 6 21 6" stroke="#BE123C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="#BE123C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="#BE123C" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="#BE123C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
