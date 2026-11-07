import { RANKS } from './ranked.mjs';

// Original vector insignia: wheel, road and automotive motifs, not borrowed game art.
let serial = 0;
const icons = [
  '<circle cx="100" cy="93" r="15" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="100" cy="93" r="4" fill="currentColor"/>',
  '<path d="M89 110 95 75h10l6 35h-8l-1-8h-4l-1 8zm10-25-1 10h4l-1-10z" fill="currentColor"/>',
  '<path d="M88 76h24v12l-5 4v14h-14V92l-5-4zm6 5v5h12v-5zm2 17v5h8v-5z" fill="currentColor"/>',
  '<path d="M79 105 100 75l21 30h-12l-9-13-9 13z" fill="currentColor"/><path d="M89 110h22" stroke="currentColor" stroke-width="5"/>',
  '<path d="M101 73 89 93h9l-5 19 19-25h-10l6-14z" fill="currentColor"/>',
  '<path d="M78 97c7-18 22-25 42-18l-9 7 9 4-18 18-3-9-9 8zm12-8 8 2 5-7z" fill="currentColor"/>',
  '<path d="M77 82 88 88l12-14 12 14 11-6-5 22H82zm12 27h22v5H89z" fill="currentColor"/>',
];
export function rankBadge(index: number): string {
  const i = Math.max(0, Math.min(RANKS.length-1, index)), rank = RANKS[i];
  const id = `rank-badge-${i}-${serial++}`;
  const wings = i >= 2 ? `<path d="M56 67 15 ${i>=4?41:55} 30 91 12 102 61 111M144 67l41 ${i>=4?-26:-12}-15 36 18 11-49 9" fill="${rank.glow}" stroke="#11141b" stroke-width="7" stroke-linejoin="round"/><path d="M22 62 53 78M178 62l-31 16" stroke="${rank.color}" stroke-width="5" stroke-linecap="round"/>` : '';
  const crown = i >= 5 ? `<path d="M70 39 59 20 82 27 100 11 118 27 141 20 130 39" fill="${rank.color}" stroke="#11141b" stroke-width="6" stroke-linejoin="round"/>` : '';
  const flames = i >= 6 ? `<path d="M44 76 29 55 48 57 49 37 66 53M156 76l15-21-19 2-1-20-17 16" fill="#ff7951" stroke="#11141b" stroke-width="5" stroke-linejoin="round"/>` : '';
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="${rank.color}"/><stop offset="1" stop-color="${rank.glow}"/></linearGradient></defs>
    ${flames}${wings}${crown}
    <path d="M100 27 153 47 158 108 143 143 100 172 57 143 42 108 47 47Z" fill="#10131b" stroke="#090a10" stroke-width="10" stroke-linejoin="round"/>
    <path d="M100 32 150 51 153 107 139 139 100 166 61 139 47 107 50 51Z" fill="url(#${id})" stroke="${rank.color}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M100 43 138 57 141 106 130 130 100 151 70 130 59 106 62 57Z" fill="#1a202b" stroke="#0c1016" stroke-width="5"/>
    <circle cx="100" cy="93" r="31" fill="#0c1118" stroke="${rank.color}" stroke-width="5"/>
    <circle cx="100" cy="93" r="25" fill="#283443" stroke="#53616a" stroke-width="2"/>
    <g style="color:${rank.color}">${icons[i]}</g>
    <path d="M65 137 79 143 100 152 121 143 135 137 129 155 100 176 71 155Z" fill="${rank.color}" stroke="#10131b" stroke-width="5" stroke-linejoin="round"/>
    <path d="M87 152h26" stroke="#20252d" stroke-width="5" stroke-linecap="round"/>
    ${i>=3?`<circle cx="69" cy="57" r="3" fill="#fff2cc"/><circle cx="131" cy="57" r="3" fill="#fff2cc"/>`:''}
  </svg>`;
}
