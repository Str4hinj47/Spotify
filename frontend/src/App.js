import React, { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

const cars = [
  {
    name: "BOLT BUGGY",
    className: "SPEEDSTER",
    color: "#b8f35a",
    accent: "#ffcf52",
    shadow: "#6b8e35",
    topSpeed: 92,
    handling: 78,
    acceleration: 88,
    quote: "Small car. Big thunder.",
  },
  {
    name: "SAKURA SLICER",
    className: "DRIFTER",
    color: "#ff806f",
    accent: "#ffd052",
    shadow: "#a64b50",
    topSpeed: 84,
    handling: 96,
    acceleration: 72,
    quote: "Cuts corners like butter.",
  },
  {
    name: "MOON ROCKET",
    className: "ALL-ROUNDER",
    color: "#6ee7e0",
    accent: "#7d69f6",
    shadow: "#367d8b",
    topSpeed: 88,
    handling: 85,
    acceleration: 91,
    quote: "Made for moon-shot moves.",
  },
];

const rivals = [
  { name: "Pip Piston", tag: "PIP", color: "#ff8d77", score: "01:42.08", place: "01" },
  { name: "Mia Mongoose", tag: "MM", color: "#72dfd9", score: "01:44.39", place: "02" },
  { name: "You", tag: "YOU", color: "#b8f35a", score: "01:46.12", place: "03", player: true },
  { name: "Rex Rocket", tag: "RR", color: "#8e7bff", score: "01:48.76", place: "04" },
];

const Icon = ({ name, size = 18, stroke = 1.8, className = "" }) => {
  const paths = {
    arrow: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    flag: <><path d="M5 21V4" /><path d="M5 4c5-4 9 4 14 0v10c-5 4-9-4-14 0" /></>,
    gauge: <><path d="M4 17a8 8 0 1 1 16 0" /><path d="m12 13 3-4" /><path d="M7 17h.01M12 17h.01M17 17h.01" /></>,
    trophy: <><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4" /></>,
    bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" fill="currentColor" stroke="none" />,
    play: <path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none" />,
    pause: <><path d="M8 5v14" /><path d="M16 5v14" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 1.7-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2.4v-.2a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.7-1.7.06-.06A1.7 1.7 0 0 0 8.46 15a1.7 1.7 0 0 0-1.56-1.03H6.7v-2.4h.2A1.7 1.7 0 0 0 8.46 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.7-1.7.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 12.73 5.2V5h2.4v.2a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.7 1.7-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.2v2.4h-.2A1.7 1.7 0 0 0 19.4 15Z" /></>,
    volume: <><path d="M4 10v4h4l5 4V6l-5 4H4Z" /><path d="M17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /></>,
    sun: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></>,
    mountain: <><path d="m3 19 6-8 4 5 2-3 6 6" /><path d="m11 9 1.5-2L14 9" /></>,
    moon: <path d="M20.4 14.6A8.5 8.5 0 0 1 9.4 3.6 8.5 8.5 0 1 0 20.4 14.6Z" />,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  };

  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.arrow}
    </svg>
  );
};

const BrandMark = () => (
  <div className="brand-mark" aria-hidden="true">
    <span className="brand-wing brand-wing-left" />
    <span className="brand-bolt"><Icon name="bolt" size={22} /></span>
    <span className="brand-wing brand-wing-right" />
  </div>
);

const Avatar = ({ initials, color, small = false }) => (
  <span className={`avatar ${small ? "avatar-small" : ""}`} style={{ "--avatar-color": color }}>
    {initials}
  </span>
);

const CarArt = ({ car, className = "", compact = false, animate = false }) => (
  <svg
    className={`car-art ${compact ? "car-art-compact" : ""} ${animate ? "car-art-bob" : ""} ${className}`}
    viewBox="0 0 300 170"
    role="img"
    aria-label={`${car.name} cartoon racing car`}
  >
    <ellipse cx="150" cy="143" rx="102" ry="13" fill="rgba(7, 7, 24, .25)" />
    <path d="M53 113c8-27 28-43 58-48l19-25h43c19 0 33 12 44 31l30 13c9 4 16 13 17 23l-2 17H42l-1-7c0-2 5-4 12-4Z" fill={car.shadow} />
    <path d="M50 105c9-23 29-36 59-40l22-25h37c17 0 30 11 41 28l33 13c7 3 12 9 14 17l-1 12H49c-3 0-4-2-3-5Z" fill={car.color} stroke="#15152e" strokeWidth="7" strokeLinejoin="round" />
    <path d="m126 42-17 25h88c-9-15-20-25-35-25h-36Z" fill="#2b2852" stroke="#15152e" strokeWidth="6" strokeLinejoin="round" />
    <path d="M126 48 116 64h34V48h-24ZM157 48v16h35c-8-10-17-16-28-16h-7Z" fill="#93e5ed" opacity=".92" />
    <path d="M100 79c25 8 61 8 91 0" stroke={car.accent} strokeWidth="7" strokeLinecap="round" />
    <path d="M69 103h25" stroke="#fff8dc" strokeWidth="7" strokeLinecap="round" />
    <circle cx="89" cy="122" r="21" fill="#17162f" stroke="#f2c75e" strokeWidth="6" />
    <circle cx="89" cy="122" r="8" fill="#74749b" />
    <circle cx="211" cy="122" r="21" fill="#17162f" stroke="#f2c75e" strokeWidth="6" />
    <circle cx="211" cy="122" r="8" fill="#74749b" />
    <rect x="229" y="91" width="13" height="9" rx="4.5" fill="#ffe3aa" />
    <path d="M246 110c10 0 16 4 18 10" stroke="#ff776d" strokeWidth="7" strokeLinecap="round" />
    <circle cx="71" cy="92" r="7" fill={car.accent} stroke="#15152e" strokeWidth="4" />
    <path d="M132 28h24" stroke="#fff8dc" strokeWidth="5" strokeLinecap="round" />
    <path d="M143 24v-8" stroke="#fff8dc" strokeWidth="5" strokeLinecap="round" />
    <circle cx="143" cy="13" r="5" fill={car.accent} stroke="#15152e" strokeWidth="3" />
    <path d="M111 104c7 4 14 4 21 0" stroke="#191735" strokeWidth="4" strokeLinecap="round" />
    <path d="M115 105c4 7 9 9 15 0" stroke="#191735" strokeWidth="3" strokeLinecap="round" fill="none" />
  </svg>
);

const TrackLandscape = ({ car, isRacing, lane, progress, surface, isDrifting, driftAngle, driftScore }) => (
  <div className={`track-landscape tokyo-track ${isRacing ? "track-landscape-racing" : ""}`}>
    <svg className="track-background" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-label="Tokyo Night Circuit race track preview" role="img">
      <defs>
        <linearGradient id="tokyoSkyGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#10152f" />
          <stop offset=".55" stopColor="#25204e" />
          <stop offset="1" stopColor="#8d356d" />
        </linearGradient>
        <linearGradient id="cityGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#242958" />
          <stop offset="1" stopColor="#151834" />
        </linearGradient>
        <radialGradient id="moonGlow">
          <stop offset="0" stopColor="#ffe6c3" stopOpacity=".95" />
          <stop offset=".45" stopColor="#ff9fc1" stopOpacity=".28" />
          <stop offset="1" stopColor="#ff9fc1" stopOpacity="0" />
        </radialGradient>
        <pattern id="tokyoRoadDots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.2" fill="#b9c7ff" opacity=".1" />
          <circle cx="12" cy="11" r="1" fill="#fff" opacity=".07" />
        </pattern>
        <filter id="neonBlur"><feGaussianBlur stdDeviation="7" /></filter>
      </defs>
      <rect width="1000" height="520" fill="url(#tokyoSkyGradient)" />
      <circle cx="790" cy="105" r="135" fill="url(#moonGlow)" />
      <circle cx="790" cy="105" r="40" fill="#ffe1c4" opacity=".92" />
      <circle cx="779" cy="95" r="7" fill="#f3c0b4" opacity=".5" />
      <circle cx="804" cy="116" r="11" fill="#f3c0b4" opacity=".4" />
      <g fill="#10142d">
        <path d="M0 224V163h42v61h25v-92h47v92h20V131h56v93h20v-51h53v51h23v-77h45v77h18v-112h60v112h22v-66h46v66h22v-97h63v97h28v-76h47v76h20v-51h48v51h21v-119h55v119h30v-85h53v85h29v-59h59v59h25v-92h42v92H0Z" opacity=".72" />
        <path d="M0 275V222h45v53h16v-78h36v78h18v-41h48v41h17v-92h41v92h25v-53h37v53h24v-78h59v78h20v-50h41v50h17v-102h47v102h20v-63h53v63h23v-89h40v89h18v-54h54v54h22v-77h50v77h18v-96h42v96h28v-57h47v57h20v-82h39v82h25v-61h47v61h21v-43h41v43H0Z" fill="url(#cityGlow)" />
      </g>
      <g fill="#69e9ea" opacity=".7">
        <rect x="30" y="177" width="5" height="22" /><rect x="74" y="143" width="6" height="32" /><rect x="143" y="153" width="5" height="23" /><rect x="206" y="192" width="6" height="26" /><rect x="284" y="146" width="5" height="35" /><rect x="368" y="116" width="6" height="37" /><rect x="455" y="147" width="5" height="29" /><rect x="542" y="167" width="6" height="26" /><rect x="624" y="140" width="5" height="31" /><rect x="693" y="188" width="6" height="24" /><rect x="849" y="146" width="5" height="31" /><rect x="927" y="184" width="6" height="22" />
      </g>
      <g fill="#ff5f9a" opacity=".72">
        <rect x="53" y="205" width="5" height="12" /><rect x="159" y="185" width="6" height="18" /><rect x="235" y="205" width="5" height="13" /><rect x="327" y="175" width="6" height="19" /><rect x="419" y="190" width="5" height="15" /><rect x="506" y="198" width="6" height="17" /><rect x="596" y="178" width="5" height="18" /><rect x="735" y="202" width="6" height="14" /><rect x="889" y="174" width="5" height="17" />
      </g>
      <rect y="268" width="1000" height="252" fill="#10142e" />
      <path d="M0 316c180-27 278 19 427-6 182-30 313-12 573 17v193H0Z" fill="#171a39" />
      <g opacity=".8">
        <path d="M133 275v-44h5v44" stroke="#e94e88" strokeWidth="2" /><path d="M106 239h58" stroke="#e94e88" strokeWidth="3" /><path d="M111 240v21M126 240v21M141 240v21M156 240v21" stroke="#e94e88" strokeWidth="2" />
        <path d="M828 282v-58h6v58" stroke="#55e6eb" strokeWidth="2" /><path d="M796 225h70" stroke="#55e6eb" strokeWidth="3" /><path d="M801 226v26M817 226v26M833 226v26M849 226v26" stroke="#55e6eb" strokeWidth="2" />
      </g>
      <g transform="translate(57 283)">
        <rect width="93" height="42" rx="4" fill="#222754" stroke="#ff5f9a" strokeWidth="2" /><text x="46" y="17" fill="#ffcf67" textAnchor="middle" fontSize="10" fontFamily="Arial, sans-serif" fontWeight="700">TOKYO</text><text x="46" y="31" fill="#75f0e9" textAnchor="middle" fontSize="8" fontFamily="Arial, sans-serif">NEON RUN</text>
      </g>
      <g transform="translate(804 286)">
        <rect width="98" height="42" rx="4" fill="#242044" stroke="#68e7e3" strokeWidth="2" /><text x="49" y="17" fill="#ff6b9e" textAnchor="middle" fontSize="9" fontFamily="Arial, sans-serif" fontWeight="700">MIDNIGHT</text><text x="49" y="31" fill="#ffe08b" textAnchor="middle" fontSize="8" fontFamily="Arial, sans-serif">DRIVE</text>
      </g>
      <path d="M-25 433C93 381 135 302 253 306c133 5 126 136 268 128 110-6 106-170 221-190 88-15 118 60 274-58" fill="none" stroke="#55e6eb" strokeWidth="58" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
      <path d="M-25 433C93 381 135 302 253 306c133 5 126 136 268 128 110-6 106-170 221-190 88-15 118 60 274-58" fill="none" stroke="#242349" strokeWidth="47" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-25 433C93 381 135 302 253 306c133 5 126 136 268 128 110-6 106-170 221-190 88-15 118 60 274-58" fill="none" stroke="url(#tokyoRoadDots)" strokeWidth="42" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-25 433C93 381 135 302 253 306c133 5 126 136 268 128 110-6 106-170 221-190 88-15 118 60 274-58" fill="none" stroke="#ff5f9a" strokeWidth="2" strokeDasharray="13 17" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
      <path d="M245 306C300 312 341 355 385 388C428 419 473 438 521 434" fill="none" stroke="#d28a5d" strokeWidth="43" strokeLinecap="round" strokeLinejoin="round" opacity=".98" />
      <path d="M245 306C300 312 341 355 385 388C428 419 473 438 521 434" fill="none" stroke="#b76b50" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M245 306C300 312 341 355 385 388C428 419 473 438 521 434" fill="none" stroke="#f3b16b" strokeWidth="2" strokeDasharray="2 11" strokeLinecap="round" opacity=".9" />
      <g transform="translate(362 356) rotate(19)">
        <rect width="70" height="18" rx="3" fill="#3a2544" stroke="#f3b16b" strokeWidth="1.5" /><text x="35" y="12" fill="#f3b16b" textAnchor="middle" fontSize="7" fontFamily="Arial, sans-serif" fontWeight="700">DIRT SECTOR</text>
      </g>
      <g transform="translate(108 349) rotate(-22)">
        <rect x="-18" y="-12" width="8" height="24" rx="2" fill="#f7f6ee" /><rect x="-8" y="-12" width="8" height="24" rx="2" fill="#ff5f9a" />
        <rect x="2" y="-12" width="8" height="24" rx="2" fill="#f7f6ee" /><rect x="12" y="-12" width="8" height="24" rx="2" fill="#ff5f9a" />
      </g>
      <g transform="translate(660 287) rotate(-54)">
        <rect x="-21" y="-2" width="42" height="4" fill="#ffe076" /><path d="M-21 0v-31M21 0v-31" stroke="#ffe076" strokeWidth="3" /><path d="M-18-30h14v8h-14ZM0-30h14v8H0Z" fill="#fff5df" />
      </g>
      <g fill="#ff5f9a" opacity=".52" filter="url(#neonBlur)"><circle cx="207" cy="293" r="13" /><circle cx="745" cy="299" r="16" /><circle cx="907" cy="340" r="12" /></g>
      <g fill="#252957"><path d="M83 431h8l-4-31-4 31Z" /><circle cx="87" cy="398" r="16" /><path d="M884 401h8l-4-33-4 33Z" /><circle cx="888" cy="365" r="17" /><path d="M518 423h8l-4-30-4 30Z" /><circle cx="522" cy="389" r="14" /></g>
      <g fill="#c6faff" opacity=".72"><circle cx="80" cy="80" r="2" /><circle cx="127" cy="136" r="2" /><circle cx="250" cy="64" r="1.5" /><circle cx="344" cy="105" r="2" /><circle cx="899" cy="53" r="2" /></g>
    </svg>
    <div className="track-chip track-chip-lap"><span className="chip-dot" /> LAP 1 / 3</div>
    <div className="track-chip track-chip-position">P<span>2</span></div>
    <div className="finish-flag" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /></div>
    <div className={`track-car-token ${isDrifting ? "track-car-drifting" : ""}`} style={{ left: `calc(39% + ${lane * 28}px)`, "--drift-angle": `${driftAngle}deg` }}>
      <CarArt car={car} compact animate={false} />
      {isRacing && <span className="speed-streak streak-one" />}
      {isRacing && <span className="speed-streak streak-two" />}
    </div>
    <div className="track-location"><Icon name="flag" size={14} /> TOKYO NIGHT CIRCUIT <span>•</span> 2.4 KM</div>
    {surface === "dirt" && <div className="surface-chip"><span className="surface-icon">✦</span> DIRT SECTOR <small>LOW GRIP</small></div>}
    {isDrifting && <div className="drift-callout">DRIFT <strong>+{Math.floor(driftScore)}</strong></div>}
    {isRacing && <div className="race-start-callout">GO! <Icon name="bolt" size={15} /></div>}
    <div className="track-progress"><span style={{ width: `${Math.min(progress, 100)}%` }} /></div>
  </div>
);

const MiniTrack = () => (
  <svg className="mini-track" viewBox="0 0 240 115" role="img" aria-label="Tokyo Night Circuit map">
    <path d="M35 79c-17-20-4-45 26-49 25-3 32 17 59 18 29 2 29-29 55-31 21-1 38 12 30 29-11 23-47 17-63 33-17 17-38 22-62 15-18-5-35-2-45-15Z" fill="none" stroke="#393762" strokeWidth="19" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M35 79c-17-20-4-45 26-49 25-3 32 17 59 18 29 2 29-29 55-31 21-1 38 12 30 29-11 23-47 17-63 33-17 17-38 22-62 15-18-5-35-2-45-15Z" fill="none" stroke="#ff5f9a" strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round" />
    <circle cx="35" cy="79" r="5" fill="#6ee7e0" stroke="#191832" strokeWidth="3" />
    <circle cx="205" cy="46" r="5" fill="#ff806f" stroke="#191832" strokeWidth="3" />
  </svg>
);

const NavButton = ({ active, icon, label, onClick, badge }) => (
  <button className={`nav-item ${active ? "nav-item-active" : ""}`} onClick={onClick}>
    <span className="nav-icon"><Icon name={icon} size={18} /></span>
    <span>{label}</span>
    {badge && <span className="nav-badge">{badge}</span>}
  </button>
);

const Header = ({ activePage, setActivePage, credits }) => (
  <header className="topbar">
    <div className="topbar-inner">
      <button className="brand" onClick={() => setActivePage("race")} aria-label="Kartoon Karts home">
        <BrandMark />
        <span className="brand-type"><strong>KARTOON</strong><em>KARTS</em></span>
      </button>
      <nav className="primary-nav" aria-label="Main navigation">
        <NavButton active={activePage === "race"} icon="flag" label="Race" onClick={() => setActivePage("race")} />
        <NavButton active={activePage === "garage"} icon="grid" label="Garage" onClick={() => setActivePage("garage")} />
        <NavButton active={activePage === "league"} icon="trophy" label="League" onClick={() => setActivePage("league")} badge="3" />
      </nav>
      <div className="player-tools">
        <div className="credit-pill"><span className="coin-symbol">✦</span><span>{credits.toLocaleString()}</span></div>
        <button className="icon-button" aria-label="Settings"><Icon name="settings" size={18} /></button>
        <button className="profile-button" aria-label="Open profile"><Avatar initials="NV" color="#8c73ff" /><span className="profile-name">NOVA</span><Icon name="chevron" size={14} /></button>
      </div>
    </div>
  </header>
);

const RaceSidebar = ({ isRacing, startRace, surface, isDrifting, driftScore, setToast }) => (
  <aside className="race-sidebar">
    <section className="side-card next-event-card">
      <div className="card-kicker"><span className="live-indicator"><i /> NEXT EVENT</span><span className="event-number">CUP 03</span></div>
      <h2>Tokyo Night<br /><span>Circuit</span></h2>
      <div className="event-meta"><span><Icon name="moon" size={15} /> Neon drizzle</span><span><Icon name="mountain" size={15} /> 2.4 KM</span></div>
      <MiniTrack />
      <div className="event-time"><span>RACE STARTS IN</span><strong>02:14</strong></div>
      <button className={`start-race-button ${isRacing ? "is-racing" : ""}`} onClick={startRace}>
        <span>{isRacing ? "RACING NOW" : "START RACE"}</span>
        <span className="button-arrow"><Icon name={isRacing ? "pause" : "arrow"} size={17} /></span>
      </button>
      <div className="control-hint"><span><kbd>←</kbd><kbd>→</kbd> steer</span><span><kbd>R</kbd> replay</span></div>
    </section>

    <section className="side-card drift-card">
      <div className="drift-card-top"><div><span className="card-label">SURFACE REPORT</span><strong>{surface === "dirt" ? "Dirt sector active" : "Tarmac ready"}</strong></div><span className={`surface-dot ${surface === "dirt" ? "surface-dot-dirt" : ""}`} /></div>
      <div className="drift-score-row"><div><span>DRIFT CHAIN</span><strong>{Math.floor(driftScore).toString().padStart(3, "0")}</strong></div><div className={`grip-badge ${surface === "dirt" ? "grip-badge-dirt" : ""}`}>{surface === "dirt" ? "LOOSE" : "GRIP"}</div></div>
      <div className="drift-meter"><span style={{ width: `${Math.min(100, (driftScore % 100))}%` }} /></div>
      <div className="drift-hint"><kbd>SPACE</kbd> handbrake + steer <span>{isDrifting ? "SLIDING" : "READY"}</span></div>
    </section>

    <section className="side-card rivals-card">
      <div className="section-heading"><div><span className="card-label">ON THE GRID</span><h3>Rivals online</h3></div><span className="online-count"><i /> 12</span></div>
      <div className="rival-list">
        {rivals.slice(0, 3).map((rival) => (
          <div className={`rival-row ${rival.player ? "rival-player" : ""}`} key={rival.name}>
            <Avatar initials={rival.tag} color={rival.color} small />
            <div className="rival-name"><strong>{rival.name}</strong><span>{rival.player ? "that’s you" : "ready to race"}</span></div>
            <span className="rival-time">{rival.score}</span>
          </div>
        ))}
      </div>
      <button className="text-button" onClick={() => setToast("Spectator mode is warming up")}>VIEW ALL RIVALS <Icon name="arrow" size={14} /></button>
    </section>
  </aside>
);

const RacePage = ({ car, isRacing, startRace, lane, progress, surface, isDrifting, driftAngle, driftScore, setToast }) => (
  <main className="content-grid">
    <section className="stage-card panel-card">
      <div className="stage-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> QUICK RACE <span className="eyebrow-slash">/</span> 01</div>
          <h1>Tokyo Twilight <span>Cup</span></h1>
          <p>Pick a line. Hit the gas. Own the night.</p>
        </div>
        <div className="stage-actions"><span className="weather-pill"><Icon name="moon" size={14} /> 18° <span>NIGHT RUN</span></span><button className="small-icon-button" onClick={() => setToast("Track details pinned to your dashboard")} aria-label="Pin track"><Icon name="flag" size={16} /></button></div>
      </div>
      <TrackLandscape car={car} isRacing={isRacing} lane={lane} progress={progress} surface={surface} isDrifting={isDrifting} driftAngle={driftAngle} driftScore={driftScore} />
      <div className="stage-bottom">
        <div className="driver-card"><div className="driver-car-wrap"><CarArt car={car} compact animate={isRacing} /></div><div className="driver-copy"><span className="card-label">YOUR RIDE</span><strong>{car.name}</strong><span>{car.quote}</span></div><span className="selected-tag">SELECTED</span></div>
        <div className="quick-stats"><div><span>TOP SPEED</span><strong>{car.topSpeed}<small> MPH</small></strong></div><div><span>HANDLING</span><strong>{car.handling}<small>%</small></strong></div><div><span>BEST LAP</span><strong>01:46<small>.12</small></strong></div></div>
      </div>
    </section>
    <RaceSidebar isRacing={isRacing} startRace={startRace} surface={surface} isDrifting={isDrifting} driftScore={driftScore} setToast={setToast} />
  </main>
);

const StatBar = ({ label, value, tone = "lime" }) => (
  <div className="stat-bar-row"><div><span>{label}</span><strong>{value}</strong></div><div className={`stat-bar stat-bar-${tone}`}><span style={{ width: `${value}%` }} /></div></div>
);

const GaragePage = ({ selectedIndex, setSelectedIndex, setToast }) => {
  const car = cars[selectedIndex];
  return (
    <main className="page-wrap">
      <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> VEHICLE BAY</div><h1>Choose your <span>ride</span></h1><p>Every kart has a little chaos under the hood.</p></div><div className="garage-badge"><Icon name="bolt" size={16} /> 3 KARTS UNLOCKED</div></div>
      <div className="garage-layout">
        <section className="garage-showcase panel-card">
          <div className="showcase-glow" /><div className="showcase-top"><span className="card-label">CURRENTLY EQUIPPED</span><button className="small-icon-button" onClick={() => setToast("Paint shop opens after the next cup")} aria-label="Customize car"><Icon name="settings" size={16} /></button></div>
          <div className="showcase-art"><span className="showcase-speed-lines" /><CarArt car={car} animate /></div>
          <div className="showcase-info"><div><span className="car-class">{car.className}</span><h2>{car.name}</h2><p>“{car.quote}”</p></div><div className="rating-bubble"><strong>{Math.round((car.topSpeed + car.handling + car.acceleration) / 3)}</strong><span>RATING</span></div></div>
          <div className="showcase-stats"><StatBar label="TOP SPEED" value={car.topSpeed} tone="lime" /><StatBar label="HANDLING" value={car.handling} tone="coral" /><StatBar label="ACCELERATION" value={car.acceleration} tone="cyan" /></div>
          <button className="equip-button" onClick={() => setToast(`${car.name} is ready for the grid!`)}>EQUIPPED <Icon name="bolt" size={15} /></button>
        </section>
        <section className="garage-list"><div className="list-heading"><span className="card-label">YOUR COLLECTION</span><span>{cars.length} / 6</span></div>{cars.map((item, index) => <button className={`garage-car-card ${index === selectedIndex ? "garage-car-selected" : ""}`} key={item.name} onClick={() => setSelectedIndex(index)}><div className="garage-car-art"><CarArt car={item} compact /></div><div className="garage-car-copy"><span>{item.className}</span><strong>{item.name}</strong><div className="tiny-bars"><i style={{ width: `${item.topSpeed}%`, background: "var(--lime)" }} /><i style={{ width: `${item.handling}%`, background: "var(--coral)" }} /><i style={{ width: `${item.acceleration}%`, background: "var(--cyan)" }} /></div></div><span className="garage-check">{index === selectedIndex ? <Icon name="bolt" size={15} /> : <Icon name="arrow" size={15} />}</span></button>)}<button className="locked-car"><span className="locked-icon"><Icon name="lock" size={15} /></span><span><strong>???</strong><small>Win CUP 04 to unlock</small></span></button></section>
      </div>
    </main>
  );
};

const LeaguePage = ({ setToast }) => (
  <main className="page-wrap league-page">
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> WEEKLY LEAGUE <span className="eyebrow-slash">/</span> 08</div><h1>Climb the <span>ladder</span></h1><p>Three races. One shiny trophy. Zero boring corners.</p></div><div className="league-season"><span>SEASON 08</span><strong>4d 12h</strong><small>remaining</small></div></div>
    <div className="league-grid">
      <section className="leaderboard-card panel-card"><div className="leaderboard-head"><div><span className="card-label">GLOBAL STANDINGS</span><h2>Turbo League</h2></div><span className="division-pill"><span className="division-dot" /> GOLD DIVISION</span></div><div className="leaderboard-tabs"><button className="active">THIS WEEK</button><button>FRIENDS <span>4</span></button><button>ALL TIME</button></div><div className="leaderboard-table"><div className="table-header"><span>POS</span><span>DRIVER</span><span>BEST LAP</span><span>PTS</span></div>{rivals.map((rival, index) => <div className={`table-row ${rival.player ? "table-row-you" : ""}`} key={rival.name}><span className="table-position">{rival.place}<small>{index === 0 ? "▲" : index === 3 ? "▼" : "—"}</small></span><span className="table-driver"><Avatar initials={rival.tag} color={rival.color} small /><strong>{rival.name}</strong>{rival.player && <em>YOU</em>}</span><span>{rival.score}</span><strong className="table-points">{[1280, 1175, 1040, 990][index]}</strong></div>)}<div className="table-row faded-row"><span className="table-position">05</span><span className="table-driver"><Avatar initials="ZZ" color="#5b5880" small /><strong>Zig Zag</strong></span><span>01:50.41</span><strong className="table-points">912</strong></div></div><button className="full-leaderboard-button" onClick={() => setToast("You are already in the fast lane")}>OPEN FULL LEADERBOARD <Icon name="arrow" size={15} /></button></section>
      <aside className="league-side"><section className="trophy-card"><div className="trophy-sparkle">✦</div><span className="card-label">YOUR REWARD</span><h2>Gold<br /><span>Rush</span></h2><div className="trophy-art"><div className="trophy-cup"><span>★</span></div></div><div className="reward-row"><span>FINISH TOP 3</span><strong>+450 ✦</strong></div></section><section className="league-mission"><span className="card-label">NEXT MISSION</span><h3>Drift like you mean it</h3><p>Score 3 perfect drifts in a single race.</p><div className="mission-progress"><span style={{ width: "66%" }} /></div><div><span>2 / 3 drifts</span><strong>+120 XP</strong></div></section></aside>
    </div>
  </main>
);

const App = () => {
  const [activePage, setActivePage] = useState("race");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isRacing, setIsRacing] = useState(false);
  const [progress, setProgress] = useState(38);
  const [lane, setLane] = useState(0);
  const [isDrifting, setIsDrifting] = useState(false);
  const [driftAngle, setDriftAngle] = useState(0);
  const [driftScore, setDriftScore] = useState(0);
  const [credits, setCredits] = useState(2480);
  const inputRef = useRef({ left: false, right: false, drift: false });
  const physicsRef = useRef({ offset: 0, velocity: 0 });
  const [toast, setToast] = useState("");

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => setToast(""), 2600);
  }, []);

  const startRace = useCallback(() => {
    if (isRacing) {
      setIsRacing(false);
      setIsDrifting(false);
      setDriftAngle(0);
      showToast("Pit stop! Catch your breath, racer.");
      return;
    }
    setActivePage("race");
    setProgress(0);
    setLane(0);
    setDriftScore(0);
    physicsRef.current = { offset: 0, velocity: 0 };
    setIsDrifting(false);
    setDriftAngle(0);
    setIsRacing(true);
    showToast("GO! Find your racing line.");
  }, [isRacing, showToast]);


  useEffect(() => {
    if (!isRacing) return undefined;
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 100) {
          setIsRacing(false);
          setCredits((currentCredits) => currentCredits + 120);
          showToast("PHOTO FINISH! +120 credits.");
          return 100;
        }
        return current + 0.55;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [isRacing, showToast]);

  const surface = isRacing && progress >= 42 && progress < 72 ? "dirt" : "road";

  useEffect(() => {
    if (!isRacing) return undefined;
    let frame;
    const tick = () => {
      const { left, right, drift } = inputRef.current;
      const direction = (right ? 1 : 0) - (left ? 1 : 0);
      const physics = physicsRef.current;
      const onDirt = surface === "dirt";
      const acceleration = onDirt ? 0.045 : 0.075;
      const drag = onDirt ? 0.985 : 0.86;
      if (direction !== 0) physics.velocity += direction * acceleration;
      physics.velocity *= drag;
      physics.offset = Math.max(-1.25, Math.min(1.25, physics.offset + physics.velocity));
      if (Math.abs(physics.offset) >= 1.25) physics.velocity *= -0.35;
      setLane(physics.offset);
      const sliding = drift && direction !== 0 && Math.abs(physics.velocity) > 0.012;
      setIsDrifting(sliding);
      setDriftAngle(sliding ? Math.max(-22, Math.min(22, physics.velocity * 240)) : physics.velocity * 40);
      if (sliding) setDriftScore((score) => score + 0.34);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [isRacing, surface]);

  useEffect(() => {
    if (!isRacing) {
      setIsDrifting(false);
      setDriftAngle(0);
    }
  }, [isRacing]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if (event.key === "ArrowLeft" || key === "a") inputRef.current.left = true;
      if (event.key === "ArrowRight" || key === "d") inputRef.current.right = true;
      if (event.code === "Space" || key === "shift") {
        event.preventDefault();
        inputRef.current.drift = true;
      }
      if (key === "r") startRace();
    };
    const onKeyUp = (event) => {
      const key = event.key.toLowerCase();
      if (event.key === "ArrowLeft" || key === "a") inputRef.current.left = false;
      if (event.key === "ArrowRight" || key === "d") inputRef.current.right = false;
      if (event.code === "Space" || key === "shift") inputRef.current.drift = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [startRace]);

  const changePage = (page) => {
    setActivePage(page);
    if (page !== "race" && isRacing) {
      setIsRacing(false);
      showToast("Race paused in the pits.");
    }
  };

  const currentCar = cars[selectedIndex];

  return (
    <div className="app-shell">
      <Header activePage={activePage} setActivePage={changePage} credits={credits} />
      <div className="app-body">
        {activePage === "race" && <RacePage car={currentCar} isRacing={isRacing} startRace={startRace} lane={lane} progress={progress} surface={surface} isDrifting={isDrifting} driftAngle={driftAngle} driftScore={driftScore} setToast={showToast} />}
        {activePage === "garage" && <GaragePage selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} setToast={showToast} />}
        {activePage === "league" && <LeaguePage setToast={showToast} />}
      </div>
      <footer className="app-footer"><span><i className="footer-pulse" /> SERVERS ONLINE</span><span>© 2025 KARTOON KARTS</span><span>v1.08.4 <b>•</b> Made for speed</span></footer>
      {toast && <div className="toast"><span className="toast-icon"><Icon name="bolt" size={15} /></span>{toast}</div>}
    </div>
  );
};

export default App;
