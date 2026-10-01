import React, { useCallback, useEffect, useState } from "react";
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
    boost: 88,
    quote: "Small car. Big thunder.",
  },
  {
    name: "SUNSET SLICER",
    className: "DRIFTER",
    color: "#ff806f",
    accent: "#ffd052",
    shadow: "#a64b50",
    topSpeed: 84,
    handling: 96,
    boost: 72,
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
    boost: 91,
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

const TrackLandscape = ({ car, isRacing, lane, progress }) => (
  <div className={`track-landscape ${isRacing ? "track-landscape-racing" : ""}`}>
    <svg className="track-background" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-label="Sunset Circuit race track preview" role="img">
      <defs>
        <linearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#342d66" />
          <stop offset=".54" stopColor="#a35f82" />
          <stop offset="1" stopColor="#f3aa71" />
        </linearGradient>
        <linearGradient id="grassGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#92bd79" />
          <stop offset="1" stopColor="#4f805d" />
        </linearGradient>
        <radialGradient id="sunGlow">
          <stop offset="0" stopColor="#fff2b5" stopOpacity=".95" />
          <stop offset=".5" stopColor="#ffd35f" stopOpacity=".35" />
          <stop offset="1" stopColor="#ffd35f" stopOpacity="0" />
        </radialGradient>
        <pattern id="roadDots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.2" fill="#fff" opacity=".08" />
          <circle cx="12" cy="11" r="1" fill="#fff" opacity=".06" />
        </pattern>
        <filter id="softGlow"><feGaussianBlur stdDeviation="8" /></filter>
      </defs>
      <rect width="1000" height="520" fill="url(#skyGradient)" />
      <circle cx="774" cy="112" r="125" fill="url(#sunGlow)" />
      <circle cx="774" cy="112" r="38" fill="#ffe9a2" opacity=".9" />
      <path d="M0 220 120 148l92 81 104-113 129 101 109-78 138 100 108-78 100 70v145H0Z" fill="#554a78" opacity=".7" />
      <path d="M0 260 111 190l93 77 105-91 106 89 106-73 105 72 117-89 157 101v180H0Z" fill="#394a66" opacity=".55" />
      <rect y="300" width="1000" height="220" fill="url(#grassGradient)" />
      <path d="M0 340c180-35 260 30 418-10 150-38 273-28 582 11v179H0Z" fill="#638c62" opacity=".7" />
      <g opacity=".5" fill="#355d56">
        <path d="M68 289 84 254l16 35Z" /><path d="M87 289 102 247l17 42Z" /><path d="M924 311 942 260l19 51Z" />
        <path d="M942 314 961 273l18 41Z" /><path d="M270 342 284 301l17 41Z" /><path d="M295 342 312 295l17 47Z" />
      </g>
      <path d="M-25 433C93 381 135 302 253 306c133 5 126 136 268 128 110-6 106-170 221-190 88-15 118 60 274-58" fill="none" stroke="#f7cf5d" strokeWidth="58" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-25 433C93 381 135 302 253 306c133 5 126 136 268 128 110-6 106-170 221-190 88-15 118 60 274-58" fill="none" stroke="#302c50" strokeWidth="47" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-25 433C93 381 135 302 253 306c133 5 126 136 268 128 110-6 106-170 221-190 88-15 118 60 274-58" fill="none" stroke="url(#roadDots)" strokeWidth="42" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-25 433C93 381 135 302 253 306c133 5 126 136 268 128 110-6 106-170 221-190 88-15 118 60 274-58" fill="none" stroke="#a498a7" strokeWidth="2" strokeDasharray="14 15" strokeLinecap="round" strokeLinejoin="round" opacity=".6" />
      <g transform="translate(108 349) rotate(-22)">
        <rect x="-18" y="-12" width="8" height="24" rx="2" fill="#fff5d0" /><rect x="-8" y="-12" width="8" height="24" rx="2" fill="#ff776d" />
        <rect x="2" y="-12" width="8" height="24" rx="2" fill="#fff5d0" /><rect x="12" y="-12" width="8" height="24" rx="2" fill="#ff776d" />
      </g>
      <g transform="translate(660 287) rotate(-54)">
        <rect x="-21" y="-2" width="42" height="4" fill="#f6d15a" />
        <path d="M-21 0v-31M21 0v-31" stroke="#f6d15a" strokeWidth="3" />
        <path d="M-18-30h14v8h-14ZM0-30h14v8H0Z" fill="#fff4d7" />
      </g>
      <g fill="#355d56" opacity=".9">
        <path d="M83 431h8l-4-31-4 31Z" /><circle cx="87" cy="398" r="16" />
        <path d="M884 401h8l-4-33-4 33Z" /><circle cx="888" cy="365" r="17" />
        <path d="M518 423h8l-4-30-4 30Z" /><circle cx="522" cy="389" r="14" />
      </g>
      <g fill="#fff0be" opacity=".75">
        <circle cx="80" cy="80" r="2" /><circle cx="127" cy="136" r="2" /><circle cx="250" cy="64" r="1.5" /><circle cx="344" cy="105" r="2" /><circle cx="899" cy="53" r="2" />
      </g>
    </svg>
    <div className="track-chip track-chip-lap"><span className="chip-dot" /> LAP 1 / 3</div>
    <div className="track-chip track-chip-position">P<span>2</span></div>
    <div className="finish-flag" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /></div>
    <div className="track-car-token" style={{ left: `calc(39% + ${lane * 28}px)` }}>
      <CarArt car={car} compact animate={isRacing} />
      {isRacing && <span className="speed-streak streak-one" />}
      {isRacing && <span className="speed-streak streak-two" />}
    </div>
    <div className="track-location"><Icon name="flag" size={14} /> SUNSET CIRCUIT <span>•</span> 2.4 KM</div>
    {isRacing && <div className="race-start-callout">GO! <Icon name="bolt" size={15} /></div>}
    <div className="track-progress"><span style={{ width: `${Math.min(progress, 100)}%` }} /></div>
  </div>
);

const MiniTrack = () => (
  <svg className="mini-track" viewBox="0 0 240 115" role="img" aria-label="Sunset Circuit map">
    <path d="M35 79c-17-20-4-45 26-49 25-3 32 17 59 18 29 2 29-29 55-31 21-1 38 12 30 29-11 23-47 17-63 33-17 17-38 22-62 15-18-5-35-2-45-15Z" fill="none" stroke="#625889" strokeWidth="19" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M35 79c-17-20-4-45 26-49 25-3 32 17 59 18 29 2 29-29 55-31 21-1 38 12 30 29-11 23-47 17-63 33-17 17-38 22-62 15-18-5-35-2-45-15Z" fill="none" stroke="#f2cf67" strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round" />
    <circle cx="35" cy="79" r="5" fill="#b8f35a" stroke="#191832" strokeWidth="3" />
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

const RaceSidebar = ({ isRacing, startRace, triggerBoost, boost, selectedCar, setToast }) => (
  <aside className="race-sidebar">
    <section className="side-card next-event-card">
      <div className="card-kicker"><span className="live-indicator"><i /> NEXT EVENT</span><span className="event-number">CUP 03</span></div>
      <h2>Sunset<br /><span>Circuit</span></h2>
      <div className="event-meta"><span><Icon name="sun" size={15} /> Clear skies</span><span><Icon name="mountain" size={15} /> 2.4 KM</span></div>
      <MiniTrack />
      <div className="event-time"><span>RACE STARTS IN</span><strong>02:14</strong></div>
      <button className={`start-race-button ${isRacing ? "is-racing" : ""}`} onClick={startRace}>
        <span>{isRacing ? "RACING NOW" : "START RACE"}</span>
        <span className="button-arrow"><Icon name={isRacing ? "pause" : "arrow"} size={17} /></span>
      </button>
      <div className="control-hint"><span><kbd>←</kbd><kbd>→</kbd> steer</span><span><kbd>SPACE</kbd> boost</span></div>
    </section>

    <section className="side-card boost-card">
      <div className="boost-header"><div><span className="card-label">NITRO METER</span><strong>Ready to rip</strong></div><span className="bolt-disc"><Icon name="bolt" size={16} /></span></div>
      <div className="meter meter-lime"><span style={{ width: `${boost}%` }} /></div>
      <div className="boost-footer"><span>{boost}% charged</span><button onClick={triggerBoost} disabled={!isRacing || boost < 15}><Icon name="bolt" size={13} /> BOOST</button></div>
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

const RacePage = ({ car, isRacing, startRace, triggerBoost, boost, lane, setLane, progress, setToast }) => (
  <main className="content-grid">
    <section className="stage-card panel-card">
      <div className="stage-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> QUICK RACE <span className="eyebrow-slash">/</span> 01</div>
          <h1>Neon Nitro <span>Cup</span></h1>
          <p>Pick a line. Hit the gas. Make some noise.</p>
        </div>
        <div className="stage-actions"><span className="weather-pill"><Icon name="sun" size={14} /> 24° <span>DAYLIGHT</span></span><button className="small-icon-button" onClick={() => setToast("Track details pinned to your dashboard")} aria-label="Pin track"><Icon name="flag" size={16} /></button></div>
      </div>
      <TrackLandscape car={car} isRacing={isRacing} lane={lane} progress={progress} />
      <div className="stage-bottom">
        <div className="driver-card"><div className="driver-car-wrap"><CarArt car={car} compact animate={isRacing} /></div><div className="driver-copy"><span className="card-label">YOUR RIDE</span><strong>{car.name}</strong><span>{car.quote}</span></div><span className="selected-tag">SELECTED</span></div>
        <div className="quick-stats"><div><span>TOP SPEED</span><strong>{car.topSpeed}<small> MPH</small></strong></div><div><span>HANDLING</span><strong>{car.handling}<small>%</small></strong></div><div><span>BEST LAP</span><strong>01:46<small>.12</small></strong></div></div>
      </div>
    </section>
    <RaceSidebar isRacing={isRacing} startRace={startRace} triggerBoost={triggerBoost} boost={boost} selectedCar={car} setToast={setToast} />
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
          <div className="showcase-info"><div><span className="car-class">{car.className}</span><h2>{car.name}</h2><p>“{car.quote}”</p></div><div className="rating-bubble"><strong>{Math.round((car.topSpeed + car.handling + car.boost) / 3)}</strong><span>RATING</span></div></div>
          <div className="showcase-stats"><StatBar label="TOP SPEED" value={car.topSpeed} tone="lime" /><StatBar label="HANDLING" value={car.handling} tone="coral" /><StatBar label="BOOST" value={car.boost} tone="cyan" /></div>
          <button className="equip-button" onClick={() => setToast(`${car.name} is ready for the grid!`)}>EQUIPPED <Icon name="bolt" size={15} /></button>
        </section>
        <section className="garage-list"><div className="list-heading"><span className="card-label">YOUR COLLECTION</span><span>{cars.length} / 6</span></div>{cars.map((item, index) => <button className={`garage-car-card ${index === selectedIndex ? "garage-car-selected" : ""}`} key={item.name} onClick={() => setSelectedIndex(index)}><div className="garage-car-art"><CarArt car={item} compact /></div><div className="garage-car-copy"><span>{item.className}</span><strong>{item.name}</strong><div className="tiny-bars"><i style={{ width: `${item.topSpeed}%`, background: "var(--lime)" }} /><i style={{ width: `${item.handling}%`, background: "var(--coral)" }} /><i style={{ width: `${item.boost}%`, background: "var(--cyan)" }} /></div></div><span className="garage-check">{index === selectedIndex ? <Icon name="bolt" size={15} /> : <Icon name="arrow" size={15} />}</span></button>)}<button className="locked-car"><span className="locked-icon"><Icon name="lock" size={15} /></span><span><strong>???</strong><small>Win CUP 04 to unlock</small></span></button></section>
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
  const [boost, setBoost] = useState(62);
  const [lane, setLane] = useState(0);
  const [credits, setCredits] = useState(2480);
  const [toast, setToast] = useState("");

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => setToast(""), 2600);
  }, []);

  const startRace = useCallback(() => {
    if (isRacing) {
      setIsRacing(false);
      showToast("Pit stop! Catch your breath, racer.");
      return;
    }
    setActivePage("race");
    setProgress(0);
    setBoost(100);
    setLane(0);
    setIsRacing(true);
    showToast("GO! Find your racing line.");
  }, [isRacing, showToast]);

  const triggerBoost = useCallback(() => {
    if (!isRacing || boost < 15) return;
    setBoost((current) => Math.max(0, current - 18));
    setProgress((current) => Math.min(100, current + 7));
    showToast("NITRO BURST! Nice and spicy.");
  }, [boost, isRacing, showToast]);

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
      setBoost((current) => Math.max(0, current - 0.45));
    }, 100);
    return () => window.clearInterval(timer);
  }, [isRacing, showToast]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        setLane((current) => Math.max(-1, current - 1));
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        setLane((current) => Math.min(1, current + 1));
      }
      if (event.code === "Space") {
        event.preventDefault();
        triggerBoost();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [triggerBoost]);

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
        {activePage === "race" && <RacePage car={currentCar} isRacing={isRacing} startRace={startRace} triggerBoost={triggerBoost} boost={boost} lane={lane} setLane={setLane} progress={progress} setToast={showToast} />}
        {activePage === "garage" && <GaragePage selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} setToast={showToast} />}
        {activePage === "league" && <LeaguePage setToast={showToast} />}
      </div>
      <footer className="app-footer"><span><i className="footer-pulse" /> SERVERS ONLINE</span><span>© 2025 KARTOON KARTS</span><span>v1.08.4 <b>•</b> Made for speed</span></footer>
      {toast && <div className="toast"><span className="toast-icon"><Icon name="bolt" size={15} /></span>{toast}</div>}
    </div>
  );
};

export default App;
