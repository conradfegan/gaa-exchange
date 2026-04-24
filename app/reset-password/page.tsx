'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import logo from '@/public/logo.png'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)

  // Supabase processes the #access_token fragment from the email link and fires
  // PASSWORD_RECOVERY via onAuthStateChange. We subscribe first, then also check
  // getSession() as a fallback in case Supabase finished processing the hash before
  // our subscription was registered (race condition in v2 with singleton client).
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    // Fallback: if the URL hash contains type=recovery and Supabase already has a
    // session (meaning the event fired before we subscribed), unblock the form.
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    if (hashParams.get('type') === 'recovery') {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setReady(true)
      })
    }

    return () => subscription.unsubscribe()
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      setDone(true)
      setTimeout(() => router.push('/explore'), 2000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ backgroundColor: '#ffffff', padding: '48px 24px 24px', textAlign: 'center', borderBottom: '1px solid #F0F0F0' }}>
        <Link href="/">
          <Image
            src={logo}
            alt="GAA Exchange"
            width={140}
            height={44}
            className="object-contain mx-auto"
          />
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0a0a0a', marginTop: 20, letterSpacing: '-0.4px' }}>
          Set new password
        </h1>
        <p style={{ fontSize: 14, color: '#888888', marginTop: 6 }}>
          Choose a new password for your account
        </p>
      </header>

      {/* Form */}
      <div style={{ flex: 1, padding: '32px 24px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {error && (
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 14,
              color: '#DC2626',
            }}>
              {error}
            </div>
          )}

          {done && (
            <div style={{
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 14,
              color: '#16A34A',
            }}>
              Password updated! Redirecting…
            </div>
          )}

          {!ready && !done && (
            <div style={{
              backgroundColor: '#FFF7ED',
              border: '1px solid #FED7AA',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 14,
              color: '#C2410C',
            }}>
              Waiting for reset link to be verified… If this takes too long, go back and request a new reset email.
            </div>
          )}

          {ready && !done && (
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="New Password" icon={<LockIcon />}>
                <input
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  style={inputStyle}
                />
              </Field>

              <Field label="Confirm Password" icon={<LockIcon />}>
                <input
                  type="password"
                  placeholder="Repeat your new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  style={inputStyle}
                />
              </Field>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 4,
                  backgroundColor: loading ? '#555555' : '#0a0a0a',
                  color: '#ffffff',
                  fontSize: 16,
                  fontWeight: 700,
                  padding: '16px 0',
                  borderRadius: 14,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  letterSpacing: '-0.1px',
                  transition: 'background-color 0.15s',
                }}
              >
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          )}

          <p style={{ marginTop: 14, fontSize: 14, color: '#888888', textAlign: 'center' }}>
            <Link href="/login" style={{ color: '#1D7A47', fontWeight: 600, textDecoration: 'none' }}>
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555555', marginBottom: 6, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          {icon}
        </span>
        {children}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  paddingLeft: 42,
  paddingRight: 14,
  paddingTop: 14,
  paddingBottom: 14,
  fontSize: 15,
  color: '#0a0a0a',
  backgroundColor: '#ffffff',
  border: '1px solid #E8E8E8',
  borderRadius: 12,
  outline: 'none',
  boxSizing: 'border-box',
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="#AAAAAA" strokeWidth="1.8" />
      <path d="M7 11V7a5 5 0 0110 0v4" stroke="#AAAAAA" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
