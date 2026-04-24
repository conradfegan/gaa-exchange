'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import logo from '@/public/logo.png'

export default function SignupPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!username.trim())             { setError('Please enter a username.'); return }
    if (username.trim().length < 3)   { setError('Username must be at least 3 characters.'); return }
    if (!email.trim())                { setError('Please enter your email address.'); return }
    if (!password)                    { setError('Please enter a password.'); return }
    if (password.length < 6)          { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm)         { setError('Passwords do not match.'); return }

    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: username.trim() } },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          username: username.trim(),
          updated_at: new Date().toISOString(),
        })
      }

      router.push('/explore')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
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
          Create your account
        </h1>
        <p style={{ fontSize: 14, color: '#888888', marginTop: 6 }}>
          Join thousands of GAA fans
        </p>
      </header>

      {/* Form */}
      <div style={{ flex: 1, padding: '32px 24px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <form onSubmit={handleSignup} noValidate style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 14 }}>

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

          <Field label="Username" icon={<UserIcon />}>
            <input
              type="text"
              placeholder="yourname"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              style={inputStyle}
            />
          </Field>

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
              placeholder="Min. 8 characters"
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
              placeholder="Repeat password"
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
              width: '100%',
              marginTop: 8,
              backgroundColor: loading ? '#555555' : '#0a0a0a',
              color: '#ffffff',
              fontSize: 16,
              fontWeight: 700,
              padding: '16px 0',
              borderRadius: 14,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.1px',
              fontFamily: 'inherit',
              transition: 'background-color 0.15s',
            }}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p style={{ marginTop: 28, fontSize: 14, color: '#888888', textAlign: 'center' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#1D7A47', fontWeight: 600, textDecoration: 'none' }}>
            Log in
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
function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#AAAAAA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="7" r="4" stroke="#AAAAAA" strokeWidth="1.8" />
    </svg>
  )
}

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
