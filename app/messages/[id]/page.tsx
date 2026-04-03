'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
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
}

type OtherUser = {
  id: string
  username: string
  avatar_url: string | null
  county: string | null
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
  const params    = useParams()
  const otherId   = params.id as string
  const router    = useRouter()

  const [user,      setUser]      = useState<User | null>(null)
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null)
  const [messages,  setMessages]  = useState<Message[]>([])
  const [draft,     setDraft]     = useState('')
  const [sending,   setSending]   = useState(false)
  const [loading,   setLoading]   = useState(true)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setUser(user)

      // Fetch other user's profile and messages in parallel
      const [profileRes, msgsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, avatar_url, county')
          .eq('id', otherId)
          .maybeSingle(),

        supabase
          .from('messages')
          .select('id, sender_id, receiver_id, content, sent_at, listing_id')
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),` +
            `and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`
          )
          .order('sent_at', { ascending: true }),
      ])

      setOtherUser(profileRes.data as OtherUser | null)
      setMessages((msgsRes.data ?? []) as Message[])
      setLoading(false)
    }
    load()
  }, [otherId, router])

  // Scroll to bottom after initial load
  useEffect(() => {
    if (!loading) scrollToBottom(false)
  }, [loading, scrollToBottom])

  // Real-time subscription for incoming messages
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
          if (msg.sender_id !== otherId) return
          setMessages(prev => [...prev, msg])
          setTimeout(() => scrollToBottom(true), 50)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, otherId, scrollToBottom])

  async function sendMessage() {
    if (!draft.trim() || !user || sending) return
    const content = draft.trim()
    setDraft('')
    setSending(true)

    // Optimistic insert
    const optimistic: Message = {
      id:          `opt-${Date.now()}`,
      sender_id:   user.id,
      receiver_id: otherId,
      content,
      sent_at:     new Date().toISOString(),
      listing_id:  null,
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => scrollToBottom(true), 50)

    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: user.id, receiver_id: otherId, content, listing_id: null })
      .select()
      .single()

    if (error) {
      // Revert optimistic on failure
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setDraft(content)
    } else {
      // Replace optimistic with real row
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

  // Group messages by day for date separators
  const grouped: { day: string; messages: Message[] }[] = []
  for (const msg of messages) {
    const day = dayLabel(msg.sent_at)
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
        .msg-bubble { animation: _fadeIn 0.18s ease both; }
        .send-btn:active { transform: scale(0.93); }
        .thread-input:focus { outline: none; }
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
          {/* Back */}
          <button
            onClick={() => router.back()}
            aria-label="Back"
            style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#F5F5F5', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <BackIcon />
          </button>

          {/* Avatar */}
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

          {/* Name + county */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#0a0a0a', letterSpacing: '-0.1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </p>
            {otherUser?.county && (
              <p style={{ fontSize: 12, color: '#AAAAAA', fontWeight: 500 }}>{otherUser.county}</p>
            )}
          </div>
        </div>

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
          {/* Text area — auto-grows up to ~4 lines */}
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

          {/* Send button */}
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
    </>
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
