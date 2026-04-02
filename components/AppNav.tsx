'use client'

import { usePathname } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

const AUTH_PATHS = new Set(['/', '/login', '/signup'])

export function NavSpacer() {
  const pathname = usePathname()
  return AUTH_PATHS.has(pathname) ? null : <div className="h-16" aria-hidden />
}

export default function AppNav() {
  const pathname = usePathname()
  return AUTH_PATHS.has(pathname) ? null : <BottomNav />
}
