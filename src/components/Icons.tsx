import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }
const base = ({ size = 22, ...p }: P) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
})

export const IHome = (p: P) => (<svg {...base(p)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></svg>)
export const IHeart = ({ filled, ...p }: P & { filled?: boolean }) => (<svg {...base(p)} fill={filled ? 'currentColor' : 'none'}><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.2 3.6 4.5 7.2 4.5c2 0 3.4 1.1 4.8 2.8 1.4-1.7 2.8-2.8 4.8-2.8 3.6 0 5.7 3.7 4.5 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z" /></svg>)
export const ICalendar = (p: P) => (<svg {...base(p)}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>)
export const IUser = (p: P) => (<svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.3-4 4.4-6 8-6s6.7 2 8 6" /></svg>)
export const IMenu = (p: P) => (<svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>)
export const IBack = (p: P) => (<svg {...base(p)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>)
export const IChevron = (p: P) => (<svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>)
export const ISearch = (p: P) => (<svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>)
export const IX = (p: P) => (<svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>)
export const ICheck = (p: P) => (<svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>)
export const IPin = (p: P) => (<svg {...base(p)}><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" /><circle cx="12" cy="9" r="2.5" /></svg>)
export const ILocate = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>)
export const ILocateOff = (p: P) => (<svg {...base(p)}><path d="M12 2v3M12 19v3M2 12h3M19 12h3M7.1 7.1A7 7 0 0 0 16.9 16.9M9.5 5.4A7 7 0 0 1 18.6 14.5M3 3l18 18" /></svg>)
export const IClock = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>)
export const ICard = (p: P) => (<svg {...base(p)}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6.5 15h3" /></svg>)
export const IHistory = (p: P) => (<svg {...base(p)}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7.5V12l3 2" /></svg>)
export const ILogout = (p: P) => (<svg {...base(p)}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" /></svg>)
export const IScissors = (p: P) => (<svg {...base(p)}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" /></svg>)
export const IStore = (p: P) => (<svg {...base(p)}><path d="M3 9.5 4.5 4h15L21 9.5M3 9.5h18M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v8h14v-8" /></svg>)
export const ILock = (p: P) => (<svg {...base(p)}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>)
export const IUnlock = (p: P) => (<svg {...base(p)}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 7.7-1.5" /></svg>)
export const ICamera = (p: P) => (<svg {...base(p)}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.5" r="3.5" /></svg>)
export const IInfo = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.01" /></svg>)
export const IHelp = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5v.7M12 17v.01" /></svg>)
export const IEdit = (p: P) => (<svg {...base(p)}><path d="M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4" /></svg>)
export const IWallet = (p: P) => (<svg {...base(p)}><path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4h-12A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" /><path d="M20 10h-5a2 2 0 0 0 0 4h5v-4Z" /></svg>)

// Ícones de serviço (cabelo, barba, combo, acabamento), no estilo dos ícones do Glide.
export function IconeServico({ tipo, size = 28 }: { tipo: 'corte' | 'barba' | 'combo' | 'pezinho'; size?: number }) {
  const s = { width: size, height: size, viewBox: '0 0 32 32', 'aria-hidden': true }
  const face = <path d="M10 13v4.5a6 6 0 0 0 12 0V13" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
  const hair = <path d="M8.5 14c-.8-4.5 1.6-8.5 7.5-8.5s8.3 4 7.5 8.5c-1.8-1.8-3.4-3-7.5-3s-5.7 1.2-7.5 3Z" fill="#fff" />
  const eyes = (<><circle cx="13.3" cy="16" r="1.1" fill="#fff" /><circle cx="18.7" cy="16" r="1.1" fill="#fff" /></>)
  const beard = <path d="M10 18c1.5 4.5 3.6 6.5 6 6.5s4.5-2 6-6.5c-2 1.3-3.6 1.6-6 1.6s-4-.3-6-1.6Z" fill="#3b82f6" />
  if (tipo === 'corte') return (<svg {...s}>{hair}{face}{eyes}<path d="M13.5 20.5c1.4 1.2 3.6 1.2 5 0" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" /><path d="M9 27h14" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" /></svg>)
  if (tipo === 'barba') return (<svg {...s}><path d="M9 10.5c2 1.6 4.4 2 7 2s5-.4 7-2" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />{face}{eyes}{beard}</svg>)
  if (tipo === 'combo') return (<svg {...s}>{hair}{face}{eyes}{beard}</svg>)
  return (<svg {...s}><rect x="11" y="9" width="10" height="15" rx="3" stroke="#fff" strokeWidth="2.2" fill="none" /><path d="M12 5v4M14 5v4M16 5v4M18 5v4M20 5v4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /><path d="M14 14h4M14 17h4" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" /><path d="M16 24v4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /></svg>)
}
