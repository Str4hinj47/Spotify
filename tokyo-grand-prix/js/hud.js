import * as THREE from 'three';
import * as track from './track.js';

// ---------------------------------------------------------------------------
export function fmtTime(t) {
  if (!isFinite(t)) return '-:--.--';
  const m = Math.floor(t / 60), s = Math.floor(t % 60), h = Math.floor((t % 1) * 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(h).padStart(2, '0')}`;
}
const SUF = ['st', 'nd', 'rd', 'th', 'th', 'th'];

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      posNum: document.getElementById('posNum'),
      posSuf: document.getElementById('posSuf'),
      lapNum: document.getElementById('lapNum'),
      lapTime: document.getElementById('lapTime'),
      bestTime: document.getElementById('bestTime'),
      standings: document.getElementById('standings'),
      speedNum: document.getElementById('speedNum'),
      centerMsg: document.getElementById('centerMsg'),
      wrongWay: document.getElementById('wrongWay'),
      title: document.getElementById('title'),
      results: document.getElementById('results'),
      resKicker: document.getElementById('resKicker'),
      resTitle: document.getElementById('resTitle'),
      resTable: document.getElementById('resTable'),
      resBest: document.getElementById('resBest'),
      pauseOv: document.getElementById('pauseOv'),
      touchUI: document.getElementById('touchUI'),
    };
    this.msgTimer = 0;
    this.mini = document.getElementById('minimap');
    this.mctx = this.mini.getContext('2d');
    this.miniPath = new Path2D();
    track.MAP.poly.forEach(([x, y], i) => i === 0 ? this.miniPath.moveTo(x, y) : this.miniPath.lineTo(x, y));
    this.miniPath.closePath();
    this.standRows = [];
    for (let i = 0; i < 6; i++) {
      const d = document.createElement('div');
      d.className = 'srow';
      d.innerHTML = `<span class="sp"></span><span class="sn"></span>`;
      this.el.standings.appendChild(d);
      this.standRows.push(d);
    }
  }

  showHud(b) { this.el.hud.classList.toggle('hidden', !b); }
  showTitle(b) { this.el.title.classList.toggle('hidden', !b); }
  showPause(b) { this.el.pauseOv.classList.toggle('hidden', !b); }
  showTouch(b) { this.el.touchUI.classList.toggle('hidden', !b); }

  speed(kmh) { this.el.speedNum.textContent = Math.max(0, Math.round(kmh)); }
  lap(n) { this.el.lapNum.textContent = Math.min(n, track.LAPS); }
  times(lapT, bestT) {
    this.el.lapTime.textContent = fmtTime(lapT);
    this.el.bestTime.textContent = fmtTime(bestT);
  }
  position(p) {
    this.el.posNum.textContent = p;
    this.el.posSuf.textContent = SUF[p - 1] ?? 'th';
  }
  standingsList(racers) {
    racers.forEach((r, i) => {
      const row = this.standRows[i];
      row.classList.toggle('me', r.isPlayer);
      row.style.setProperty('--c', '#' + new THREE.Color(r.color).getHexString());
      row.children[0].textContent = i + 1;
      row.children[1].textContent = r.isPlayer ? 'YOU' : r.name;
    });
  }
  message(txt, ms = 1400, cls = '') {
    const m = this.el.centerMsg;
    m.textContent = txt;
    m.className = 'show ' + cls;
    this.msgTimer = ms / 1000;
  }
  clearMessage() { this.el.centerMsg.className = ''; }
  wrongWay(b) { this.el.wrongWay.classList.toggle('show', b); }

  tick(dt) {
    if (this.msgTimer > 0) {
      this.msgTimer -= dt;
      if (this.msgTimer <= 0) this.clearMessage();
    }
  }

  minimap(racers) {
    const g = this.mctx;
    g.clearRect(0, 0, 190, 190);
    g.strokeStyle = 'rgba(120,190,255,0.35)';
    g.lineWidth = 5;
    g.stroke(this.miniPath);
    // start line tick
    const [sx, sy] = track.MAP.toMap(track.pts[0].x, track.pts[0].z);
    g.fillStyle = '#fff';
    g.fillRect(sx - 3, sy - 3, 6, 6);
    for (const r of racers) {
      const [x, y] = track.MAP.toMap(r.pos.x, r.pos.z);
      g.beginPath();
      g.arc(x, y, r.isPlayer ? 5 : 3.6, 0, 7);
      g.fillStyle = r.isPlayer ? '#ff3b30' : '#' + new THREE.Color(r.color).getHexString();
      g.fill();
      if (r.isPlayer) { g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.stroke(); }
    }
  }

  results(rows, playerPos, bestLap, newRecord) {
    this.el.resKicker.textContent = playerPos === 1 ? '★ CHECKERED FLAG — VICTORY! ★' : 'CHECKERED FLAG';
    this.el.resTitle.textContent = `YOU FINISHED ${playerPos}${SUF[playerPos - 1] ?? 'th'}`;
    let html = '<tr><th></th><th>DRIVER</th><th>TIME</th></tr>';
    rows.forEach((r, i) => {
      html += `<tr class="${r.isPlayer ? 'me' : ''}"><td class="pos">${i + 1}</td>
        <td><span class="chip" style="background:#${new THREE.Color(r.color).getHexString()}"></span>${r.isPlayer ? 'YOU (McQUEEN)' : r.name}</td>
        <td class="time">${r.finished ? fmtTime(r.finishTime) : 'still racing…'}</td></tr>`;
    });
    this.el.resTable.innerHTML = html;
    this.el.resBest.textContent = `BEST LAP ${fmtTime(bestLap)}` + (newRecord ? ' — NEW TRACK RECORD!' : '');
    this.el.results.classList.remove('hidden');
  }
  hideResults() { this.el.results.classList.add('hidden'); }
}
