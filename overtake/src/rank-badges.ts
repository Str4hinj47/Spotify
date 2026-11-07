import { RANKS } from './ranked.mjs';

// Original, name-free vector marks. Each shield and its center are filled;
// only the canvas outside the insignia is transparent for use on any background.
// Curved, rounded silhouettes stay clean at both tiny UI and export sizes.
let serial = 0;
const icons = [
  // Rookie: a wheel / starting point.
  '<circle cx="100" cy="90" r="17" fill="none" stroke="#f5f7ef" stroke-width="8"/><circle cx="100" cy="90" r="5" fill="#f5f7ef"/>',
  // Street: a lane disappearing toward the horizon.
  '<path d="M82 110 91 71h18l9 39h-9l-5-30h-8l-5 30Z" fill="#f5f7ef"/><path d="M100 88v5m0 7v6" fill="none" stroke="#f5f7ef" stroke-width="4" stroke-linecap="round"/>',
  // Gearhead: a geometric hub.
  '<path d="M100 69 117 79v20l-17 10-17-10V79Z" fill="#f5f7ef"/><circle cx="100" cy="89" r="8" fill="#20312d"/>',
  // Apex: one clean mountain / racing line.
  '<path d="M77 105 100 72l23 33h-12l-11-17-11 17Z" fill="#f5f7ef"/><path d="M90 112h20" stroke="#f5f7ef" stroke-width="5" stroke-linecap="round"/>',
  // Turbo: a three-blade turbine around a solid hub.
  '<path d="M101 70c9 0 15 6 15 13l-12 4c1-7-1-12-3-17ZM119 94c-4 9-12 11-18 7l3-12c6 4 11 5 15 5ZM91 108c-9-4-11-12-7-18l12 3c-4 6-5 11-5 15Z" fill="#f5f7ef"/><circle cx="100" cy="89" r="5" fill="#f5f7ef"/>',
  // Overdrive: double forward chevrons.
  '<path d="m78 75 18 15-18 15v-11l6-4-6-4Zm23 0 18 15-18 15v-11l6-4-6-4Z" fill="#f5f7ef" stroke="#f5f7ef" stroke-width="2" stroke-linejoin="round"/>',
  // Legend: restrained crown, its few points intentional.
  '<path d="m76 78 14 7 10-14 10 14 14-7-5 25H81Z" fill="#f5f7ef" stroke="#f5f7ef" stroke-width="3" stroke-linejoin="round"/><path d="M85 111h30" stroke="#f5f7ef" stroke-width="5" stroke-linecap="round"/>',
];
export function rankBadge(index: number): string {
  const i = Math.max(0, Math.min(RANKS.length - 1, Math.floor(index))), rank = RANKS[i];
  const id = `rank-badge-${i}-${serial++}`;
  // Higher ranks grow outward, while retaining the same smooth shield language.
  const wings = i >= 2 ? `<path d="M61 63 Q42 56 25 ${i >= 4 ? 47 : 55} Q20 ${i >= 4 ? 44 : 52} 22 ${i >= 4 ? 53 : 60} L29 89 Q32 102 52 111 L65 115Z" fill="url(#${id})" stroke="#172128" stroke-width="5" stroke-linejoin="round"/>
    <path d="M139 63 Q158 56 175 ${i >= 4 ? 47 : 55} Q180 ${i >= 4 ? 44 : 52} 178 ${i >= 4 ? 53 : 60} L171 89 Q168 102 148 111 L135 115Z" fill="url(#${id})" stroke="#172128" stroke-width="5" stroke-linejoin="round"/>
    <path d="M31 62 50 72 M169 62 150 72" stroke="#f5f7ef" stroke-width="4" stroke-linecap="round"/>` : '';
  const caps = i >= 5 ? `<path d="M72 42 Q83 24 100 20 Q117 24 128 42 L120 48 Q111 34 100 32 Q89 34 80 48Z" fill="${rank.color}" stroke="#172128" stroke-width="5" stroke-linejoin="round"/>` : '';
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${rank.color}"/><stop offset="1" stop-color="${rank.glow}"/></linearGradient></defs>
    ${wings}${caps}
    <path d="M100 31 Q104 31 109 33 L146 47 Q151 49 151 55 L151 104 Q151 139 105 163 Q100 166 95 163 Q49 139 49 104 L49 55 Q49 49 54 47 L91 33 Q96 31 100 31Z" fill="url(#${id})" stroke="#172128" stroke-width="7" stroke-linejoin="round"/>
    <path d="M100 47 136 60v44 Q136 130 100 150 Q64 130 64 104 V60Z" fill="#202c34"/>
    <path d="M73 65 100 55 127 65" fill="none" stroke="${rank.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${icons[i]}
    <path d="M88 126h24" stroke="${rank.color}" stroke-width="4" stroke-linecap="round"/>
  </svg>`;
}
