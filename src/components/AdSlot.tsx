import { useEffect, useRef } from 'react'

// Google AdSense. Renders nothing until configured in .env:
//   VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
//   VITE_ADSENSE_SLOT_HOME=1234567890
//   VITE_ADSENSE_SLOT_RESULT=1234567890
// EU/UK consent: enable AdSense "Privacy & messaging" (Google-certified CMP) in the AdSense dashboard.
// Placement rule: home and result screens only, never during play.
const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined
const SLOTS: Record<string, string | undefined> = {
  home: import.meta.env.VITE_ADSENSE_SLOT_HOME,
  result: import.meta.env.VITE_ADSENSE_SLOT_RESULT,
}

declare global { interface Window { adsbygoogle?: unknown[] } }

function loadScript() {
  if (document.querySelector('script[data-adsense]')) return
  const s = document.createElement('script')
  s.async = true
  s.dataset.adsense = ''
  s.crossOrigin = 'anonymous'
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`
  document.head.appendChild(s)
}

export function AdSlot({ slot }: { slot: 'home' | 'result' }) {
  const id = SLOTS[slot]
  const ref = useRef<HTMLModElement>(null)
  useEffect(() => {
    if (!CLIENT || !id || ref.current?.dataset.adsbygoogleStatus) return
    loadScript()
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}) } catch { /* blocked by an ad blocker */ }
  }, [id])
  if (!CLIENT || !id) return null
  return <ins ref={ref} className="adsbygoogle ad" data-ad-client={CLIENT} data-ad-slot={id} data-ad-format="auto" data-full-width-responsive="true" />
}
