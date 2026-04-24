'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

/* ── Constants ───────────────────────────────────────────────── */

const COUNTIES = [
  'Antrim', 'Armagh', 'Cavan', 'Clare', 'Cork', 'Derry',
  'Donegal', 'Down', 'Dublin', 'Fermanagh', 'Galway', 'Kerry',
  'Kildare', 'Kilkenny', 'Laois', 'Leitrim', 'Limerick', 'Longford',
  'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly', 'Roscommon',
  'Sligo', 'Tipperary', 'Tyrone', 'Waterford', 'Westmeath', 'Wexford', 'Wicklow',
]

function avatarColor(username: string) {
  const colors = ['#1D7A47', '#2563EB', '#7C3AED', '#DB2777', '#D97706', '#0891B2']
  let h = 0
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}

/* ── Page ────────────────────────────────────────────────────── */

export default function EditProfilePage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [user,         setUser]         = useState<User | null>(null)
  const [username,     setUsername]     = useState('')
  const [county,       setCounty]       = useState('')
  const [bio,          setBio]          = useState('')
  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(null)
  const [avatarFile,   setAvatarFile]   = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [showCounty, setShowCounty] = useState(false)

  /* Load profile */
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setUser(user)

      const { data } = await supabase
        .from('profiles')
        .select('username, avatar_url, county, bio')
        .eq('id', user.id)
        .maybeSingle()

      if (data) {
        setUsername(data.username ?? '')
        setCounty(data.county ?? '')
        setBio(data.bio ?? '')
        setAvatarUrl(data.avatar_url ?? null)
      }
      setLoading(false)
    }
    load()
  }, [router])

  /* Avatar file picker */
  function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const preview = URL.createObjectURL(file)
    setAvatarPreview(preview)
  }

  /* Save */
  async function handleSave() {
    if (!user) return
    if (!username.trim()) { setError('Username is required.'); return }

    setSaving(true)
    setError(null)

    try {
      let newAvatarUrl = avatarUrl

      /* Upload new avatar if one was picked */
      if (avatarFile) {
        const ext  = avatarFile.name.split('.').pop() ?? 'jpg'
        const path = `${user.id}/avatar.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })

        if (uploadErr) throw new Error(`Avatar upload failed: ${uploadErr.message}`)

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(path)

        newAvatarUrl = publicUrl
      }

      /* Upsert profile row */
      const { error: saveErr } = await supabase
        .from('profiles')
        .upsert({
          id:         user.id,
          username:   username.trim(),
          county:     county || null,
          bio:        bio.trim() || null,
          avatar_url: newAvatarUrl,
        })

      if (saveErr) throw new Error(saveErr.message)

      router.push('/profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSaving(false)
    }
  }

  /* Helpers */
  const displayAvatar = avatarPreview ?? avatarUrl
  const initial       = username?.[0]?.toUpperCase() ?? '?'
  const bgColor       = username ? avatarColor(username) : '#1D7A47'

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes _spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid #EBEBEB', borderTopColor: '#1D7A47', animation: '_spin 0.75s linear infinite' }} />
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes _spin { to { transform: rotate(360deg); } }
        .field-input:focus { outline: none; border-color: #1D7A47 !important; box-shadow: 0 0 0 3px rgba(29,122,71,0.08); }
        .field-input::placeholder { color: #CCCCCC; }
        .county-opt:active { background-color: #F5F5F5; }
        .save-btn:active { transform: scale(0.98); opacity: 0.9; }
        .back-btn:active { opacity: 0.6; }
        .avatar-tap:active { opacity: 0.8; }
        @keyframes sheet-up   { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes sheet-down { from { transform: translateY(0); } to { transform: translateY(100%); } }
        .sheet-in  { animation: sheet-up   0.26s cubic-bezier(0.32,0.72,0,1) forwards; }
        .sheet-out { animation: sheet-down 0.26s cubic-bezier(0.32,0.72,0,1) forwards; }
        textarea.field-input { resize: none; }
      `}</style>

      <div style={{ backgroundColor: '#F7F8F7', minHeight: '100dvh' }}>

        {/* ── Nav bar ── */}
        <div style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #F0F0F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '52px 20px 14px',
        }}>
          <button
            onClick={() => router.push('/profile')}
            className="back-btn"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6, color: '#1D7A47', fontSize: 15, fontWeight: 600 }}
          >
            <ChevronLeftIcon />
            Profile
          </button>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px' }}>Edit Profile</p>
          {/* Spacer to centre title */}
          <div style={{ width: 72 }} />
        </div>

        <div style={{ padding: '24px 16px 96px' }}>

          {/* ── Avatar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
            <button
              onClick={() => fileRef.current?.click()}
              className="avatar-tap"
              style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <div style={{
                width: 88, height: 88, borderRadius: '50%',
                backgroundColor: bgColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, fontWeight: 800, color: '#ffffff',
                overflow: 'hidden', position: 'relative',
                boxShadow: '0 0 0 3px #ffffff, 0 0 0 4.5px #E8EDE9, 0 4px 18px rgba(0,0,0,0.10)',
              }}>
                {displayAvatar ? (
                  <Image src={displayAvatar} alt="avatar" fill className="object-cover" sizes="88px" />
                ) : initial}
              </div>
              {/* Camera overlay */}
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 28, height: 28, borderRadius: '50%',
                backgroundColor: '#1D7A47',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 0 2.5px #ffffff',
              }}>
                <CameraIcon />
              </div>
            </button>
            <p style={{ fontSize: 12, color: '#AAAAAA', fontWeight: 500, marginTop: 10 }}>Tap to change photo</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarPick}
              style={{ display: 'none' }}
            />
          </div>

          {/* ── Form ── */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: 18,
            border: '1px solid #F0F0F0',
            overflow: 'hidden',
          }}>

            {/* Username */}
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #F4F4F4' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#AAAAAA', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                maxLength={30}
                className="field-input"
                style={{
                  width: '100%', background: 'none', border: '1.5px solid #EBEBEB',
                  borderRadius: 10, padding: '11px 14px',
                  fontSize: 15, fontWeight: 500, color: '#0a0a0a',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* County */}
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #F4F4F4' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#AAAAAA', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
                County
              </label>
              <button
                onClick={() => setShowCounty(true)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'none', border: '1.5px solid #EBEBEB',
                  borderRadius: 10, padding: '11px 14px',
                  fontSize: 15, color: county ? '#0a0a0a' : '#CCCCCC', fontWeight: 500,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'border-color 0.15s ease',
                  boxSizing: 'border-box',
                }}
              >
                <span>{county || 'Select county'}</span>
                <ChevronDownIcon />
              </button>
            </div>

            {/* Bio */}
            <div style={{ padding: '16px 18px' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#AAAAAA', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
                Bio
              </label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell buyers a bit about yourself…"
                maxLength={200}
                rows={4}
                className="field-input"
                style={{
                  width: '100%', background: 'none', border: '1.5px solid #EBEBEB',
                  borderRadius: 10, padding: '11px 14px',
                  fontSize: 15, fontWeight: 500, color: '#0a0a0a',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.55,
                }}
              />
              <p style={{ fontSize: 11, color: '#CCCCCC', fontWeight: 500, marginTop: 6, textAlign: 'right' }}>
                {bio.length}/200
              </p>
            </div>
          </div>

          {/* ── Error ── */}
          {error && (
            <div style={{
              marginTop: 14,
              backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 12, padding: '12px 16px',
            }}>
              <p style={{ fontSize: 13, color: '#B91C1C', fontWeight: 500 }}>{error}</p>
            </div>
          )}

          {/* ── Save button ── */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="save-btn"
            style={{
              marginTop: 22,
              width: '100%',
              backgroundColor: saving ? '#A7C8B8' : '#1D7A47',
              color: '#ffffff',
              fontSize: 16, fontWeight: 700,
              padding: '15px 0', borderRadius: 999,
              border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving ? 'none' : '0 4px 16px rgba(29,122,71,0.28)',
              transition: 'background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease, opacity 0.1s ease',
              letterSpacing: '-0.2px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {saving ? (
              <>
                <style>{`@keyframes _spin2 { to { transform: rotate(360deg); } }`}</style>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#ffffff', animation: '_spin2 0.7s linear infinite' }} />
                Saving…
              </>
            ) : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* ── County bottom sheet ── */}
      {showCounty && (
        <>
          <div
            onClick={() => setShowCounty(false)}
            style={{
              position: 'fixed', inset: 0,
              backgroundColor: 'rgba(0,0,0,0.38)',
              zIndex: 55,
            }}
          />
          <div
            className="sheet-in"
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              zIndex: 60,
              maxHeight: '80dvh',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 -4px 40px rgba(0,0,0,0.12)',
            }}
          >
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 2, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0' }} />
            </div>

            {/* Header */}
            <div style={{ padding: '10px 20px 14px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px' }}>Select County</p>
              <button
                onClick={() => setShowCounty(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <CloseIcon />
              </button>
            </div>

            {/* County grid */}
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '0 16px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)', WebkitOverflowScrolling: 'touch' as const }}>
              {/* Clear option */}
              {county && (
                <button
                  onClick={() => { setCounty(''); setShowCounty(false) }}
                  style={{
                    width: '100%', padding: '11px 14px', marginBottom: 12,
                    borderRadius: 12, border: '1.5px solid #EBEBEB',
                    backgroundColor: '#FAFAFA',
                    fontSize: 13, fontWeight: 600, color: '#AAAAAA',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  Clear selection
                </button>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {COUNTIES.map(c => {
                  const isSelected = county === c
                  return (
                    <button
                      key={c}
                      onClick={() => { setCounty(c); setShowCounty(false) }}
                      className="county-opt"
                      style={{
                        padding: '10px 6px',
                        borderRadius: 12,
                        fontSize: 13, fontWeight: isSelected ? 700 : 500,
                        border: isSelected ? '1.5px solid #1D7A47' : '1.5px solid #EBEBEB',
                        backgroundColor: isSelected ? '#F0F9F4' : '#ffffff',
                        color: isSelected ? '#1D7A47' : '#333333',
                        cursor: 'pointer', textAlign: 'center', lineHeight: 1.3,
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      {c}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

/* ── Icons ───────────────────────────────────────────────────── */

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M15 18l-6-6 6-6" stroke="#1D7A47" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M6 9l6 6 6-6" stroke="#AAAAAA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="4" stroke="#ffffff" strokeWidth="1.8" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#F2F2F2" />
      <path d="M15 9l-6 6M9 9l6 6" stroke="#888888" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
