'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { type ListingDetail } from '@/components/listing/ListingDetailContent'

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

const CONDITIONS: { label: string; value: string }[] = [
  { label: 'Brand New',  value: 'new' },
  { label: 'Like New',   value: 'like_new' },
  { label: 'Good',       value: 'good' },
  { label: 'Fair',       value: 'fair' },
  { label: 'Poor',       value: 'poor' },
]

type SlotKey = 'front' | 'back' | 'tags' | 'receipt'

const SLOTS: { key: SlotKey; label: string; hint: string; dbValue: string }[] = [
  { key: 'front',   label: 'Front',   hint: 'Front of jersey',   dbValue: 'front'  },
  { key: 'back',    label: 'Back',    hint: 'Back of jersey',    dbValue: 'back'   },
  { key: 'tags',    label: 'Tags',    hint: 'Inner labels',      dbValue: 'tag'    },
  { key: 'receipt', label: 'Receipt', hint: 'Proof of purchase', dbValue: 'detail' },
]

// Maps image_type from DB → slot key
const TYPE_TO_SLOT: Record<string, SlotKey> = {
  front: 'front',
  main:  'front',
  back:  'back',
  tag:   'tags',
  detail: 'receipt',
}

type EditPanel = 'county' | 'year' | 'size' | 'condition' | null
type ExistingImage = { id: string; url: string }

/* ── Component ───────────────────────────────────────────────── */

export default function EditListingContent({ listing }: { listing: ListingDetail }) {
  const router = useRouter()

  // Auth
  const [authLoading,   setAuthLoading]   = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Existing images (loaded from listing prop)
  const [existingImages, setExistingImages] = useState<Partial<Record<SlotKey, ExistingImage>>>({})
  // Slots the user explicitly removed (existing images only)
  const [removedSlots, setRemovedSlots] = useState<Set<SlotKey>>(new Set())
  // New files selected by the user
  const [files,    setFiles]    = useState<Partial<Record<SlotKey, File>>>({})
  const [previews, setPreviews] = useState<Partial<Record<SlotKey, string>>>({})

  // Fields – prefilled from listing
  const [title,       setTitle]       = useState(listing.title)
  const [county,      setCounty]      = useState(listing.county)
  const [year,        setYear]        = useState(listing.release_year ? String(listing.release_year) : '')
  const [size,        setSize]        = useState(listing.size)
  const [condition,   setCondition]   = useState(listing.condition)
  const [isPlayerFit, setIsPlayerFit] = useState(listing.is_player_fit)
  const [price,       setPrice]       = useState(String(Math.round(listing.price)))
  const [description, setDescription] = useState(listing.description ?? '')

  // Sheet
  const [openPanel,    setOpenPanel]    = useState<EditPanel>(null)
  const [sheetVisible, setSheetVisible] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Submission
  const [errors,      setErrors]      = useState<Record<string, string>>({})
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Load existing images once
  useEffect(() => {
    const imgs: Partial<Record<SlotKey, ExistingImage>> = {}
    for (const img of listing.listing_images) {
      const slotKey = TYPE_TO_SLOT[img.image_type]
      if (slotKey && !imgs[slotKey]) {
        imgs[slotKey] = { id: img.id, url: img.image_url }
      }
    }
    setExistingImages(imgs)
  }, [listing.listing_images])

  // Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
      setAuthLoading(false)
    })
  }, [])

  // Sheet scroll lock
  useEffect(() => {
    if (openPanel) {
      setSheetVisible(true)
      document.body.style.overflow = 'hidden'
    } else {
      setSheetVisible(false)
      document.body.style.overflow = ''
    }
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
      document.body.style.overflow = ''
    }
  }, [openPanel])

  function openSheet(panel: EditPanel) {
    if (openPanel === panel) { closeSheet(); return }
    setOpenPanel(panel)
  }

  function closeSheet() {
    setSheetVisible(false)
    closeTimer.current = setTimeout(() => setOpenPanel(null), 280)
  }

  // Returns the URL to display for a given slot
  function slotPreview(key: SlotKey): string | undefined {
    if (previews[key]) return previews[key]
    if (!removedSlots.has(key) && existingImages[key]) return existingImages[key]!.url
    return undefined
  }

  const handleImageSelect = useCallback((key: SlotKey, file: File) => {
    setFiles(prev => ({ ...prev, [key]: file }))
    setPreviews(prev => {
      if (prev[key]) URL.revokeObjectURL(prev[key]!)
      return { ...prev, [key]: URL.createObjectURL(file) }
    })
    // Un-mark as removed if the user re-uploads to a removed slot
    setRemovedSlots(prev => {
      if (!prev.has(key)) return prev
      const next = new Set(prev); next.delete(key); return next
    })
  }, [])

  const handleImageRemove = useCallback((key: SlotKey) => {
    if (files[key]) {
      // Remove newly added file — existing image (if any) will show again
      setFiles(prev  => { const n = { ...prev }; delete n[key]; return n })
      setPreviews(prev => {
        if (prev[key]) URL.revokeObjectURL(prev[key]!)
        const n = { ...prev }; delete n[key]; return n
      })
    } else {
      // Mark existing image as removed
      setRemovedSlots(prev => new Set([...prev, key]))
    }
  }, [files])

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    const hasFront = !!(previews.front ?? (existingImages.front && !removedSlots.has('front')))
    if (!hasFront)       errs.front     = 'A front photo is required'
    if (!title.trim())   errs.title     = 'Title is required'
    if (!county)         errs.county    = 'County is required'
    if (!size)           errs.size      = 'Size is required'
    if (!condition)      errs.condition = 'Condition is required'
    if (!price.trim())   errs.price     = 'Price is required'
    else {
      const p = parseFloat(price.replace(/[£€$]/g, ''))
      if (isNaN(p) || p <= 0) errs.price = 'Enter a valid price'
    }
    return errs
  }

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault()
    if (!currentUserId) return
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
      // 1. Update listing row (user_id filter is the server-side ownership guard)
      const { error: listingErr } = await supabase
        .from('listings')
        .update({
          title:         title.trim(),
          county,
          size,
          condition,
          is_player_fit: isPlayerFit,
          release_year:  year ? parseInt(year) : null,
          price:         parseFloat(price.replace(/[£€$]/g, '')),
          description:   description.trim() || null,
        })
        .eq('id', listing.id)
        .eq('user_id', currentUserId)

      if (listingErr) throw new Error(listingErr.message)

      // 2. Delete removed existing images
      for (const slotKey of removedSlots) {
        const existing = existingImages[slotKey]
        if (!existing) continue
        const { error: delErr } = await supabase
          .from('listing_images')
          .delete()
          .eq('id', existing.id)
        if (delErr) throw new Error(delErr.message)
      }

      // 3. Upload new files and upsert listing_images rows
      const entries = Object.entries(files) as [SlotKey, File][]
      for (const [slotKey, file] of entries) {
        const slot = SLOTS.find(s => s.key === slotKey)!
        const ext  = file.name.split('.').pop() ?? 'jpg'
        const path = `${currentUserId}/${listing.id}/${slotKey}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { upsert: true, contentType: file.type })
        if (uploadErr) throw new Error(`Upload failed (${slotKey}): ${uploadErr.message}`)

        const { data: { publicUrl } } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(path)

        const existing  = existingImages[slotKey]
        // Update existing row if it wasn't removed; otherwise insert fresh
        const canUpdate = !!existing && !removedSlots.has(slotKey)

        if (canUpdate) {
          const { error: imgErr } = await supabase
            .from('listing_images')
            .update({ image_url: publicUrl })
            .eq('id', existing!.id)
          if (imgErr) throw new Error(imgErr.message)
        } else {
          const { error: imgErr } = await supabase
            .from('listing_images')
            .insert({ listing_id: listing.id, image_url: publicUrl, image_type: slot.dbValue })
          if (imgErr) throw new Error(imgErr.message)
        }
      }

      router.push(`/listing/${listing.id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Loading ── */
  if (authLoading) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes _spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid #EBEBEB', borderTopColor: '#1D7A47', animation: '_spin 0.75s linear infinite' }} />
      </div>
    )
  }

  /* ── Not authenticated ── */
  if (!currentUserId) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#F0FBF5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <LockIcon />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px', marginBottom: 10 }}>Sign in to edit</h2>
        <p style={{ fontSize: 15, color: '#9A9A9A', lineHeight: 1.55, marginBottom: 32, maxWidth: 280 }}>
          You need to be logged in to edit a listing.
        </p>
        <Link
          href="/login"
          style={{ display: 'block', width: '100%', maxWidth: 320, backgroundColor: '#1D7A47', color: '#fff', fontWeight: 700, fontSize: 16, padding: '16px 0', borderRadius: 16, textDecoration: 'none', textAlign: 'center', boxShadow: '0 4px 16px rgba(29,122,71,0.28)' }}
        >
          Log In
        </Link>
      </div>
    )
  }

  /* ── Not the owner ── */
  if (currentUserId !== listing.user_id) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <ShieldIcon />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px', marginBottom: 10 }}>Not authorised</h2>
        <p style={{ fontSize: 15, color: '#9A9A9A', lineHeight: 1.55, marginBottom: 32, maxWidth: 280 }}>
          You can only edit your own listings.
        </p>
        <Link
          href={`/listing/${listing.id}`}
          style={{ display: 'block', width: '100%', maxWidth: 320, backgroundColor: '#0a0a0a', color: '#fff', fontWeight: 700, fontSize: 16, padding: '16px 0', borderRadius: 16, textDecoration: 'none', textAlign: 'center' }}
        >
          View Listing
        </Link>
      </div>
    )
  }

  const conditionLabel = CONDITIONS.find(c => c.value === condition)?.label ?? ''

  /* ── Edit form ── */
  return (
    <>
      <style>{`
        @keyframes _spin      { to { transform: rotate(360deg); } }
        @keyframes sheet-up   { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes sheet-down { from { transform: translateY(0); }   to { transform: translateY(100%); } }
        @keyframes fade-in    { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fade-out   { from { opacity: 1; } to { opacity: 0; } }
        .sheet-enter { animation: sheet-up   0.28s cubic-bezier(0.32,0.72,0,1) forwards; }
        .sheet-exit  { animation: sheet-down 0.28s cubic-bezier(0.32,0.72,0,1) forwards; }
        .fade-enter  { animation: fade-in    0.22s ease forwards; }
        .fade-exit   { animation: fade-out   0.22s ease forwards; }
        .sell-field:focus {
          outline: none;
          border-color: #1D7A47 !important;
          box-shadow: 0 0 0 3px rgba(29,122,71,0.10);
        }
        .upload-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .upload-card:active { transform: scale(0.97); }
        .sell-btn:not(:disabled):active { transform: scale(0.98); }
        .sell-selector:active { opacity: 0.75; }
        .county-opt  { transition: background-color 0.1s ease; }
        .county-opt:active { background-color: #F0F0F0; }
        .size-pill   { transition: all 0.12s ease; }
        .option-row  { transition: background-color 0.1s ease; }
        .option-row:active { background-color: #F8F8F8; }
      `}</style>

      <div style={{ backgroundColor: '#FAFAFA', minHeight: '100dvh', paddingBottom: 32 }}>

        {/* ── Header ── */}
        <header style={{ backgroundColor: '#ffffff', padding: '52px 20px 22px', borderBottom: '1px solid #F2F2F2' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.5px', lineHeight: 1.18, marginBottom: 6 }}>
                Edit Listing
              </h1>
              <p style={{ fontSize: 14, color: '#9A9A9A', fontWeight: 500 }}>
                Update your jersey listing details.
              </p>
            </div>
            <Link
              href={`/listing/${listing.id}`}
              style={{
                flexShrink: 0,
                marginTop: 2,
                fontSize: 14,
                fontWeight: 600,
                color: '#888888',
                textDecoration: 'none',
                padding: '8px 0',
                letterSpacing: '-0.1px',
              }}
            >
              Cancel
            </Link>
          </div>
        </header>

        <form onSubmit={handleSave} noValidate>

          {/* ── Submit error banner ── */}
          {submitError && (
            <div style={{ margin: '16px 16px 0', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#DC2626' }}>
              {submitError}
            </div>
          )}

          {/* ── Photo section ── */}
          <section style={{ padding: '24px 16px 8px' }}>
            <SectionHeading
              title="Photos"
              subtitle="Tap a photo to replace it, or × to remove. At least one front photo is required."
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              {SLOTS.map(slot => (
                <UploadCard
                  key={slot.key}
                  slot={slot}
                  preview={slotPreview(slot.key)}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FormField label="County" error={errors.county}>
                  <SelectorTrigger value={county} placeholder="County" hasError={!!errors.county} onClick={() => openSheet('county')} />
                </FormField>
                <FormField label="Release Year">
                  <SelectorTrigger value={year} placeholder="Year" hasError={false} onClick={() => openSheet('year')} />
                </FormField>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FormField label="Size" error={errors.size}>
                  <SelectorTrigger value={size} placeholder="Size" hasError={!!errors.size} onClick={() => openSheet('size')} />
                </FormField>
                <FormField label="Condition" error={errors.condition}>
                  <SelectorTrigger value={conditionLabel} placeholder="Condition" hasError={!!errors.condition} onClick={() => openSheet('condition')} />
                </FormField>
              </div>

              {/* Player Fit toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F7F7F7', borderRadius: 12, padding: '14px 16px' }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#0a0a0a', marginBottom: 2, letterSpacing: '-0.1px' }}>Player Fit</p>
                  <p style={{ fontSize: 12, color: '#AAAAAA', lineHeight: 1.3 }}>Slim-fitting, match-day style jersey</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPlayerFit(v => !v)}
                  aria-pressed={isPlayerFit}
                  aria-label="Player Fit"
                  style={{ width: 48, height: 28, borderRadius: 999, backgroundColor: isPlayerFit ? '#1D7A47' : '#DDDDDD', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background-color 0.2s ease' }}
                >
                  <div style={{ position: 'absolute', top: 3, left: isPlayerFit ? 23 : 3, width: 22, height: 22, borderRadius: '50%', backgroundColor: '#ffffff', boxShadow: '0 1px 4px rgba(0,0,0,0.18)', transition: 'left 0.2s ease' }} />
                </button>
              </div>

              <FormField label="Price" error={errors.price}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, fontWeight: 600, color: '#9A9A9A', pointerEvents: 'none' }}>£</span>
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
                  style={{ ...inputStyle(false), height: 'auto', resize: 'none', lineHeight: 1.55, paddingTop: 14, paddingBottom: 14 }}
                />
              </FormField>
            </div>
          </section>

          {/* ── Save button ── */}
          <div style={{ padding: '20px 16px 8px' }}>
            <button
              type="submit"
              disabled={submitting}
              className="sell-btn"
              style={{
                width: '100%',
                backgroundColor: submitting ? '#A8D5BC' : '#1D7A47',
                color: '#ffffff',
                fontSize: 17, fontWeight: 700,
                padding: '18px 0', borderRadius: 999,
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.2px',
                boxShadow: submitting ? 'none' : '0 4px 20px rgba(29,122,71,0.30)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease',
              }}
            >
              {submitting ? (
                <>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: '_spin 0.75s linear infinite', flexShrink: 0 }} />
                  Saving changes…
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>

        </form>
      </div>

      {/* ── Bottom sheet backdrop + panel ── */}
      {openPanel && (
        <>
          <div
            className={sheetVisible ? 'fade-enter' : 'fade-exit'}
            onClick={closeSheet}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.38)', zIndex: 55 }}
          />
          <div
            className={sheetVisible ? 'sheet-enter' : 'sheet-exit'}
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 60, boxShadow: '0 -4px 40px rgba(0,0,0,0.12)', maxHeight: '82dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0' }} />
            </div>
            {openPanel === 'county' && (
              <SellCountySheet selected={county} onSelect={v => { setCounty(v); closeSheet() }} onClose={closeSheet} />
            )}
            {openPanel === 'year' && (
              <SellOptionSheet title="Release Year" options={YEARS.map(y => ({ label: y, value: y }))} selected={year} onSelect={v => { setYear(v); closeSheet() }} onClose={closeSheet} allowClear />
            )}
            {openPanel === 'size' && (
              <SellSizeSheet selected={size} onSelect={v => { setSize(v); closeSheet() }} onClose={closeSheet} />
            )}
            {openPanel === 'condition' && (
              <SellOptionSheet title="Condition" options={CONDITIONS} selected={condition} onSelect={v => { setCondition(v); closeSheet() }} onClose={closeSheet} allowClear={false} />
            )}
          </div>
        </>
      )}
    </>
  )
}

/* ── Selector trigger ────────────────────────────────────────── */

function SelectorTrigger({ value, placeholder, hasError, onClick }: { value: string; placeholder: string; hasError: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="sell-selector"
      style={{ width: '100%', padding: '14px', fontSize: 15, color: value ? '#0a0a0a' : '#AAAAAA', backgroundColor: '#F7F7F7', border: `1.5px solid ${hasError ? '#FCA5A5' : 'transparent'}`, borderRadius: 12, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: value ? 500 : 400, transition: 'opacity 0.1s ease' }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{value || placeholder}</span>
      <span style={{ flexShrink: 0, marginLeft: 6 }}><ChevronIcon /></span>
    </button>
  )
}

/* ── County sheet ────────────────────────────────────────────── */

function SellCountySheet({ selected, onSelect, onClose }: { selected: string; onSelect: (v: string) => void; onClose: () => void }) {
  return (
    <>
      <div style={{ padding: '10px 20px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px' }}>County</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><SheetCloseIcon /></button>
        </div>
      </div>
      <div style={{ overflowY: 'auto', padding: '0 16px', flex: 1, minHeight: 0, WebkitOverflowScrolling: 'touch' as const, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {GAA_COUNTIES.map(c => {
            const isSel = selected === c
            return (
              <button key={c} type="button" onClick={() => onSelect(c)} className="county-opt" style={{ padding: '10px 6px', borderRadius: 12, fontSize: 13, fontWeight: isSel ? 700 : 500, border: isSel ? '1.5px solid #1D7A47' : '1.5px solid #EBEBEB', backgroundColor: isSel ? '#F0F9F4' : '#ffffff', color: isSel ? '#1D7A47' : '#333333', cursor: 'pointer', textAlign: 'center', lineHeight: 1.3 }}>
                {c}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

/* ── Size sheet ──────────────────────────────────────────────── */

function SellSizeSheet({ selected, onSelect, onClose }: { selected: string; onSelect: (v: string) => void; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '10px 20px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px' }}>Size</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><SheetCloseIcon /></button>
        </div>
      </div>
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '0 20px', WebkitOverflowScrolling: 'touch' as const, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {SIZES.map(s => {
            const isSel = selected === s
            return (
              <button key={s} type="button" onClick={() => onSelect(s)} className="size-pill" style={{ width: 64, height: 64, borderRadius: 16, fontSize: 15, fontWeight: isSel ? 800 : 600, border: isSel ? '2px solid #1D7A47' : '1.5px solid #EBEBEB', backgroundColor: isSel ? '#1D7A47' : '#ffffff', color: isSel ? '#ffffff' : '#333333', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Generic option sheet ────────────────────────────────────── */

function SellOptionSheet({ title, options, selected, onSelect, onClose, allowClear }: { title: string; options: { label: string; value: string }[]; selected: string; onSelect: (v: string) => void; onClose: () => void; allowClear: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '10px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px' }}>{title}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><SheetCloseIcon /></button>
        </div>
      </div>
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '0 20px', WebkitOverflowScrolling: 'touch' as const, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }}>
        <div style={{ marginTop: 10 }}>
          {options.map((opt, idx) => {
            const isSel = selected === opt.value
            const isLast = idx === options.length - 1
            return (
              <button key={opt.value} type="button" onClick={() => onSelect(opt.value)} className="option-row" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 4px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: isLast ? 'none' : '1px solid #F4F4F4' }}>
                <span style={{ fontSize: 15, fontWeight: isSel ? 700 : 500, color: isSel ? '#0a0a0a' : '#333333' }}>{opt.label}</span>
                {isSel ? (
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
        {allowClear && selected && (
          <button type="button" onClick={() => { onSelect(''); onClose() }} style={{ marginTop: 16, fontSize: 12, fontWeight: 600, color: '#AAAAAA', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'block' }}>
            Clear selection
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────────── */

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0a0a0a', letterSpacing: '-0.2px', marginBottom: 4 }}>{title}</h2>
      <p style={{ fontSize: 13, color: '#AAAAAA', lineHeight: 1.45 }}>{subtitle}</p>
    </div>
  )
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555555', marginBottom: 7, letterSpacing: '0.4px', textTransform: 'uppercase' }}>{label}</label>
      {children}
      {error && <p style={{ fontSize: 12, color: '#DC2626', marginTop: 5, fontWeight: 500 }}>{error}</p>}
    </div>
  )
}

function UploadCard({
  slot, preview, error, onSelect, onRemove,
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
        style={{ aspectRatio: '1 / 1', borderRadius: 16, overflow: 'hidden', position: 'relative', backgroundColor: preview ? '#000' : '#ffffff', border: error ? '1.5px dashed #DC2626' : preview ? 'none' : '1.5px dashed rgba(29,122,71,0.35)', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', cursor: preview ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        {preview ? (
          <>
            <Image src={preview} alt={slot.label} fill className="object-cover" sizes="50vw" unoptimized={preview.startsWith('blob:')} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.55) 100%)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '8px 8px', zIndex: 1 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.3px', textTransform: 'uppercase' }}>{slot.label}</span>
              <button type="button" onClick={e => { e.stopPropagation(); onRemove(slot.key) }} style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label={`Remove ${slot.label} photo`}>
                <CrossIcon />
              </button>
            </div>
            <button type="button" onClick={e => { e.stopPropagation(); inputRef.current?.click() }} style={{ position: 'absolute', inset: 0, background: 'none', border: 'none', cursor: 'pointer', zIndex: 2, opacity: 0 }} aria-label={`Replace ${slot.label} photo`} />
          </>
        ) : (
          <>
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
      {error && <p style={{ fontSize: 11, color: '#DC2626', marginTop: 4, fontWeight: 500, paddingLeft: 2 }}>{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; if (file) onSelect(slot.key, file); e.target.value = '' }} />
    </div>
  )
}

/* ── Style helpers ───────────────────────────────────────────── */

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%', padding: '14px', fontSize: 15, color: '#0a0a0a',
  backgroundColor: '#F7F7F7', border: `1.5px solid ${hasError ? '#FCA5A5' : 'transparent'}`,
  borderRadius: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
})

/* ── Icons ───────────────────────────────────────────────────── */

function LockIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="#1D7A47" strokeWidth="1.8" />
      <path d="M7 11V7a5 5 0 0110 0v4" stroke="#1D7A47" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function SheetCloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#F2F2F2" />
      <path d="M15 9l-6 6M9 9l6 6" stroke="#888888" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
