'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  is_sold: boolean
  listing_images: { image_url: string; image_type: string }[]
}

type Conversation = {
  otherId: string
  otherUser: OtherUser | null
  lastMessage: Message
  unread: boolean
  listing: ListingSnippet | null
}

/* ── Helpers ─────────────────────────────────────────────────── */

function avatarColor(s: string) {
  const c = ['#1D7A47','#2563EB','#7C3AED','#DB2777','#D97706','#0891B2']
  let h = 0
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/* ── Page ────────────────────────────────────────────────────── */

export default function MessagesPage() {
  const router = useRouter()
  const [user,          setUser]          = useState<User | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    // Handle ?seller= redirect from listing "Message Seller" button,
    // passing ?listing= through so the thread page gets listing context.
    const params = new URLSearchParams(window.location.search)
    const seller = params.get('seller')
    if (seller) {
      const listingParam = params.get('listing')
      router.replace(`/messages/${seller}${listingParam ? `?listing=${listingParam}` : ''}`)
      return
    }

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setUser(user)

      const { data: msgs } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, sent_at, listing_id')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('sent_at', { ascending: false })

      if (!msgs || msgs.length === 0) { setLoading(false); return }

      // Group by conversation partner (latest message per pair).
      // Also track the most-recent non-null listing_id per partner.
      const convMap        = new Map<string, Message>()
      const listingByOther = new Map<string, string>()

      for (const m of msgs as Message[]) {
        const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id
        if (!convMap.has(otherId)) convMap.set(otherId, m)
        if (m.listing_id && !listingByOther.has(otherId)) {
          listingByOther.set(otherId, m.listing_id)
        }
      }

      const otherIds   = Array.from(convMap.keys())
      const listingIds = Array.from(new Set(listingByOther.values()))

      // Batch-fetch profiles and listings in parallel
      const [profilesRes, listingsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, avatar_url, county')
          .in('id', otherIds),
        listingIds.length > 0
          ? supabase
              .from('listings')
              .select('id, title, is_sold, listing_images(image_url, image_type)')
              .in('id', listingIds)
          : Promise.resolve({ data: [] as ListingSnippet[] }),
      ])

      const profileMap = Object.fromEntries(
        (profilesRes.data ?? []).map((p: OtherUser) => [p.id, p])
      )
      const listingMap = Object.fromEntries(
        (listingsRes.data ?? []).map((l: ListingSnippet) => [l.id, l])
      )

      const convos: Conversation[] = Array.from(convMap.entries()).map(([otherId, lastMsg]) => {
        const lid = listingByOther.get(otherId)
        return {
          otherId,
          otherUser:   profileMap[otherId] ?? null,
          lastMessage: lastMsg,
          unread:      lastMsg.receiver_id === user.id,
          listing:     lid ? (listingMap[lid] ?? null) : null,
        }
      })
      convos.sort((a, b) =>
        new Date(b.lastMessage.sent_at).getTime() - new Date(a.lastMessage.sent_at).getTime()
      )

      setConversations(convos)
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
        .convo-row { transition: background-color 0.1s ease; }
        .convo-row:active { background-color: #F8F8F8 !important; }
      `}</style>

      <div style={{ backgroundColor: '#FAFAFA', minHeight: '100dvh' }}>

        {/* ── Header ── */}
        <header style={{ backgroundColor: '#ffffff', padding: '52px 20px 18px', borderBottom: '1px solid #F2F2F2' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.5px', marginBottom: 4 }}>
            Messages
          </h1>
          <p style={{ fontSize: 14, color: '#AAAAAA', fontWeight: 500 }}>
            Chat with buyers and sellers
          </p>
        </header>

        {/* ── Empty state ── */}
        {conversations.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '72px 28px', textAlign: 'center' }}>
            <div style={{
              width: 68, height: 68, borderRadius: 22,
              backgroundColor: '#ffffff',
              boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 18,
            }}>
              <BubbleIcon />
            </div>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.3px', marginBottom: 8 }}>
              No messages yet
            </p>
            <p style={{ fontSize: 14, color: '#AAAAAA', lineHeight: 1.55, maxWidth: 260, marginBottom: 28 }}>
              When you message a seller or receive an enquiry, conversations will appear here.
            </p>
            <Link
              href="/explore"
              style={{
                backgroundColor: '#1D7A47', color: '#ffffff',
                fontSize: 14, fontWeight: 700,
                padding: '12px 24px', borderRadius: 999,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(29,122,71,0.28)',
              }}
            >
              Browse Jerseys
            </Link>
          </div>
        )}

        {/* ── Conversation list ── */}
        {conversations.length > 0 && (
          <div style={{ backgroundColor: '#ffffff', marginTop: 8 }}>
            {conversations.map((convo, idx) => {
              const other   = convo.otherUser
              const name    = other?.username ?? 'Unknown user'
              const initial = name[0]?.toUpperCase() ?? '?'
              const bg      = avatarColor(other?.id ?? name)
              const isMe    = convo.lastMessage.sender_id === user?.id
              const preview = `${isMe ? 'You: ' : ''}${convo.lastMessage.content}`
              const listing = convo.listing

              // Pick the best listing image (main/front first)
              const mainImg = listing
                ? (listing.listing_images.find(i => i.image_type === 'main' || i.image_type === 'front') ?? listing.listing_images[0])
                : null

              // Preserve listing context in the thread link
              const href = listing
                ? `/messages/${convo.otherId}?listing=${listing.id}`
                : `/messages/${convo.otherId}`

              return (
                <Link
                  key={convo.otherId}
                  href={href}
                  className="convo-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '13px 20px',
                    borderBottom: idx < conversations.length - 1 ? '1px solid #F7F7F7' : 'none',
                    textDecoration: 'none',
                    backgroundColor: '#ffffff',
                  }}
                >
                  {/* ── Left visual ── */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {listing ? (
                      <>
                        {/* Listing thumbnail as primary visual */}
                        <div style={{
                          width: 56, height: 56, borderRadius: 14,
                          backgroundColor: '#F5F5F5',
                          overflow: 'hidden',
                          position: 'relative',
                        }}>
                          {mainImg ? (
                            <Image
                              src={mainImg.image_url}
                              alt={listing.title}
                              fill
                              className="object-cover"
                              sizes="56px"
                            />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <PlaceholderJersey />
                            </div>
                          )}
                        </div>

                        {/* User avatar badge, bottom-right */}
                        <div style={{
                          position: 'absolute', bottom: -3, right: -3,
                          width: 22, height: 22, borderRadius: 7,
                          backgroundColor: bg,
                          border: '2.5px solid #ffffff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 800, color: '#ffffff',
                          overflow: 'hidden',
                        }}>
                          {other?.avatar_url ? (
                            <Image src={other.avatar_url} alt={name} fill className="object-cover" sizes="22px" />
                          ) : initial}
                        </div>

                        {/* Unread indicator */}
                        {convo.unread && (
                          <div style={{
                            position: 'absolute', top: -2, left: -2,
                            width: 11, height: 11, borderRadius: '50%',
                            backgroundColor: '#1D7A47',
                            border: '2px solid #ffffff',
                          }} />
                        )}
                      </>
                    ) : (
                      <>
                        {/* Fallback: user avatar */}
                        <div style={{
                          width: 50, height: 50, borderRadius: 16,
                          backgroundColor: bg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, fontWeight: 800, color: '#ffffff',
                          overflow: 'hidden',
                          position: 'relative',
                        }}>
                          {other?.avatar_url ? (
                            <Image src={other.avatar_url} alt={name} fill className="object-cover" sizes="50px" />
                          ) : initial}
                        </div>
                        {convo.unread && (
                          <div style={{
                            position: 'absolute', bottom: -1, right: -1,
                            width: 13, height: 13, borderRadius: '50%',
                            backgroundColor: '#1D7A47',
                            border: '2.5px solid #ffffff',
                          }} />
                        )}
                      </>
                    )}
                  </div>

                  {/* ── Text content ── */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
                      <p style={{
                        fontSize: 15, fontWeight: convo.unread ? 700 : 600,
                        color: '#0a0a0a', letterSpacing: '-0.1px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1, marginRight: 8,
                      }}>
                        {name}
                      </p>
                      <p style={{ fontSize: 11, color: '#CCCCCC', fontWeight: 500, flexShrink: 0 }}>
                        {relativeTime(convo.lastMessage.sent_at)}
                      </p>
                    </div>

                    {/* Listing title — shown when listing context is available */}
                    {listing && (
                      <p style={{
                        fontSize: 12, fontWeight: 600,
                        color: listing.is_sold ? '#AAAAAA' : '#1D7A47',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginBottom: 2,
                      }}>
                        {listing.is_sold && (
                          <span style={{ color: '#BBBBBB', fontWeight: 500 }}>Sold · </span>
                        )}
                        {listing.title}
                      </p>
                    )}

                    <p style={{
                      fontSize: 13,
                      color: convo.unread ? '#555555' : '#BBBBBB',
                      fontWeight: convo.unread ? 500 : 400,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {preview}
                    </p>
                  </div>

                  <ChevronRight />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

/* ── Icons ───────────────────────────────────────────────────── */

function BubbleIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="#CCCCCC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M9 18l6-6-6-6" stroke="#E0E0E0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlaceholderJersey() {
  return (
    <svg width="26" height="26" viewBox="0 0 48 48" fill="none">
      <path d="M8 16l8-6h4l4 4 4-4h4l8 6-4 6H28v16H20V22h-4L8 16z" fill="#E8E8E8" stroke="#DDDDDD" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
