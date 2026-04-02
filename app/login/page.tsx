'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import logo from '@/public/logo.png'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message)
        return
      }
      router.push('/explore')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/explore` },
    })
    if (oauthError) {
      setError(oauthError.message)
      setGoogleLoading(false)
    }
    // On success, Supabase redirects — no need to setGoogleLoading(false)
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email above, then tap Forgot Password.')
      return
    }
    setError(null)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetSent(true)
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
          Welcome back
        </h1>
        <p style={{ fontSize: 14, color: '#888888', marginTop: 6 }}>
          Log in to your account
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

          {resetSent && (
            <div style={{
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 14,
              color: '#16A34A',
            }}>
              Password reset email sent — check your inbox.
            </div>
          )}

          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              backgroundColor: '#ffffff',
              color: '#0a0a0a',
              fontSize: 15,
              fontWeight: 600,
              padding: '15px 0',
              borderRadius: 14,
              border: '1px solid #E0E0E0',
              cursor: googleLoading ? 'not-allowed' : 'pointer',
              width: '100%',
            }}
          >
            <GoogleIcon />
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, backgroundColor: '#EFEFEF' }} />
            <span style={{ fontSize: 12, color: '#AAAAAA', fontWeight: 500 }}>or</span>
            <div style={{ flex: 1, height: 1, backgroundColor: '#EFEFEF' }} />
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Email" icon={<EmailIcon />}>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={inputStyle}
              />
            </Field>

            <Field label="Password" icon={<LockIcon />}>
              <input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={inputStyle}
              />
            </Field>

            {/* Forgot password */}
            <div style={{ textAlign: 'right', marginTop: -6 }}>
              <button
                type="button"
                onClick={handleForgotPassword}
                style={{ fontSize: 13, color: '#1D7A47', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Forgot Password?
              </button>
            </div>

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
              {loading ? 'Logging in…' : 'Log In'}
            </button>
          </form>
        </div>

        <p style={{ marginTop: 28, fontSize: 14, color: '#888888', textAlign: 'center' }}>
          Don&apos;t have an account?{' '}
          <Link href="/signup" style={{ color: '#1D7A47', fontWeight: 600, textDecoration: 'none' }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

/* ── Field wrapper ── */
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

/* ── Icons ── */
function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#AAAAAA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="22,6 12,13 2,6" stroke="#AAAAAA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="#AAAAAA" strokeWidth="1.8" />
      <path d="M7 11V7a5 5 0 0110 0v4" stroke="#AAAAAA" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}
