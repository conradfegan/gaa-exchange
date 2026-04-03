'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

/* ── Constants ───────────────────────────────────────────────── */

const GAA_COUNTIES = [
  'Antrim','Armagh','Carlow','Cavan','Clare','Cork',
  'Derry','Donegal','Down','Dublin','Fermanagh','Galway',
  'Kerry','Kildare','Kilkenny','Laois','Leitrim','Limerick',
  'Longford','Louth','Mayo','Meath','Monaghan','Offaly',
  'Roscommon','Sligo','Tipperary','Tyrone','Waterford',
  'Westmeath','Wexford','Wicklow',
]

const STORAGE_BUCKET = 'jersey-images'

const YEARS = Array.from({ length: 17 }, (_, i) => String(2025 - i))

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

// Maps display label → exact Postgres enum value for listing_condition
const CONDITIONS: { label: string; value: string }[] = [
  { label: 'Brand New',  value: 'new' },
  { label: 'Like New',   value: 'like_new' },
  { label: 'Good',       value: 'good' },
  { label: 'Fair',       value: 'fair' },
  { label: 'Poor',       value: 'poor' },
]

type SlotKey = 'front' | 'back' | 'tags' | 'receipt'

// dbValue = exact enum value for the image_type column in listing_images
// Valid enum: front, back, tag, main, detail
const SLOTS: { key: SlotKey; label: string; hint: string; dbValue: string }[] = [
  { key: 'front',   label: 'Front',   hint: 'Front of jersey',   dbValue: 'front'  },
  { key: 'back',    label: 'Back',    hint: 'Back of jersey',    dbValue: 'back'   },
  { key: 'tags',    label: 'Tags',    hint: 'Inner labels',      dbValue: 'tag'    },
  { key: 'receipt', label: 'Receipt', hint: 'Proof of purchase', dbValue: 'detail' },
]

/* ── Page ────────────────────────────────────────────────────── */

export default function SellPage() {
  const router = useRouter()
  const [user, setUser]           = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // images
  const [files, setFiles]     = useState<Partial<Record<SlotKey, File>>>({})
  const [previews, setPreviews] = useState<Partial<Record<SlotKey, string>>>({})

  // fields
  const [title,       setTitle]       = useState('')
  const [county,      setCounty]      = useState('')
  const [year,        setYear]        = useState('')
  const [size,        setSize]        = useState('')
  const [condition,   setCondition]   = useState('')
  const [price,       setPrice]       = useState('')
  const [description, setDescription] = useState('')

  // submission
  const [errors,      setErrors]      = useState<Record<string, string>>({})
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setAuthLoading(false)
    })
  }, [])

  const handleImageSelect = useCallback((key: SlotKey, file: File) => {
    setFiles(prev => ({ ...prev, [key]: file }))
    setPreviews(prev => {
      if (prev[key]) URL.revokeObjectURL(prev[key]!)
      return { ...prev, [key]: URL.createObjectURL(file) }
    })
  }, [])

  const handleImageRemove = useCallback((key: SlotKey) => {
    setFiles(prev  => { const n = { ...prev };  delete n[key]; return n })
    setPreviews(prev => {
      if (prev[key]) URL.revokeObjectURL(prev[key]!)
      const n = { ...prev }; delete n[key]; return n
    })
  }, [])

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!files.front)     errs.front     = 'A front photo is required'
    if (!title.trim())    errs.title     = 'Title is required'
    if (!county)          errs.county    = 'County is required'
    if (!size)            errs.size      = 'Size is required'
    if (!condition)       errs.condition = 'Condition is required'
    if (!price.trim())    errs.price     = 'Price is required'
    else {
      const p = parseFloat(price.replace(/[£€$]/g, ''))
      if (isNaN(p) || p <= 0) errs.price = 'Enter a valid price'
    }
    return errs
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!user) return
    setSubmitError(null)

    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setErrors({})
    setSubmitting(true)

    try {
      // Insert listing row
      const { data: listing, error: listingErr } = await supabase
        .from('listings')
        .insert({
          user_id:      user.id,
          title:        title.trim(),
          county,
          size,
          condition,
          release_year: year ? parseInt(year) : null,
          price:        parseFloat(price.replace(/[£€$]/g, '')),
          description:  description.trim() || null,
          is_sold:      false,
        })
        .select('id')
        .single()

      if (listingErr) throw new Error(listingErr.message)

      // Upload images + insert listing_images
      const entries = Object.entries(files) as [SlotKey, File][]
      for (const [slotKey, file] of entries) {
        const slot   = SLOTS.find(s => s.key === slotKey)!
        const ext    = file.name.split('.').pop() ?? 'jpg'
        const path   = `${user.id}/${listing.id}/${slotKey}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { upsert: true, contentType: file.type })

        if (uploadErr) throw new Error(`Upload failed (${slotKey}): ${uploadErr.message}`)

        const { data: { publicUrl } } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(path)

        const { error: imgRowErr } = await supabase
          .from('listing_images')
          .insert({ listing_id: listing.id, image_url: publicUrl, image_type: slot.dbValue })

        if (imgRowErr) throw new Error(imgRowErr.message)
      }

      router.push(`/listing/${listing.id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Loading skeleton ── */
  if (authLoading) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes _spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid #EBEBEB', borderTopColor: '#1D7A47', animation: '_spin 0.75s linear infinite' }} />
      </div>
    )
  }

  /* ── Unauthenticated state ── */
  if (!user) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#F0FBF5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <LockIcon />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px', marginBottom: 10 }}>
          Sign in to sell
        </h2>
        <p style={{ fontSize: 15, color: '#9A9A9A', lineHeight: 1.55, marginBottom: 32, maxWidth: 280 }}>
          You need to be logged in to list a jersey for sale.
        </p>
        <Link
          href="/login"
          style={{ display: 'block', width: '100%', maxWidth: 320, backgroundColor: '#1D7A47', color: '#fff', fontWeight: 700, fontSize: 16, padding: '16px 0', borderRadius: 16, textDecoration: 'none', textAlign: 'center', boxShadow: '0 4px 16px rgba(29,122,71,0.28)' }}
        >
          Log In
        </Link>
        <Link
          href="/signup"
          style={{ display: 'block', marginTop: 12, fontSize: 15, color: '#1D7A47', fontWeight: 600, textDecoration: 'none' }}
        >
          Create an account
        </Link>
      </div>
    )
  }

  /* ── Main form ── */
  return (
    <>
      <style>{`
        @keyframes _spin { to { transform: rotate(360deg); } }
        .sell-field:focus {
          outline: none;
          border-color: #1D7A47 !important;
          box-shadow: 0 0 0 3px rgba(29,122,71,0.10);
        }
        .upload-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .upload-card:active { transform: scale(0.97); }
        .sell-btn:not(:disabled):active { transform: scale(0.98); }
      `}</style>

      <div style={{ backgroundColor: '#FAFAFA', minHeight: '100dvh', paddingBottom: 32 }}>

        {/* ── Header ── */}
        <header style={{ backgroundColor: '#ffffff', padding: '52px 20px 22px', borderBottom: '1px solid #F2F2F2' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.5px', lineHeight: 1.18, marginBottom: 6 }}>
                Sell your Jersey
              </h1>
              <p style={{ fontSize: 14, color: '#9A9A9A', fontWeight: 500 }}>
                List your county jersey in minutes.
              </p>
            </div>
            <button
              type="button"
              aria-label="Help"
              style={{ flexShrink: 0, marginTop: 2, width: 36, height: 36, borderRadius: 12, backgroundColor: '#F5F5F5', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <HelpIcon />
            </button>
          </div>
        </header>

        <form onSubmit={handleSubmit} noValidate>

          {/* ── Submit error banner ── */}
          {submitError && (
            <div style={{ margin: '16px 16px 0', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#DC2626' }}>
              {submitError}
            </div>
          )}

          {/* ── Photo upload section ── */}
          <section style={{ padding: '24px 16px 8px' }}>
            <SectionHeading
              title="Photos"
              subtitle="Add up to 4 photos to build trust and improve your chances of selling."
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              {SLOTS.map(slot => (
                <UploadCard
                  key={slot.key}
                  slot={slot}
                  preview={previews[slot.key]}
                  error={errors[slot.key]}
                  onSelect={handleImageSelect}
                  onRemove={handleImageRemove}
                />
              ))}
            </div>
          </section>

          {/* ── Listing details section ── */}
          <section style={{ padding: '24px 16px 8px' }}>
            <SectionHeading
              title="Listing Details"
              subtitle="Help buyers find your jersey with accurate information."
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>

              {/* Title */}
              <FormField label="Item Title" error={errors.title}>
                <input
                  className="sell-field"
                  type="text"
                  placeholder="e.g. Dublin Home Jersey 2023"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  style={inputStyle(!!errors.title)}
                />
              </FormField>

              {/* County + Release Year side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FormField label="County" error={errors.county}>
                  <SelectWrapper error={!!errors.county}>
                    <select
                      className="sell-field"
                      value={county}
                      onChange={e => setCounty(e.target.value)}
                      style={selectStyle(!!errors.county)}
                    >
                      <option value="">County</option>
                      {GAA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronIcon />
                  </SelectWrapper>
                </FormField>

                <FormField label="Release Year">
                  <SelectWrapper>
                    <select
                      className="sell-field"
                      value={year}
                      onChange={e => setYear(e.target.value)}
                      style={selectStyle(false)}
                    >
                      <option value="">Year</option>
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <ChevronIcon />
                  </SelectWrapper>
                </FormField>
              </div>

              {/* Size + Condition side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FormField label="Size" error={errors.size}>
                  <SelectWrapper error={!!errors.size}>
                    <select
                      className="sell-field"
                      value={size}
                      onChange={e => setSize(e.target.value)}
                      style={selectStyle(!!errors.size)}
                    >
                      <option value="">Size</option>
                      {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronIcon />
                  </SelectWrapper>
                </FormField>

                <FormField label="Condition" error={errors.condition}>
                  <SelectWrapper error={!!errors.condition}>
                    <select
                      className="sell-field"
                      value={condition}
                      onChange={e => setCondition(e.target.value)}
                      style={selectStyle(!!errors.condition)}
                    >
                      <option value="">Condition</option>
                      {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <ChevronIcon />
                  </SelectWrapper>
                </FormField>
              </div>

              {/* Price */}
              <FormField label="Price" error={errors.price}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, fontWeight: 600, color: '#9A9A9A', pointerEvents: 'none' }}>
                    £
                  </span>
                  <input
                    className="sell-field"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    style={{ ...inputStyle(!!errors.price), paddingLeft: 28 }}
                  />
                </div>
              </FormField>

            </div>
          </section>

          {/* ── Description section ── */}
          <section style={{ padding: '8px 16px 8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField label="Description">
                <textarea
                  className="sell-field"
                  rows={4}
                  placeholder="Describe the jersey — condition, fit, defects, authenticity details, or anything a buyer should know."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  style={{
                    ...inputStyle(false),
                    height: 'auto',
                    resize: 'none',
                    lineHeight: 1.55,
                    paddingTop: 14,
                    paddingBottom: 14,
                  }}
                />
              </FormField>
            </div>
          </section>

          {/* ── Submit ── */}
          <div style={{ padding: '20px 16px 8px' }}>
            <button
              type="submit"
              disabled={submitting}
              className="sell-btn"
              style={{
                width: '100%',
                backgroundColor: submitting ? '#A8D5BC' : '#1D7A47',
                color: '#ffffff',
                fontSize: 17,
                fontWeight: 700,
                padding: '18px 0',
                borderRadius: 999,
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.2px',
                boxShadow: submitting ? 'none' : '0 4px 20px rgba(29,122,71,0.30)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                transition: 'background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease',
              }}
            >
              {submitting ? (
                <>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: '_spin 0.75s linear infinite', flexShrink: 0 }} />
                  Listing your jersey…
                </>
              ) : (
                'Sell Jersey'
              )}
            </button>
          </div>

        </form>
      </div>
    </>
  )
}

/* ── Sub-components ──────────────────────────────────────────── */

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0a0a0a', letterSpacing: '-0.2px', marginBottom: 4 }}>
        {title}
      </h2>
      <p style={{ fontSize: 13, color: '#AAAAAA', lineHeight: 1.45 }}>{subtitle}</p>
    </div>
  )
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555555', marginBottom: 7, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
      {error && (
        <p style={{ fontSize: 12, color: '#DC2626', marginTop: 5, fontWeight: 500 }}>{error}</p>
      )}
    </div>
  )
}

function SelectWrapper({ error, children }: { error?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      {children}
      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <ChevronIcon />
      </span>
    </div>
  )
}

function UploadCard({
  slot,
  preview,
  error,
  onSelect,
  onRemove,
}: {
  slot: { key: SlotKey; label: string; hint: string }
  preview?: string
  error?: string
  onSelect: (key: SlotKey, file: File) => void
  onRemove: (key: SlotKey) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <div
        className="upload-card"
        onClick={() => !preview && inputRef.current?.click()}
        style={{
          aspectRatio: '1 / 1',
          borderRadius: 16,
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: preview ? '#000' : '#ffffff',
          border: error
            ? '1.5px dashed #DC2626'
            : preview
            ? 'none'
            : '1.5px dashed rgba(29,122,71,0.35)',
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
          cursor: preview ? 'default' : 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {preview ? (
          <>
            <Image src={preview} alt={slot.label} fill className="object-cover" sizes="50vw" />
            {/* Overlay actions */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.55) 100%)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              padding: '8px 8px',
              zIndex: 1,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                {slot.label}
              </span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onRemove(slot.key) }}
                style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label={`Remove ${slot.label} photo`}
              >
                <CrossIcon />
              </button>
            </div>
            {/* Re-shoot tap zone */}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
              style={{ position: 'absolute', inset: 0, background: 'none', border: 'none', cursor: 'pointer', zIndex: 2, opacity: 0 }}
              aria-label={`Replace ${slot.label} photo`}
            />
          </>
        ) : (
          <>
            {/* Plus badge */}
            <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#F0FBF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlusIcon />
            </div>
            <div style={{ textAlign: 'center', padding: '0 6px' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#0a0a0a', marginBottom: 2 }}>{slot.label}</p>
              <p style={{ fontSize: 11, color: '#BBBBBB', lineHeight: 1.3 }}>{slot.hint}</p>
            </div>
          </>
        )}
      </div>
      {error && (
        <p style={{ fontSize: 11, color: '#DC2626', marginTop: 4, fontWeight: 500, paddingLeft: 2 }}>{error}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onSelect(slot.key, file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

/* ── Style helpers ───────────────────────────────────────────── */

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '14px',
  fontSize: 15,
  color: '#0a0a0a',
  backgroundColor: '#F7F7F7',
  border: `1.5px solid ${hasError ? '#FCA5A5' : 'transparent'}`,
  borderRadius: 12,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
})

const selectStyle = (hasError: boolean): React.CSSProperties => ({
  ...inputStyle(hasError),
  appearance: 'none',
  WebkitAppearance: 'none',
  paddingRight: 36,
  cursor: 'pointer',
  color: '#0a0a0a',
})

/* ── Icons ───────────────────────────────────────────────────── */

function HelpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#AAAAAA" strokeWidth="1.8" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="#AAAAAA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="17" r="0.8" fill="#AAAAAA" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="#1D7A47" strokeWidth="1.8" />
      <path d="M7 11V7a5 5 0 0110 0v4" stroke="#1D7A47" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="#1D7A47" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke="#AAAAAA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M18 6L6 18M6 6l12 12" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
