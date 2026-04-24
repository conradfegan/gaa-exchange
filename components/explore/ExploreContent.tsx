'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

export type ListingRow = {
  id: string
  title: string
  county: string
  size: string
  condition: string
  release_year: number | null
  price: number
  is_player_fit: boolean
  user_id: string
  profiles: { username: string; avatar_url: string | null } | null
  listing_images: { image_url: string; image_type: string }[]
}

type Props = {
  listings: ListingRow[]
  initialLikedIds: string[]
}

/* ── Filter constants ───────────────────────────────────────── */

const COUNTIES = [
  'Antrim', 'Armagh', 'Cavan', 'Clare', 'Cork', 'Derry',
  'Donegal', 'Down', 'Dublin', 'Fermanagh', 'Galway', 'Kerry',
  'Kildare', 'Kilkenny', 'Laois', 'Leitrim', 'Limerick', 'Longford',
  'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly', 'Roscommon',
  'Sligo', 'Tipperary', 'Tyrone', 'Waterford', 'Westmeath', 'Wexford', 'Wicklow',
]

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

type PriceKey = 'under30' | '30to50' | '50to80' | 'over80'
const PRICE_RANGES: { key: PriceKey; label: string; min: number; max: number }[] = [
  { key: 'under30', label: 'Under £30',  min: 0,   max: 30 },
  { key: '30to50',  label: '£30 – £50',  min: 30,  max: 50 },
  { key: '50to80',  label: '£50 – £80',  min: 50,  max: 80 },
  { key: 'over80',  label: 'Over £80',   min: 80,  max: Infinity },
]

type PanelType = 'county' | 'size' | 'price' | null

/* ── Component ──────────────────────────────────────────────── */

export default function ExploreContent({ listings, initialLikedIds }: Props) {
  const [searchQuery,      setSearchQuery]      = useState('')
  const [selectedCounty,   setSelectedCounty]   = useState<string | null>(null)
  const [selectedSize,     setSelectedSize]     = useState<string | null>(null)
  const [selectedPlayerFit, setSelectedPlayerFit] = useState(false)
  const [selectedPrice,    setSelectedPrice]    = useState<PriceKey | null>(null)
  const [openPanel,      setOpenPanel]      = useState<PanelType>(null)
  const [likedIds,       setLikedIds]       = useState<Set<string>>(new Set(initialLikedIds))
  const [pending,        setPending]        = useState<Set<string>>(new Set())
  const [sheetVisible,   setSheetVisible]   = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Animate sheet in/out + lock body scroll */
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

  function openSheet(panel: PanelType) {
    if (openPanel === panel) { closeSheet(); return }
    setOpenPanel(panel)
  }

  function closeSheet() {
    setSheetVisible(false)
    closeTimer.current = setTimeout(() => setOpenPanel(null), 280)
  }

  /* Filtered listings */
  const filtered = useMemo(() => {
    let result = listings

    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter(l =>
        l.county.toLowerCase().includes(q) ||
        l.size.toLowerCase().includes(q) ||
        l.title.toLowerCase().includes(q),
      )
    }
    if (selectedCounty) {
      result = result.filter(l => l.county === selectedCounty)
    }
    if (selectedSize) {
      result = result.filter(l => l.size === selectedSize)
    }
    if (selectedPlayerFit) {
      result = result.filter(l => l.is_player_fit === true)
    }
    if (selectedPrice) {
      const range = PRICE_RANGES.find(r => r.key === selectedPrice)
      if (range) {
        result = result.filter(l => l.price >= range.min && l.price < range.max)
      }
    }
    return result
  }, [listings, searchQuery, selectedCounty, selectedSize, selectedPlayerFit, selectedPrice])

  const sizeActive = !!(selectedSize || selectedPlayerFit)
  const activeFilterCount = [selectedCounty, sizeActive ? 'size' : null, selectedPrice].filter(Boolean).length

  async function toggleLike(e: React.MouseEvent, listingId: string) {
    e.preventDefault()
    e.stopPropagation()
    if (pending.has(listingId)) return
    const wasLiked = likedIds.has(listingId)
    setLikedIds(prev => {
      const next = new Set(prev)
      wasLiked ? next.delete(listingId) : next.add(listingId)
      return next
    })
    setPending(prev => new Set(prev).add(listingId))
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLikedIds(prev => {
          const next = new Set(prev)
          wasLiked ? next.add(listingId) : next.delete(listingId)
          return next
        })
        return
      }
      if (wasLiked) {
        await supabase.from('likes').delete().eq('user_id', user.id).eq('listing_id', listingId)
      } else {
        await supabase.from('likes').insert({ user_id: user.id, listing_id: listingId })
      }
    } catch {
      setLikedIds(prev => {
        const next = new Set(prev)
        wasLiked ? next.add(listingId) : next.delete(listingId)
        return next
      })
    } finally {
      setPending(prev => {
        const next = new Set(prev)
        next.delete(listingId)
        return next
      })
    }
  }

  /* Chip label helpers */
  const countyLabel = selectedCounty ?? 'County'
  const sizeLabel   = selectedSize && selectedPlayerFit
    ? `${selectedSize} · PF`
    : selectedSize
    ?? (selectedPlayerFit ? 'Player Fit' : 'Size')
  const priceLabel  = selectedPrice
    ? PRICE_RANGES.find(r => r.key === selectedPrice)?.label ?? 'Price'
    : 'Price'

  return (
    <>
      <style>{`
        @keyframes sheet-up   { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes sheet-down { from { transform: translateY(0); }   to { transform: translateY(100%); } }
        @keyframes fade-in    { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fade-out   { from { opacity: 1; } to { opacity: 0; } }
        .sheet-enter { animation: sheet-up   0.28s cubic-bezier(0.32,0.72,0,1) forwards; }
        .sheet-exit  { animation: sheet-down 0.28s cubic-bezier(0.32,0.72,0,1) forwards; }
        .fade-enter  { animation: fade-in    0.22s ease forwards; }
        .fade-exit   { animation: fade-out   0.22s ease forwards; }
        .lcard-exp   { transition: transform 0.13s ease, box-shadow 0.13s ease; }
        .lcard-exp:active { transform: scale(0.963); box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
        .chip-btn    { transition: all 0.13s ease; }
        .chip-btn:active { transform: scale(0.95); }
        .size-pill   { transition: all 0.12s ease; }
        .county-opt  { transition: background-color 0.1s ease; }
        .county-opt:active { background-color: #F0F0F0; }
        .price-row   { transition: background-color 0.1s ease; }
        .price-row:active { background-color: #F8F8F8; }
        .clear-all-btn:active { opacity: 0.6; }
      `}</style>

      <div className="min-h-screen" style={{ backgroundColor: '#FAFAFA' }}>

        {/* ── Header ── */}
        <header className="bg-white px-4" style={{ paddingTop: 52, paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Search bar */}
            <div
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', gap: 10,
                backgroundColor: '#F5F5F5',
                borderRadius: 14,
                padding: '10px 16px',
              }}
            >
              <SearchIcon />
              <input
                type="search"
                placeholder="Search jerseys, county, size…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none"
                style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 500 }}
              />
            </div>

            {/* Cart icon */}
            <button
              aria-label="Bag"
              style={{
                flexShrink: 0,
                width: 42, height: 42,
                borderRadius: 12,
                backgroundColor: '#F5F5F5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
              }}
              className="active:scale-90 active:opacity-70"
            >
              <BagIcon />
            </button>
          </div>
        </header>

        {/* ── Filter chips ── */}
        <div className="bg-white px-4 pt-3 pb-3" style={{ borderBottom: '1px solid #F0F0F0' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>

            <FilterChip
              label={countyLabel}
              active={!!selectedCounty}
              open={openPanel === 'county'}
              onClick={() => openSheet('county')}
              onClear={selectedCounty ? () => setSelectedCounty(null) : undefined}
            />
            <FilterChip
              label={sizeLabel}
              active={sizeActive}
              open={openPanel === 'size'}
              onClick={() => openSheet('size')}
              onClear={sizeActive ? () => { setSelectedSize(null); setSelectedPlayerFit(false) } : undefined}
            />
            <FilterChip
              label={priceLabel}
              active={!!selectedPrice}
              open={openPanel === 'price'}
              onClick={() => openSheet('price')}
              onClear={selectedPrice ? () => setSelectedPrice(null) : undefined}
            />

            {activeFilterCount > 1 && (
              <button
                onClick={() => {
                  setSelectedCounty(null)
                  setSelectedSize(null)
                  setSelectedPlayerFit(false)
                  setSelectedPrice(null)
                }}
                className="clear-all-btn"
                style={{
                  marginLeft: 'auto',
                  fontSize: 12, fontWeight: 600, color: '#AAAAAA',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '4px 2px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* ── Listings ── */}
        <div className="px-4 pt-5 pb-10">
          <div className="mb-4">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <h2 className="text-base font-bold text-black">
                {activeFilterCount > 0 ? 'Filtered Results' : 'Trending Jerseys'}
              </h2>
              {activeFilterCount > 0 && (
                <span style={{ fontSize: 12, color: '#AAAAAA', fontWeight: 500 }}>
                  {filtered.length} {filtered.length === 1 ? 'jersey' : 'jerseys'}
                </span>
              )}
            </div>
            <div className="h-px bg-gray-200" />
          </div>

          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 24px', textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 20,
                backgroundColor: '#ffffff', border: '1px solid #EFEFEF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <EmptyFilterIcon />
              </div>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px', marginBottom: 8 }}>
                No jerseys found
              </p>
              <p style={{ fontSize: 14, color: '#AAAAAA', lineHeight: 1.55, maxWidth: 240, marginBottom: 22 }}>
                Try adjusting your filters or search to find what you&#39;re looking for.
              </p>
              <button
                onClick={() => { setSelectedCounty(null); setSelectedSize(null); setSelectedPlayerFit(false); setSelectedPrice(null); setSearchQuery('') }}
                style={{
                  backgroundColor: '#1D7A47', color: '#ffffff',
                  fontSize: 14, fontWeight: 700,
                  padding: '12px 26px', borderRadius: 999,
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(29,122,71,0.25)',
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map(listing => {
                const mainImage =
                  listing.listing_images.find(img => img.image_type === 'main' || img.image_type === 'front') ??
                  listing.listing_images[0]
                const isLiked = likedIds.has(listing.id)
                const initial = listing.profiles?.username?.[0]?.toUpperCase() ?? '?'

                return (
                  <Link
                    key={listing.id}
                    href={`/listing/${listing.id}`}
                    className="lcard-exp block bg-white rounded-xl overflow-hidden"
                    style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}
                  >
                    <div className="relative aspect-square bg-gray-100">
                      {mainImage ? (
                        <Image
                          src={mainImage.image_url}
                          alt={listing.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, 200px"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <PlaceholderJersey />
                        </div>
                      )}
                      <div
                        className="absolute top-2 right-2 w-7 h-7 rounded-full border-2 border-white overflow-hidden flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: '#1D7A47', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
                      >
                        {listing.profiles?.avatar_url ? (
                          <Image src={listing.profiles.avatar_url} alt={initial} fill className="object-cover" sizes="28px" />
                        ) : initial}
                      </div>
                      <div
                        className="absolute bottom-2 left-2 flex items-center gap-0.5 bg-white rounded-full px-1.5 py-0.5"
                        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}
                      >
                        <span className="text-[10px] font-semibold" style={{ color: '#1D7A47' }}>✓</span>
                        <span className="text-[9px] font-medium" style={{ color: '#1D7A47' }}>Verified</span>
                      </div>
                    </div>

                    <div className="p-2.5 pt-2">
                      <p className="text-sm font-bold text-black leading-snug truncate">{listing.title}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: '#888888' }}>
                        {listing.county}{listing.release_year ? ` · ${listing.release_year}` : ''}
                      </p>
                      <div className="mt-1.5" style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <span
                          className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: '#F5F5F5', color: '#888888' }}
                        >
                          {listing.size}
                        </span>
                        {listing.is_player_fit && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: '#1D7A47',
                            backgroundColor: '#F0FBF5',
                            border: '1px solid #C8EDD8',
                            padding: '2px 6px', borderRadius: 20,
                            letterSpacing: '0.1px',
                            whiteSpace: 'nowrap',
                          }}>
                            Player Fit
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-sm font-bold" style={{ color: '#1D7A47' }}>
                          £{Number(listing.price).toFixed(0)}
                        </p>
                        <button
                          onClick={e => toggleLike(e, listing.id)}
                          aria-label={isLiked ? 'Unlike' : 'Like'}
                          className="p-1 -mr-0.5 transition-all duration-200 active:scale-90"
                        >
                          <HeartIcon filled={isLiked} />
                        </button>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom sheet backdrop + panel ── */}
      {openPanel && (
        <>
          {/* Backdrop */}
          <div
            className={sheetVisible ? 'fade-enter' : 'fade-exit'}
            onClick={closeSheet}
            style={{
              position: 'fixed', inset: 0,
              backgroundColor: 'rgba(0,0,0,0.38)',
              zIndex: 55,
            }}
          />

          {/* Sheet */}
          <div
            className={sheetVisible ? 'sheet-enter' : 'sheet-exit'}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              zIndex: 60,
              boxShadow: '0 -4px 40px rgba(0,0,0,0.12)',
              maxHeight: '82dvh',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Sheet handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0' }} />
            </div>

            {openPanel === 'county' && (
              <CountySheet
                selected={selectedCounty}
                onSelect={v => { setSelectedCounty(v); closeSheet() }}
                onClose={closeSheet}
              />
            )}
            {openPanel === 'size' && (
              <SizeSheet
                selected={selectedSize}
                onSelect={v => setSelectedSize(v)}
                selectedPlayerFit={selectedPlayerFit}
                onSetPlayerFit={v => setSelectedPlayerFit(v)}
                onClose={closeSheet}
              />
            )}
            {openPanel === 'price' && (
              <PriceSheet
                selected={selectedPrice}
                onSelect={v => { setSelectedPrice(v); closeSheet() }}
                onClose={closeSheet}
              />
            )}
          </div>
        </>
      )}
    </>
  )
}

/* ── Filter chip ────────────────────────────────────────────── */

function FilterChip({
  label, active, open, onClick, onClear,
}: {
  label: string
  active: boolean
  open: boolean
  onClick: () => void
  onClear?: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      <button
        onClick={onClick}
        className="chip-btn"
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: active ? '6px 10px 6px 12px' : '6px 12px',
          borderRadius: 999,
          fontSize: 12, fontWeight: 600,
          border: active ? '1px solid #1D7A47' : '1px solid #E0E0E0',
          backgroundColor: active ? '#1D7A47' : open ? '#F8F8F8' : '#ffffff',
          color: active ? '#ffffff' : '#555555',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {!active && <ChevronDownIcon color={open ? '#333' : '#888'} />}
        <span style={{ maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {active && onClear && (
          <span
            onClick={e => { e.stopPropagation(); onClear() }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 16, height: 16, borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.28)',
              fontSize: 10, fontWeight: 700, color: '#ffffff',
              lineHeight: 1, cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ×
          </span>
        )}
      </button>
    </div>
  )
}

/* ── County sheet ───────────────────────────────────────────── */

function CountySheet({ selected, onSelect, onClose }: {
  selected: string | null
  onSelect: (v: string | null) => void
  onClose: () => void
}) {
  return (
    <>
      <div style={{ padding: '10px 20px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px' }}>County</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <CloseIcon />
          </button>
        </div>
        {selected && (
          <button
            onClick={() => onSelect(null)}
            style={{
              marginTop: 10, fontSize: 12, fontWeight: 600, color: '#1D7A47',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            Clear selection
          </button>
        )}
      </div>

      <div style={{ overflowY: 'auto', padding: '0 16px', flex: 1, minHeight: 0, WebkitOverflowScrolling: 'touch' as const, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {COUNTIES.map(county => {
            const isSelected = selected === county
            return (
              <button
                key={county}
                onClick={() => onSelect(county)}
                className="county-opt"
                style={{
                  padding: '10px 6px',
                  borderRadius: 12,
                  fontSize: 13, fontWeight: isSelected ? 700 : 500,
                  border: isSelected ? '1.5px solid #1D7A47' : '1.5px solid #EBEBEB',
                  backgroundColor: isSelected ? '#F0F9F4' : '#ffffff',
                  color: isSelected ? '#1D7A47' : '#333333',
                  cursor: 'pointer',
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                {county}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

/* ── Size sheet ─────────────────────────────────────────────── */

function SizeSheet({ selected, onSelect, selectedPlayerFit, onSetPlayerFit, onClose }: {
  selected: string | null
  onSelect: (v: string | null) => void
  selectedPlayerFit: boolean
  onSetPlayerFit: (v: boolean) => void
  onClose: () => void
}) {
  const hasAnySelection = !!(selected || selectedPlayerFit)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Fixed header */}
      <div style={{ padding: '10px 20px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px' }}>Size</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '0 20px', WebkitOverflowScrolling: 'touch' as const, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {SIZES.map(size => {
            const isSelected = selected === size
            return (
              <button
                key={size}
                onClick={() => onSelect(isSelected ? null : size)}
                className="size-pill"
                style={{
                  width: 64, height: 64,
                  borderRadius: 16,
                  fontSize: 15, fontWeight: isSelected ? 800 : 600,
                  border: isSelected ? '2px solid #1D7A47' : '1.5px solid #EBEBEB',
                  backgroundColor: isSelected ? '#1D7A47' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#333333',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {size}
              </button>
            )
          })}
        </div>

        {/* Divider */}
        <div style={{ margin: '16px 0 14px', height: 1, backgroundColor: '#F0F0F0' }} />

        {/* Player Fit option */}
        <button
          onClick={() => onSetPlayerFit(!selectedPlayerFit)}
          className="size-pill"
          style={{
            width: '100%', height: 52,
            borderRadius: 14,
            fontSize: 14, fontWeight: selectedPlayerFit ? 800 : 600,
            border: selectedPlayerFit ? '2px solid #1D7A47' : '1.5px solid #EBEBEB',
            backgroundColor: selectedPlayerFit ? '#1D7A47' : '#ffffff',
            color: selectedPlayerFit ? '#ffffff' : '#333333',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {selectedPlayerFit && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          Player Fit
        </button>

        {hasAnySelection && (
          <button
            onClick={() => { onSelect(null); onSetPlayerFit(false) }}
            style={{
              marginTop: 20, fontSize: 12, fontWeight: 600, color: '#AAAAAA',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              display: 'block',
            }}
          >
            Clear selection
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Price sheet ────────────────────────────────────────────── */

function PriceSheet({ selected, onSelect, onClose }: {
  selected: PriceKey | null
  onSelect: (v: PriceKey | null) => void
  onClose: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Fixed header */}
      <div style={{ padding: '10px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.4px' }}>Price range</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '0 20px', WebkitOverflowScrolling: 'touch' as const, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }}>
      <div style={{ marginTop: 10 }}>
        {PRICE_RANGES.map((range, idx) => {
          const isSelected = selected === range.key
          const isLast = idx === PRICE_RANGES.length - 1
          return (
            <button
              key={range.key}
              onClick={() => onSelect(isSelected ? null : range.key)}
              className="price-row"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 4px',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: isLast ? 'none' : '1px solid #F4F4F4',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#0a0a0a' : '#333333' }}>
                {range.label}
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
      </div>
    </div>
  )
}

/* ── Icons ─────────────────────────────────────────────────── */

function BagIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z" stroke="#111111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 6h18" stroke="#111111" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 10a4 4 0 01-8 0" stroke="#111111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="8" stroke="#AAAAAA" strokeWidth="2" />
      <path d="M21 21l-4.35-4.35" stroke="#AAAAAA" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ChevronDownIcon({ color }: { color: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M6 9l6 6 6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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

function PlaceholderJersey() {
  return (
    <svg width="52" height="52" viewBox="0 0 48 48" fill="none">
      <path d="M8 16l8-6h4l4 4 4-4h4l8 6-4 6H28v16H20V22h-4L8 16z" fill="#EEEEEE" stroke="#DDDDDD" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function EmptyFilterIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M7 12h10M11 18h2" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
