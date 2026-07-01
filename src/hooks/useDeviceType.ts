'use client'

import { useEffect, useState } from 'react'

export type DeviceType = 'mobile' | 'desktop'
type DevicePreference = DeviceType | 'auto'

const STORAGE_KEY = 'deviceTypePreference'
const MOBILE_BREAKPOINT = 768

function detectDevice(): DeviceType {
  if (typeof window === 'undefined') return 'desktop'
  return window.innerWidth < MOBILE_BREAKPOINT ? 'mobile' : 'desktop'
}

export function useDeviceType() {
  const [preference, setPreference] = useState<DevicePreference>('auto')
  const [detected, setDetected] = useState<DeviceType>('desktop')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as DevicePreference | null
    if (stored === 'mobile' || stored === 'desktop') setPreference(stored)
    setDetected(detectDevice())

    const onResize = () => setDetected(detectDevice())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const setDeviceOverride = (next: DevicePreference) => {
    setPreference(next)
    if (next === 'auto') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, next)
  }

  const deviceType: DeviceType = preference === 'auto' ? detected : preference

  return { deviceType, preference, setDeviceOverride }
}
