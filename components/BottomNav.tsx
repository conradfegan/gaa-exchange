'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ACTIVE   = '#1D7A47'
const INACTIVE = '#AAAAAA'

const tabs = [
  {
    label: 'Explore',
    href: '/explore',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7.5" stroke={active ? ACTIVE : INACTIVE} strokeWidth="1.8" />
        <path d="M20.5 20.5L17 17" stroke={active ? ACTIVE : INACTIVE} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Messages',
    href: '/messages',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
          stroke={active ? ACTIVE : INACTIVE}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: 'Sell',
    href: '/sell',
    icon: (_active: boolean) => (
      <div
        className="flex items-center justify-center w-12 h-12 rounded-full"
        style={{ backgroundColor: '#1D7A47', boxShadow: '0 4px 12px rgba(29,122,71,0.35)' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 5V19M5 12H19" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
    ),
  },
  {
    label: 'Likes',
    href: '/likes',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
          stroke={active ? ACTIVE : INACTIVE}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={active ? ACTIVE : 'none'}
        />
      </svg>
    ),
  },
  {
    label: 'Profile',
    href: '/profile',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
          stroke={active ? ACTIVE : INACTIVE}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="7" r="4" stroke={active ? ACTIVE : INACTIVE} strokeWidth="1.8" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white"
      style={{ borderTop: '1px solid #F0F0F0' }}
    >
      <div className="flex items-end justify-around max-w-lg mx-auto px-1 pb-2 pt-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          const isSell = tab.href === '/sell'

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 min-w-[52px] transition-all duration-200 ${
                isSell ? 'relative -top-4' : 'pt-1'
              }`}
            >
              {tab.icon(active)}
              {!isSell && (
                <span
                  className="text-[10px] font-medium leading-none"
                  style={{ color: active ? ACTIVE : INACTIVE }}
                >
                  {tab.label}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
