import Image from 'next/image'
import Link from 'next/link'
import logo from '@/public/logo.png'

// GAA-relevant: stadium atmosphere, green pitches, jersey/kit close-ups, matchday crowds
const MOSAIC = [
  // Packed stadium, green pitch — atmosphere
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=500&q=85',
  // Sports jersey close-up texture
  'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=500&q=85',
  // Green football pitch aerial
  'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=500&q=85',
  // Supporter/fan crowd energy
  'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=500&q=85',
  // Kit/shirt hanging — marketplace feel
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&q=85',
  // Matchday green grass close-up
  'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=500&q=85',
]

export default function SplashPage() {
  return (
    <>
      <style>{`
        @keyframes floatA {
          0%, 100% { transform: translateY(0px) scale(1.0); }
          50%       { transform: translateY(-7px) scale(1.018); }
        }
        @keyframes floatB {
          0%, 100% { transform: translateY(0px) scale(1.0); }
          50%       { transform: translateY(5px) scale(1.012); }
        }
        @keyframes floatC {
          0%, 100% { transform: translateY(0px) scale(1.0); }
          50%       { transform: translateY(-9px) scale(1.022); }
        }
        @keyframes floatD {
          0%, 100% { transform: translateY(0px) scale(1.0); }
          50%       { transform: translateY(6px) scale(1.016); }
        }
        @keyframes floatE {
          0%, 100% { transform: translateY(0px) scale(1.0); }
          50%       { transform: translateY(-5px) scale(1.014); }
        }
        @keyframes floatF {
          0%, 100% { transform: translateY(0px) scale(1.0); }
          50%       { transform: translateY(8px) scale(1.02); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cell-0 { animation: floatA 6.0s ease-in-out 0.0s infinite; }
        .cell-1 { animation: floatB 5.4s ease-in-out 0.5s infinite; }
        .cell-2 { animation: floatC 6.4s ease-in-out 1.0s infinite; }
        .cell-3 { animation: floatD 5.2s ease-in-out 0.3s infinite; }
        .cell-4 { animation: floatE 5.8s ease-in-out 0.8s infinite; }
        .cell-5 { animation: floatF 6.2s ease-in-out 0.6s infinite; }
        .fade-up-1 { animation: fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) 0.15s both; }
        .fade-up-2 { animation: fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) 0.28s both; }
        .fade-up-3 { animation: fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) 0.40s both; }
        .fade-up-4 { animation: fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) 0.50s both; }
        .fade-up-5 { animation: fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) 0.58s both; }
        .btn-primary:active { transform: scale(0.97); }
        .btn-secondary:active { transform: scale(0.97); }
      `}</style>

      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
      }}>

        {/* ── Mosaic ── */}
        <div style={{ position: 'relative', height: '58dvh', flexShrink: 0 }}>

          {/* 3×2 grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(2, 1fr)',
            height: '100%',
            gap: '2px',
            backgroundColor: '#0a0a0a',
          }}>
            {MOSAIC.map((src, i) => (
              <div
                key={i}
                className={`cell-${i}`}
                style={{ position: 'relative', overflow: 'hidden' }}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="33vw"
                  priority={i < 4}
                />
                {/* Per-cell tint for depth */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(0,0,0,0.08)',
                  pointerEvents: 'none',
                }} />
              </div>
            ))}
          </div>

          {/* Bottom-heavy gradient fade to white */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: [
              'linear-gradient(180deg,',
              '  rgba(0,0,0,0.22) 0%,',
              '  rgba(0,0,0,0.05) 30%,',
              '  transparent 48%,',
              '  rgba(255,255,255,0.4) 68%,',
              '  rgba(255,255,255,0.85) 83%,',
              '  #ffffff 100%',
              ')',
            ].join(''),
            pointerEvents: 'none',
          }} />

          {/* Logo pill — white card, centered, floating above gradient */}
          <div style={{
            position: 'absolute',
            top: '42%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            backgroundColor: 'rgba(255,255,255,0.96)',
            borderRadius: 20,
            padding: '14px 28px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}>
            <Image
              src={logo}
              alt="GAA Exchange"
              width={148}
              height={46}
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* ── Bottom card ── */}
        <div style={{
          flex: 1,
          backgroundColor: '#ffffff',
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          marginTop: -32,
          zIndex: 10,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '36px 28px 52px',
        }}>

          {/* Drag handle hint */}
          <div style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: '#E0E0E0',
            marginBottom: 28,
            flexShrink: 0,
          }} />

          <h1
            className="fade-up-1"
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: '#0a0a0a',
              letterSpacing: '-0.6px',
              textAlign: 'center',
              lineHeight: 1.18,
              marginBottom: 12,
            }}
          >
            Buy &amp; Sell<br />GAA Jerseys
          </h1>

          <p
            className="fade-up-2"
            style={{
              fontSize: 15,
              color: '#9A9A9A',
              textAlign: 'center',
              lineHeight: 1.5,
              marginBottom: 28,
              maxWidth: 260,
            }}
          >
            The marketplace for county jersey fans.
          </p>

          {/* Pagination dots */}
          <div className="fade-up-3" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 32 }}>
            <span style={{ width: 22, height: 5, borderRadius: 2.5, backgroundColor: '#1D7A47' }} />
            <span style={{ width: 5,  height: 5, borderRadius: '50%', backgroundColor: '#E0E0E0' }} />
            <span style={{ width: 5,  height: 5, borderRadius: '50%', backgroundColor: '#E0E0E0' }} />
          </div>

          {/* Create Account — primary */}
          <Link
            href="/signup"
            className="btn-primary fade-up-4"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              maxWidth: 360,
              backgroundColor: '#1D7A47',
              color: '#ffffff',
              textAlign: 'center',
              fontSize: 16,
              fontWeight: 700,
              padding: '17px 0',
              borderRadius: 16,
              textDecoration: 'none',
              letterSpacing: '-0.15px',
              marginBottom: 12,
              boxShadow: '0 4px 18px rgba(29,122,71,0.30)',
              transition: 'transform 0.12s ease, box-shadow 0.12s ease',
            }}
          >
            Create Account
          </Link>

          {/* Log In — secondary, clean text style */}
          <Link
            href="/login"
            className="btn-secondary fade-up-5"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              maxWidth: 360,
              backgroundColor: 'transparent',
              color: '#0a0a0a',
              textAlign: 'center',
              fontSize: 16,
              fontWeight: 600,
              padding: '17px 0',
              borderRadius: 16,
              textDecoration: 'none',
              letterSpacing: '-0.15px',
              border: '1.5px solid #E8E8E8',
              transition: 'transform 0.12s ease',
            }}
          >
            Log In
          </Link>
        </div>
      </div>
    </>
  )
}
