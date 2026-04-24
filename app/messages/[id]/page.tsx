'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

/* ── Types ───────────────────────────────────────────────────── */

type Message = {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  sent_at: string
  listing_id: string | null
  is_system: boolean
}

type OtherUser = {
  id: string
  username: string
  avatar_url: string | null
  county: string | null
}

type ListingSnippet = {
  id: string
  title: string
  price: number
  is_sold: boolean
  sold_to_user_id: string | null
  user_id: string
  listing_images: { image_url: string; image_type: string }[]
}

/* ── Helpers ─────────────────────────────────────────────────── */

function avatarColor(s: string) {
  const c = ['#1D7A47','#2563EB','#7C3AED','#DB2777','#D97706','#0891B2']
  let h = 0
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString())     return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
}

/* ── Page ────────────────────────────────────────────────────── */

export default function ConversationPage() {
  const params  = useParams()
  const otherId = params.id as string
  const router  = useRouter()

  const [user,          setUser]          = useState<User | null>(null)
  const [otherUser,     setOtherUser]     = useState<OtherUser | null>(null)
  const [messages,      setMessages]      = useState<Message[]>([])
  const [listing,       setListing]       = useState<ListingSnippet | null>(null)
  const [draft,         setDraft]         = useState('')
  const [sending,       setSending]       = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [hasReviewed,   setHasReviewed]   = useState(false)
  const [reviewOpen,    setReviewOpen]    = useState(false)
  const [reviewVisible, setReviewVisible] = useState(false)
  const reviewCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setUser(user)

      const urlListingId = new URLSearchParams(window.location.search).get('listing')

      const [profileRes, msgsRes, listingRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, avatar_url, county')
          .eq('id', otherId)
          .maybeSingle(),

        supabase
          .from('messages')
          .select('id, sender_id, receiver_id, content, sent_at, listing_id, is_system')
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),` +
            `and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`
          )
          .order('sent_at', { ascending: true }),

        urlListingId
          ? supabase
              .from('listings')
              .select('id, title, price, is_sold, sold_to_user_id, user_id, listing_images(image_url, image_type)')
              .eq('id', urlListingId)
              .single()
          : Promise.resolve({ data: null }),
      ])

      setOtherUser(profileRes.data as OtherUser | null)

      const fetchedMsgs = (msgsRes.data ?? []) as Message[]
      setMessages(fetchedMsgs)

      let resolvedListing: ListingSnippet | null = null
      if (listingRes.data) {
        resolvedListing = listingRes.data as ListingSnippet
        setListing(resolvedListing)
      } else {
        const fallbackId = fetchedMsgs.find(m => m.listing_id)?.listing_id ?? null
        if (fallbackId) {
          const { data } = await supabase
            .from('listings')
            .select('id, title, price, is_sold, sold_to_user_id, user_id, listing_images(image_url, image_type)')
            .eq('id', fallbackId)
            .single()
          if (data) { resolvedListing = data as ListingSnippet; setListing(resolvedListing) }
        }
      }

      // Check if the current user is the eligible buyer and has already reviewed
      if (resolvedListing?.is_sold && resolvedListing.sold_to_user_id === user.id) {
        const { data: existingReview } = await supabase
          .from('reviews')
          .select('id')
          .eq('reviewer_id', user.id)
          .eq('reviewed_user_id', resolvedListing.user_id)
          .maybeSingle()
        setHasReviewed(!!existingReview)
      }

      setLoading(false)
    }
    load()
  }, [otherId, router])

  useEffect(() => {
    if (!loading) scrollToBottom(false)
  }, [loading, scrollToBottom])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`thread:${[user.id, otherId].sort().join(':')}`)
      .on(
        'postgres_changes' as Parameters<typeof channel.on>[0],
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const msg = payload.new as Message
          if (msg.sender_id !== otherId && !msg.is_system) return
          setMessages(prev => [...prev, msg])
          setTimeout(() => scrollToBottom(true), 50)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, otherId, scrollToBottom])

  useEffect(() => {
    if (reviewOpen) { setReviewVisible(true); document.body.style.overflow = 'hidden' }
    else            { setReviewVisible(false); document.body.style.overflow = '' }
    return () => {
      if (reviewCloseTimer.current) clearTimeout(reviewCloseTimer.current)
      document.body.style.overflow = ''
    }
  }, [reviewOpen])

  function openReviewSheet()  { setReviewOpen(true) }
  function closeReviewSheet() {
    setReviewVisible(false)
    reviewCloseTimer.current = setTimeout(() => setReviewOpen(false), 280)
  }

  async function sendMessage() {
    if (!draft.trim() || !user || sending) return
    const content = draft.trim()
    setDraft('')
    setSending(true)

    const listingId = listing?.id ?? null

    const optimistic: Message = {
      id:          `opt-${Date.now()}`,
      sender_id:   user.id,
      receiver_id: otherId,
      content,
      sent_at:     new Date().toISOString(),
      listing_id:  listingId,
      is_system:   false,
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => scrollToBottom(true), 50)

    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: user.id, receiver_id: otherId, content, listing_id: listingId })
      .select()
      .single()

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setDraft(content)
    } else {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? data as Message : m))
    }
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isEligibleBuyer = !!(user && listing?.is_sold && listing?.sold_to_user_id === user.id)
  const sellerName      = listing?.user_id === otherId ? otherUser?.username ?? 'the seller' : 'the seller'

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes _spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid #EBEBEB', borderTopColor: '#1D7A47', animation: '_spin 0.75s linear infinite' }} />
      </div>
    )
  }

  const name    = otherUser?.username ?? 'Unknown user'
  const initial = name[0]?.toUpperCase() ?? '?'
  const bg      = avatarColor(otherUser?.id ?? name)

  const listingImg = listing
    ? (listing.listing_images.find(i => i.image_type === 'main' || i.image_type === 'front') ?? listing.listing_images[0])
    : null

  const grouped: { day: string; messages: Message[] }[] = []
  for (const msg of messages) {
    const day  = dayLabel(msg.sent_at)
    const last = grouped[grouped.length - 1]
    if (last?.day === day) { last.messages.push(msg) }
    else grouped.push({ day, messages: [msg] })
  }

  return (
    <>
      <style>{`
        @keyframes _spin { to { transform: rotate(360deg); } }
        @keyframes _fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sheet-up   { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes sheet-down { from { transform: translateY(0); }   to { transform: translateY(100%); } }
        @keyframes fade-in    { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fade-out   { from { opacity: 1; } to { opacity: 0; } }
        .msg-bubble    { animation: _fadeIn 0.18s ease both; }
        .send-btn:active { transform: scale(0.93); }
        .thread-input:focus { outline: none; }
        .listing-card:active { background-color: #F8F8F8 !important; }
        .rsheet-enter  { animation: sheet-up   0.28s cubic-bezier(0.32,0.72,0,1) forwards; }
        .rsheet-exit   { animation: sheet-down 0.28s cubic-bezier(0.32,0.72,0,1) forwards; }
        .rfade-enter   { animation: fade-in    0.22s ease forwards; }
        .rfade-exit    { animation: fade-out   0.22s ease forwards; }
        .star-tap { transition: transform 0.1s ease; }
        .star-tap:active { transform: scale(0.85); }
        .review-cta-btn { transition: opacity 0.1s ease, transform 0.1s ease; }
        .review-cta-btn:active { opacity: 0.78; transform: scale(0.97); }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', backgroundColor: '#F5F5F5' }}>

        {/* ── Top bar ── */}
        <div style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #F0F0F0',
          padding: '52px 16px 12px',
          display: 'flex', alignItems: 'center', gap: 12,
          flexShrink: 0,
          boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
        }}>
          <button
            onClick={() => router.back()}
            aria-label="Back"
            style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#F5F5F5', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <BackIcon />
          </button>

          <div style={{
            width: 40, height: 40, borderRadius: 13,
            backgroundColor: bg, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 800, color: '#ffffff',
            overflow: 'hidden', position: 'relative',
          }}>
            {otherUser?.avatar_url ? (
              <Image src={otherUser.avatar_url} alt={name} fill className="object-cover" sizes="40px" />
            ) : initial}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#0a0a0a', letterSpacing: '-0.1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </p>
            {otherUser?.county && (
              <p style={{ fontSize: 12, color: '#AAAAAA', fontWeight: 500 }}>{otherUser.county}</p>
            )}
          </div>
        </div>

        {/* ── Listing context card ── */}
        {listing && (
          <Link
            href={`/listing/${listing.id}`}
            className="listing-card"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              backgroundColor: '#ffffff',
              borderBottom: '1px solid #EFEFEF',
              padding: '10px 16px',
              textDecoration: 'none',
              flexShrink: 0,
              transition: 'background-color 0.1s ease',
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              backgroundColor: '#F5F5F5',
              overflow: 'hidden', position: 'relative',
              flexShrink: 0,
            }}>
              {listingImg ? (
                <Image src={listingImg.image_url} alt={listing.title} fill className="object-cover" sizes="44px" />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PlaceholderJersey />
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 13, fontWeight: 700, color: '#0a0a0a',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                marginBottom: 2, letterSpacing: '-0.1px',
              }}>
                {listing.title}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1D7A47' }}>
                  £{Number(listing.price).toFixed(0)}
                </p>
                {listing.is_sold && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#888888',
                    backgroundColor: '#F2F2F2',
                    padding: '2px 7px', borderRadius: 20,
                    letterSpacing: '0.3px', textTransform: 'uppercase',
                  }}>
                    Sold
                  </span>
                )}
              </div>
            </div>

            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <path d="M9 18l6-6-6-6" stroke="#D0D0D0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}

        {/* ── Message thread ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '0 32px' }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: '#ffffff', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <BubbleIcon />
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#0a0a0a', marginBottom: 6 }}>Start the conversation</p>
              <p style={{ fontSize: 13, color: '#AAAAAA', lineHeight: 1.5 }}>
                Send a message to {name} about their jersey.
              </p>
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.day}>
                {/* Day separator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 12px' }}>
                  <div style={{ flex: 1, height: 1, backgroundColor: '#EBEBEB' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.3px' }}>{group.day}</span>
                  <div style={{ flex: 1, height: 1, backgroundColor: '#EBEBEB' }} />
                </div>

                {group.messages.map((msg, idx) => {
                  // ── System notification bubble ──────────────────
                  if (msg.is_system) {
                    return (
                      <div key={msg.id} className="msg-bubble" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '10px 0 16px' }}>
                        <div style={{
                          maxWidth: '90%',
                          backgroundColor: '#F0FBF5',
                          border: '1px solid #C8EDD8',
                          borderRadius: 18,
                          padding: '14px 18px',
                          textAlign: 'center',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                            <span style={{
                              width: 28, height: 28, borderRadius: 9,
                              backgroundColor: '#1D7A47',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          </div>
                          <p style={{
                            fontSize: 13, color: '#1D7A47', fontWeight: 600, lineHeight: 1.55,
                            marginBottom: isEligibleBuyer ? 14 : 0,
                          }}>
                            {msg.content}
                          </p>
                          {isEligibleBuyer && !hasReviewed && (
                            <button
                              onClick={openReviewSheet}
                              className="review-cta-btn"
                              style={{
                                backgroundColor: '#1D7A47', color: '#ffffff',
                                fontSize: 13, fontWeight: 700,
                                padding: '9px 22px', borderRadius: 999,
                                border: 'none', cursor: 'pointer',
                                boxShadow: '0 2px 10px rgba(29,122,71,0.28)',
                              }}
                            >
                              Leave a Review
                            </button>
                          )}
                          {isEligibleBuyer && hasReviewed && (
                            <p style={{ fontSize: 12, color: '#7BB898', fontWeight: 700, marginTop: 2 }}>
                              Review submitted ★
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  }

                  // ── Regular message bubble ──────────────────────
                  const isMine  = msg.sender_id === user?.id
                  const isLast  = idx === group.messages.length - 1
                  const nextMsg = group.messages[idx + 1]
                  const showTime = isLast || (nextMsg && nextMsg.sender_id !== msg.sender_id)

                  return (
                    <div
                      key={msg.id}
                      className="msg-bubble"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMine ? 'flex-end' : 'flex-start',
                        marginBottom: showTime ? 10 : 3,
                      }}
                    >
                      <div style={{
                        maxWidth: '78%',
                        backgroundColor: isMine ? '#1D7A47' : '#ffffff',
                        color: isMine ? '#ffffff' : '#0a0a0a',
                        borderRadius: isMine
                          ? '18px 18px 5px 18px'
                          : '18px 18px 18px 5px',
                        padding: '10px 14px',
                        fontSize: 15,
                        lineHeight: 1.5,
                        boxShadow: isMine
                          ? '0 2px 8px rgba(29,122,71,0.22)'
                          : '0 1px 4px rgba(0,0,0,0.07)',
                        wordBreak: 'break-word',
                      }}>
                        {msg.content}
                      </div>
                      {showTime && (
                        <p style={{ fontSize: 11, color: '#CCCCCC', fontWeight: 500, marginTop: 4, paddingLeft: isMine ? 0 : 2, paddingRight: isMine ? 2 : 0 }}>
                          {timeLabel(msg.sent_at)}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Leave Review CTA banner (eligible buyer, pre-review) ── */}
        {isEligibleBuyer && !hasReviewed && (
          <div style={{
            backgroundColor: '#F6FDF9',
            borderTop: '1px solid #C8EDD8',
            padding: '11px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>⭐</span>
            <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1D7A47', lineHeight: 1.3, margin: 0 }}>
              You purchased this jersey
            </p>
            <button
              onClick={openReviewSheet}
              className="review-cta-btn"
              style={{
                backgroundColor: '#1D7A47', color: '#ffffff',
                fontSize: 12, fontWeight: 700, letterSpacing: '-0.1px',
                padding: '7px 14px', borderRadius: 999,
                border: 'none', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(29,122,71,0.25)',
                flexShrink: 0,
              }}
            >
              Leave Review
            </button>
          </div>
        )}

        {/* ── Already reviewed indicator ── */}
        {isEligibleBuyer && hasReviewed && (
          <div style={{
            backgroundColor: '#F6FDF9',
            borderTop: '1px solid #C8EDD8',
            padding: '11px 16px',
            display: 'flex', alignItems: 'center', gap: 8,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 14, color: '#1D7A47', flexShrink: 0 }}>★</span>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1D7A47', margin: 0 }}>You reviewed this purchase</p>
          </div>
        )}

        {/* ── Input bar — sits above BottomNav (64px) ── */}
        <div style={{
          backgroundColor: '#ffffff',
          borderTop: '1px solid #F0F0F0',
          padding: '10px 14px',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
          marginBottom: 64,
          display: 'flex', alignItems: 'flex-end', gap: 10,
          boxShadow: '0 -2px 12px rgba(0,0,0,0.05)',
        }}>
          <textarea
            ref={inputRef}
            className="thread-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              border: 'none',
              backgroundColor: '#F5F5F5',
              borderRadius: 20,
              padding: '10px 14px',
              fontSize: 15,
              color: '#0a0a0a',
              lineHeight: 1.45,
              fontFamily: 'inherit',
              maxHeight: 100,
              overflowY: 'auto',
            }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 100) + 'px'
            }}
          />

          <button
            onClick={sendMessage}
            disabled={!draft.trim() || sending}
            className="send-btn"
            aria-label="Send"
            style={{
              width: 40, height: 40,
              borderRadius: '50%',
              backgroundColor: draft.trim() ? '#1D7A47' : '#E8E8E8',
              border: 'none', cursor: draft.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: draft.trim() ? '0 2px 10px rgba(29,122,71,0.30)' : 'none',
              transition: 'background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease',
            }}
          >
            <SendIcon active={!!draft.trim()} />
          </button>
        </div>
      </div>

      {/* ── Leave-Review sheet ── */}
      {reviewOpen && (
        <>
          <div
            className={reviewVisible ? 'rfade-enter' : 'rfade-exit'}
            onClick={closeReviewSheet}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.38)', zIndex: 55 }}
          />
          <div
            className={reviewVisible ? 'rsheet-enter' : 'rsheet-exit'}
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 60, boxShadow: '0 -4px 40px rgba(0,0,0,0.12)', maxHeight: '88dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0' }} />
            </div>
            <LeaveReviewSheet
              listingId={listing?.id ?? ''}
              sellerId={listing?.user_id ?? ''}
              sellerName={sellerName}
              onClose={closeReviewSheet}
              onReviewed={() => { setHasReviewed(true); closeReviewSheet() }}
            />
          </div>
        </>
      )}
    </>
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
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
            <CloseIcon />
          </button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '0 20px', WebkitOverflowScrolling: 'touch' as const, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }}>

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

function SendIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22 2L11 13" stroke={active ? '#ffffff' : '#BBBBBB'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22l-4-9-9-4 20-7z" fill={active ? '#ffffff' : '#BBBBBB'} />
    </svg>
  )
}

function BubbleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="#CCCCCC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlaceholderJersey() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
      <path d="M8 16l8-6h4l4 4 4-4h4l8 6-4 6H28v16H20V22h-4L8 16z" fill="#E8E8E8" stroke="#DDDDDD" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
