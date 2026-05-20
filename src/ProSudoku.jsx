import { useState, useEffect, useRef } from "react";

// ─── GRID CONFIG ─────────────────────────────────────────────────────────────
// difficulty 1-100 → grid size + box dims
function getGridConfig(difficulty) {
  if (difficulty <= 20) return { size: 9,  boxR: 3, boxC: 3, label: "Kolay",  color: "#4ade80" };
  if (difficulty <= 40) return { size: 12, boxR: 3, boxC: 4, label: "Normal", color: "#60a5fa" };
  if (difficulty <= 60) return { size: 16, boxR: 4, boxC: 4, label: "Zor",    color: "#facc15" };
  if (difficulty <= 80) return { size: 20, boxR: 4, boxC: 5, label: "Uzman",  color: "#f97316" };
  return                       { size: 20, boxR: 4, boxC: 5, label: "Ucube",  color: "#f43f5e" };
}

// How many cells to remove based on difficulty within its range
function cellsToRemove(difficulty, size) {
  const total = size * size;
  // remove 30%–65% of cells based on difficulty within its band
  const pct = 0.30 + (difficulty / 100) * 0.35;
  return Math.floor(total * pct);
}

function maxHints(difficulty) {
  if (difficulty <= 20) return 5;
  if (difficulty <= 40) return 4;
  if (difficulty <= 60) return 3;
  if (difficulty <= 80) return 2;
  return 1;
}

// ─── SUDOKU ENGINE ───────────────────────────────────────────────────────────
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isValid(board, row, col, num, size, boxR, boxC) {
  for (let c = 0; c < size; c++) if (board[row][c] === num) return false;
  for (let r = 0; r < size; r++) if (board[r][col] === num) return false;
  const br = Math.floor(row / boxR) * boxR;
  const bc = Math.floor(col / boxC) * boxC;
  for (let r = br; r < br + boxR; r++)
    for (let c = bc; c < bc + boxC; c++)
      if (board[r][c] === num) return false;
  return true;
}

function generateFullBoard(size, boxR, boxC) {
  const board = Array.from({ length: size }, () => Array(size).fill(0));
  const nums = Array.from({ length: size }, (_, i) => i + 1);
  function fill(pos) {
    if (pos === size * size) return true;
    const r = Math.floor(pos / size), c = pos % size;
    for (const n of shuffleArray(nums)) {
      if (isValid(board, r, c, n, size, boxR, boxC)) {
        board[r][c] = n;
        if (fill(pos + 1)) return true;
        board[r][c] = 0;
      }
    }
    return false;
  }
  fill(0);
  return board;
}

function countSolutions(board, size, boxR, boxC, limit = 2) {
  let count = 0;
  const b = board.map(r => [...r]);
  function solve() {
    if (count >= limit) return;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (b[r][c] === 0) {
          for (let n = 1; n <= size; n++) {
            if (isValid(b, r, c, n, size, boxR, boxC)) {
              b[r][c] = n;
              solve();
              b[r][c] = 0;
            }
          }
          return;
        }
      }
    }
    count++;
  }
  solve();
  return count;
}

function generatePuzzle(difficulty) {
  const { size, boxR, boxC } = getGridConfig(difficulty);
  const solution = generateFullBoard(size, boxR, boxC);
  const puzzle = solution.map(r => [...r]);
  const cells = shuffleArray(
    Array.from({ length: size * size }, (_, i) => [Math.floor(i / size), i % size])
  );
  let removed = 0;
  const toRemove = cellsToRemove(difficulty, size);
  for (const [r, c] of cells) {
    if (removed >= toRemove) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    // For large grids skip uniqueness check (too slow) above 12x12
    if (size <= 12) {
      if (countSolutions(puzzle, size, boxR, boxC) === 1) {
        removed++;
      } else {
        puzzle[r][c] = backup;
      }
    } else {
      removed++; // for 16x16+ just remove without uniqueness check
    }
  }
  return { puzzle, solution, size, boxR, boxC };
}

// ─── XP SYSTEM ───────────────────────────────────────────────────────────────
function xpForLevel(level) { return level * level * 100; }
function calcXP(difficulty, timeSeconds, mistakes, hintsUsed) {
  const base = difficulty * 10;
  const timeBonus = Math.max(0, 1200 - timeSeconds) * 0.5;
  const mistakePenalty = mistakes * 20;
  const hintPenalty = hintsUsed * 30;
  return Math.max(10, Math.round(base + timeBonus - mistakePenalty - hintPenalty));
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const SAVE_KEY = "pro_sudoku_v2_save";
const PROFILE_KEY = "pro_sudoku_v2_profile";
const HINT_GIFT_WINDOW_MS = 5 * 60 * 1000;
function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } }
function writeSave(d) { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); }
function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || { xp: 0, level: 1, gamesWon: 0 }; }
  catch { return { xp: 0, level: 1, gamesWon: 0 }; }
}
function writeProfile(p) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }

// ─── TIMER ───────────────────────────────────────────────────────────────────
function useTimer(running) {
  const [seconds, setSeconds] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (running) ref.current = setInterval(() => setSeconds(s => s + 1), 1000);
    else clearInterval(ref.current);
    return () => clearInterval(ref.current);
  }, [running]);
  return [seconds, setSeconds];
}
function fmtTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

// ─── CELL LABEL (numbers > 9 show as hex-style or letters) ───────────────────
function cellLabel(val, size) {
  if (!val) return "";
  if (size <= 9) return String(val);
  if (size <= 16) return val <= 9 ? String(val) : String.fromCharCode(55 + val); // A-G
  // 20x20: 1-9, then A-K
  return val <= 9 ? String(val) : String.fromCharCode(55 + val);
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;500;600;700&display=swap');
:root {
  --bg:#020203; --surface:rgba(7,8,10,.82); --surface2:rgba(12,12,15,.92);
  --border:rgba(70,46,57,.82); --accent:#8f1f3a; --accent2:#2f6df6;
  --text:#f1f5f9; --muted:#7a808c; --error:#ef4444; --success:#22c55e;
  --cell-bg:rgba(7,8,11,.78); --cell-hover:rgba(24,18,24,.86); --cell-selected:rgba(64,21,39,.82);
  --cell-highlight:rgba(17,17,20,.64); --cell-locked:rgba(3,4,5,.86);
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:'Rajdhani',sans-serif;min-height:100vh;overflow-x:hidden;}
.app{min-height:100vh;display:flex;flex-direction:column;align-items:center;position:relative;overflow:hidden;
  background:radial-gradient(ellipse 70% 45% at 50% 0%,rgba(143,31,58,.12),transparent 62%),var(--bg);}
.app::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;
  background:url('/black-rose-bg.png') center center / auto 128vh no-repeat;
  opacity:.92;filter:brightness(2.08) contrast(1.26);}
.app::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;
  background:linear-gradient(180deg,rgba(2,2,3,.06),rgba(2,2,3,.34) 58%,rgba(2,2,3,.72)),
             linear-gradient(90deg,rgba(2,2,3,.72),rgba(2,2,3,.1) 54%,rgba(2,2,3,.66));}
.app>*{position:relative;z-index:1;}
@media (max-width:640px){
  .app::before{background-position:center 43%;background-size:auto 118vh;opacity:.95;filter:brightness(2.22) contrast(1.28);}
  .app::after{background:linear-gradient(180deg,rgba(2,2,3,.08),rgba(2,2,3,.24) 52%,rgba(2,2,3,.66)),
              linear-gradient(90deg,rgba(2,2,3,.42),rgba(2,2,3,.04) 52%,rgba(2,2,3,.42));}
}

/* HEADER */
.header{width:100%;max-width:560px;padding:14px 16px 0;display:flex;flex-direction:column;gap:10px;}
.logo-row{display:flex;align-items:center;justify-content:space-between;}
.logo{font-family:'Orbitron',monospace;font-size:1.1rem;font-weight:900;letter-spacing:.12em;
  background:linear-gradient(135deg,#f8fafc,#9f243f 48%,#2f6df6);-webkit-background-clip:text;
  -webkit-text-fill-color:transparent;background-clip:text;}
.profile-badge{display:flex;align-items:center;gap:7px;background:var(--surface);
  border:1px solid var(--border);border-radius:20px;padding:4px 11px 4px 7px;}
.level-circle{width:26px;height:26px;border-radius:50%;
  background:linear-gradient(135deg,#17171b,#8f1f3a);
  display:flex;align-items:center;justify-content:center;
  font-family:'Orbitron',monospace;font-size:.58rem;font-weight:700;color:#fff;}
.xp-info{font-size:.72rem;color:var(--muted);}
.xp-info strong{color:var(--text);font-size:.78rem;}

.xp-bar-wrap{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:7px 11px;}
.xp-bar-labels{display:flex;justify-content:space-between;font-size:.68rem;color:var(--muted);margin-bottom:4px;}
.xp-bar-track{height:4px;background:var(--border);border-radius:2px;overflow:hidden;}
.xp-bar-fill{height:100%;background:linear-gradient(90deg,#8f1f3a,#2f6df6);border-radius:2px;
  transition:width .8s cubic-bezier(.34,1.56,.64,1);}

.stats-row{display:flex;gap:6px;}
.stat-pill{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:8px;
  padding:5px 8px;display:flex;flex-direction:column;align-items:center;gap:1px;}
.stat-label{font-size:.58rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;}
.stat-value{font-family:'Orbitron',monospace;font-size:.78rem;font-weight:700;}

/* DIFFICULTY */
.difficulty-wrap{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 13px;}
.diff-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
.diff-label{font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;}
.diff-badge{font-size:.72rem;font-weight:700;padding:2px 9px;border-radius:10px;background:rgba(255,255,255,.06);transition:color .3s;}
.grid-info{font-size:.62rem;color:var(--muted);text-align:right;margin-top:4px;}
.slider-track{position:relative;height:6px;background:var(--border);border-radius:3px;margin:6px 0;}
.slider-fill{position:absolute;left:0;top:0;bottom:0;border-radius:3px;transition:width .1s,background .3s;}
input[type=range]{position:absolute;left:0;top:-5px;width:100%;height:16px;-webkit-appearance:none;background:transparent;cursor:pointer;}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:17px;height:17px;border-radius:50%;
  background:#f8fafc;box-shadow:0 0 0 3px rgba(143,31,58,.42);transition:box-shadow .2s;}
input[type=range]::-webkit-slider-thumb:hover{box-shadow:0 0 0 5px rgba(143,31,58,.3);}
.diff-ticks{display:flex;justify-content:space-between;margin-top:5px;}
.diff-tick{font-size:.58rem;color:var(--muted);}

/* BOARD WRAPPER */
.board-wrap{width:100%;max-width:560px;padding:10px 16px;}
.board-scroll{overflow:auto;-webkit-overflow-scrolling:touch;}
.board{display:inline-grid;gap:1px;background:rgba(94,58,72,.5);border:2px solid rgba(122,73,91,.72);
  border-radius:8px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.34);backdrop-filter:blur(2px);}

/* CELL */
.cell{background:var(--cell-bg);display:flex;align-items:center;justify-content:center;
  cursor:pointer;position:relative;transition:background .12s;
  font-family:'Rajdhani',sans-serif;font-weight:600;user-select:none;
  min-width:0;min-height:0;}
.cell.locked{background:var(--cell-locked);color:#aab0bb;font-weight:700;cursor:default;}
.cell.selected{background:var(--cell-selected)!important;}
.cell.highlight{background:var(--cell-highlight);}
.cell.same-num{background:#1a1117;}
.cell.error{color:var(--error)!important;}
.cell:not(.locked):hover{background:var(--cell-hover);}
.cell.box-right{border-right:2px solid #3a2630;}
.cell.box-bottom{border-bottom:2px solid #3a2630;}

.note-grid{display:grid;width:100%;height:100%;padding:1px;}
.note-num{display:flex;align-items:center;justify-content:center;font-size:.32rem;color:#475569;line-height:1;}

/* NUMBER PAD */
.numpad-wrap{width:100%;max-width:560px;padding:0 16px;}
.numpad{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;}
.num-btn{width:38px;height:38px;background:var(--surface);border:1px solid var(--border);
  border-radius:7px;color:var(--text);font-family:'Rajdhani',sans-serif;
  font-size:.88rem;font-weight:700;cursor:pointer;transition:all .13s;
  display:flex;align-items:center;justify-content:center;}
.num-btn:hover{background:var(--cell-selected);border-color:var(--accent);color:#f0a2b1;}
.num-btn.erase{color:var(--error);font-size:.75rem;}

/* CONTROLS */
.controls{width:100%;max-width:560px;padding:8px 16px 16px;display:flex;gap:7px;flex-wrap:wrap;}
.ctrl-btn{flex:1;min-width:64px;padding:7px 4px;background:var(--surface);border:1px solid var(--border);
  border-radius:8px;color:var(--text);font-family:'Rajdhani',sans-serif;font-size:.68rem;
  font-weight:600;cursor:pointer;transition:all .13s;display:flex;flex-direction:column;
  align-items:center;gap:2px;text-transform:uppercase;letter-spacing:.04em;}
.ctrl-btn:hover{background:var(--cell-hover);border-color:var(--accent);}
.ctrl-btn.active{background:rgba(143,31,58,.18);border-color:var(--accent);color:#f0a2b1;}
.ctrl-btn .icon{font-size:1rem;}

/* MODAL */
.modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.78);backdrop-filter:blur(8px);
  display:flex;align-items:center;justify-content:center;z-index:100;animation:fadeIn .2s ease;}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.modal{background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:26px 22px;
  width:90%;max-width:340px;display:flex;flex-direction:column;align-items:center;gap:14px;
  animation:slideUp .3s cubic-bezier(.34,1.56,.64,1);}
@keyframes slideUp{from{opacity:0;transform:translateY(28px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
.modal h2{font-family:'Orbitron',monospace;font-size:1.15rem;text-align:center;
  background:linear-gradient(135deg,#f8fafc,#9f243f);-webkit-background-clip:text;
  -webkit-text-fill-color:transparent;background-clip:text;}
.modal p{color:var(--muted);font-size:.85rem;text-align:center;}
.modal-stats{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:7px;}
.modal-stat{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:9px;text-align:center;}
.modal-stat .ms-label{font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;}
.modal-stat .ms-val{font-family:'Orbitron',monospace;font-size:.95rem;font-weight:700;margin-top:2px;}
.modal-btn{width:100%;padding:11px;border-radius:9px;font-family:'Rajdhani',sans-serif;
  font-size:.95rem;font-weight:700;cursor:pointer;border:none;transition:all .18s;
  text-transform:uppercase;letter-spacing:.06em;}
.modal-btn.primary{background:linear-gradient(135deg,#8f1f3a,#17171b);color:#fff;}
.modal-btn.primary:hover{opacity:.9;transform:translateY(-1px);}
.modal-btn.secondary{background:var(--surface);border:1px solid var(--border);color:var(--text);}
.modal-btn.secondary:hover{border-color:var(--accent);}
.xp-gained{font-family:'Orbitron',monospace;font-size:1.8rem;font-weight:900;
  background:linear-gradient(135deg,#facc15,#f97316);-webkit-background-clip:text;
  -webkit-text-fill-color:transparent;background-clip:text;
  animation:popIn .5s cubic-bezier(.34,1.56,.64,1) .2s both;}
@keyframes popIn{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}

.start-btn{width:100%;max-width:560px;padding:0 16px 8px;}
.start-btn button{width:100%;padding:11px;background:linear-gradient(135deg,#111114,#8f1f3a);
  border:none;border-radius:9px;color:#fff;font-family:'Rajdhani',sans-serif;
  font-size:.95rem;font-weight:700;cursor:pointer;text-transform:uppercase;
  letter-spacing:.08em;transition:all .18s;}
.start-btn button:hover{opacity:.9;transform:translateY(-1px);}
.start-btn button:disabled{opacity:.6;cursor:not-allowed;transform:none;}

.confetti-star{position:fixed;pointer-events:none;font-size:1.4rem;
  animation:flyUp 1.5s ease-out forwards;z-index:200;}
@keyframes flyUp{from{opacity:1;transform:translateY(0) rotate(0deg)}
  to{opacity:0;transform:translateY(-200px) rotate(360deg)}}

.generating-overlay{display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:12px;padding:40px;color:var(--muted);}
.spinner{width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--accent);
  border-radius:50%;animation:spin .8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}
.gen-label{font-family:'Orbitron',monospace;font-size:.75rem;letter-spacing:.1em;}

/* RULES CARD */
.rules-card{width:100%;max-width:560px;padding:0 16px 24px;}
.rules-inner{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;}
.rules-header{display:flex;align-items:center;justify-content:space-between;
  padding:11px 14px;cursor:pointer;user-select:none;transition:background .15s;}
.rules-header:hover{background:var(--cell-hover);}
.rules-title{display:flex;align-items:center;gap:8px;font-family:'Orbitron',monospace;
  font-size:.7rem;letter-spacing:.1em;font-weight:700;}
.rules-badge{font-size:.65rem;padding:2px 8px;border-radius:8px;font-family:'Rajdhani',sans-serif;
  font-weight:700;letter-spacing:.04em;}
.rules-chevron{color:var(--muted);font-size:.75rem;transition:transform .25s;}
.rules-chevron.open{transform:rotate(180deg);}
.rules-body{padding:0 14px;max-height:0;overflow:hidden;transition:max-height .35s ease,padding .25s;}
.rules-body.open{max-height:600px;padding:0 14px 14px;}
.rules-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;}
.rule-item{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;
  display:flex;flex-direction:column;gap:2px;}
.rule-item .ri-label{font-size:.58rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;}
.rule-item .ri-val{font-size:.82rem;font-weight:600;color:var(--text);}
.rules-desc{font-size:.8rem;color:var(--muted);line-height:1.6;margin-bottom:8px;}
.rules-tips{display:flex;flex-direction:column;gap:5px;}
.tip-row{display:flex;align-items:flex-start;gap:7px;font-size:.78rem;color:var(--muted);}
.tip-row .tip-icon{flex-shrink:0;font-size:.85rem;}
.tip-row span{line-height:1.45;}
.rules-divider{height:1px;background:var(--border);margin:10px 0;}
`;

// ─── RULES DATA ──────────────────────────────────────────────────────────────
const RULES_DATA = {
  Kolay: {
    color: "#4ade80",
    icon: "🟢",
    grid: "9×9",
    numbers: "1 – 9",
    boxes: "3×3 (9 kutu)",
    hints: "5 ipucu hakkı",
    xpRange: "10 – 200 XP",
    desc: "Klasik Sudoku. Her satır, sütun ve 3×3 kutuda 1'den 9'a kadar her rakam yalnızca bir kez yer almalıdır. Boş hücreleri doldur, hiçbir rakam tekrar etmesin.",
    tips: [
      { icon: "🔍", text: "Önce hangi rakamın nerede zorunlu olduğunu bul — tek seçenek kalan hücreleri doldur." },
      { icon: "✏️", text: "Not modunu kullanarak olası rakamları küçük yazabilirsin, sonra eleme yap." },
      { icon: "💡", text: "5 ipucu hakkın var, acele etme — zor hücrelerde kullan." },
      { icon: "⚡", text: "Daha hızlı bitirirsen daha fazla XP kazanırsın!" },
      
    ],
  },
  Normal: {
    color: "#60a5fa",
    icon: "🔵",
    grid: "12×12",
    numbers: "1 – 12",
    boxes: "3×4 (9 kutu)",
    hints: "4 ipucu hakkı",
    xpRange: "210 – 400 XP",
    desc: "Genişletilmiş Sudoku. 12×12 grid'de 1'den 12'ye kadar rakamlar kullanılır. Her satır, sütun ve 3×4 kutuda hiçbir rakam tekrarlanmamalıdır.",
    tips: [
      { icon: "🗺️", text: "Grid büyüdü — önce köşe kutularını çözmeye çalış, orta kutular kendiliğinden açılır." },
      { icon: "✏️", text: "Not modu şart! 12 rakamı takip etmek için mutlaka kullan." },
      { icon: "🎯", text: "Bir satır veya sütunda sadece 1-2 boşluk kaldıysa önce onları doldur." },
      { icon: "⏱️", text: "Süre bonusu var — takılırsak ipucu kullan, zaman kaybetme." },
    ],
  },
  Zor: {
    color: "#facc15",
    icon: "🟡",
    grid: "16×16",
    numbers: "1 – 9, A – G (10–16)",
    boxes: "4×4 (16 kutu)",
    hints: "3 ipucu hakkı",
    xpRange: "410 – 600 XP",
    desc: "Büyük Sudoku. 16×16 grid'de 1–9 ve A–G harfleri kullanılır (A=10, B=11 … G=16). Her satır, sütun ve 4×4 kutuda her değer yalnızca bir kez olmalıdır.",
    tips: [
      { icon: "🔤", text: "A=10, B=11, C=12, D=13, E=14, F=15, G=16 — klavyede A–G tuşlarını kullanabilirsin." },
      { icon: "🧩", text: "4×4 kutuları ayrı ayrı çöz, her kutuda 16 farklı değerin hepsi olmalı." },
      { icon: "📝", text: "Not modu olmadan bu seviyeyi çözmek neredeyse imkânsız — mutlaka kullan!" },
      { icon: "🏆", text: "Hatasız bitirirsen XP cezası yok, büyük puan kazanırsın." },
    ],
  },
  Uzman: {
    color: "#f97316",
    icon: "🟠",
    grid: "20×20",
    numbers: "1 – 9, A – K (10–20)",
    boxes: "4×5 (25 kutu)",
    hints: "2 ipucu hakkı",
    xpRange: "610 – 800 XP",
    desc: "Dev Sudoku. 20×20 grid'de 1–9 ve A–K harfleri kullanılır (A=10 … K=20). Her satır, sütun ve 4×5 kutuda 20 farklı değerin tamamı yer almalıdır.",
    tips: [
      { icon: "🧠", text: "Bu seviye gerçek bir sabır testi — acele etme, sistematik çalış." },
      { icon: "🔤", text: "A=10'dan K=20'ye kadar; klavyede A–K tuşları geçerli." },
      { icon: "🎯", text: "Her çözüm adımında en az seçenek içeren hücreyi bul ve oradan başla." },
      { icon: "⛔", text: "Sadece 2 ipucu hakkın var — son çare olarak sakla." },
    ],
  },
  Ucube: {
    color: "#f43f5e",
    icon: "🔴",
    grid: "20×20",
    numbers: "1 – 9, A – K (10–20)",
    boxes: "4×5 (25 kutu)",
    hints: "1 ipucu hakkı",
    xpRange: "810 – 1000+ XP",
    desc: "Maksimum zorluk. 20×20 grid'de hücrelerin büyük çoğunluğu boş! Sadece 1 ipucu hakkın var. Bu seviyeyi bitirmek gerçek bir başarıdır.",
    tips: [
      { icon: "💀", text: "Uyarı: Bu seviye profesyoneller için. Ortalama çözüm süresi 2+ saat." },
      { icon: "📋", text: "Çözüme başlamadan önce tüm görünür rakamları not moduna işle." },
      { icon: "🔬", text: "X-Wing, Swordfish gibi ileri Sudoku tekniklerini biliyorsan avantajlısın." },
      { icon: "🏅", text: "Hatasız ve ipuçsuz bitirirsen maksimum XP — efsane olursun!" },
    ],
  },
};

function RulesCard({ difficulty }) {
  const [open, setOpen] = useState(false);
  const cfg = getGridConfig(difficulty);
  const rules = RULES_DATA[cfg.label];

  // Auto-close when difficulty label changes
  useEffect(() => { setOpen(false); }, [cfg.label]);

  return (
    <div className="rules-card">
      <div className="rules-inner">
        <div className="rules-header" onClick={() => setOpen(o => !o)}>
          <div className="rules-title">
            <span>{rules.icon}</span>
            <span style={{ color: rules.color }}>{cfg.label.toUpperCase()} — KURALLAR</span>
            <span className="rules-badge" style={{ background: `${rules.color}18`, color: rules.color }}>
              {rules.grid}
            </span>
          </div>
          <span className={`rules-chevron ${open ? "open" : ""}`}>▼</span>
        </div>

        <div className={`rules-body ${open ? "open" : ""}`}>
          {/* Quick stats grid */}
          <div className="rules-grid">
            <div className="rule-item">
              <span className="ri-label">Grid Boyutu</span>
              <span className="ri-val" style={{ color: rules.color }}>{rules.grid}</span>
            </div>
            <div className="rule-item">
              <span className="ri-label">Rakamlar</span>
              <span className="ri-val">{rules.numbers}</span>
            </div>
            <div className="rule-item">
              <span className="ri-label">Kutular</span>
              <span className="ri-val">{rules.boxes}</span>
            </div>
            <div className="rule-item">
              <span className="ri-label">İpucu Hakkı</span>
              <span className="ri-val" style={{ color: "#f0a2b1" }}>{rules.hints}</span>
            </div>
            <div className="rule-item" style={{ gridColumn: "1 / -1" }}>
              <span className="ri-label">Kazanılabilecek XP</span>
              <span className="ri-val" style={{ color: "#facc15" }}>{rules.xpRange}</span>
            </div>
          </div>

          <div className="rules-divider" />

          {/* Description */}
          <p className="rules-desc">{rules.desc}</p>

          <div className="rules-divider" />

          {/* Tips */}
          <div className="rules-tips">
            {rules.tips.map((t, i) => (
              <div key={i} className="tip-row">
                <span className="tip-icon">{t.icon}</span>
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function ProSudoku() {
  const [difficulty, setDifficulty] = useState(15);
  const [gameData, setGameData] = useState(null); // {puzzle,solution,board,notes,size,boxR,boxC}
  const [selected, setSelected] = useState(null);
  const [noteMode, setNoteMode] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(5);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [profile, setProfile] = useState(loadProfile);
  const [confetti, setConfetti] = useState([]);
  const [xpGained, setXpGained] = useState(0);
  const [hintAlert, setHintAlert] = useState(null);
  const hintTapRef = useRef({ count: 0, giftWindowUntil: 0 });

  const timerRunning = !!gameData && !paused && !gameOver && !generating;
  const [seconds, setSeconds] = useTimer(timerRunning);

  const cfg = getGridConfig(difficulty);

  // Load save on mount
  useEffect(() => {
    const saved = loadSave();
    if (saved) {
      setGameData({
        puzzle: saved.puzzle, solution: saved.solution,
        board: saved.board,
        notes: saved.notes.map(row => row.map(s => new Set(s))),
        size: saved.size, boxR: saved.boxR, boxC: saved.boxC,
      });
      setSeconds(saved.seconds);
      setDifficulty(saved.difficulty);
      setMistakes(saved.mistakes);
      setHints(saved.hints);
    }
  }, []);

  // Auto-save
  useEffect(() => {
    if (!gameData || gameOver) return;
    writeSave({
      puzzle: gameData.puzzle, solution: gameData.solution, board: gameData.board,
      notes: gameData.notes.map(row => row.map(s => [...s])),
      seconds, difficulty, mistakes, hints,
      size: gameData.size, boxR: gameData.boxR, boxC: gameData.boxC,
    });
  }, [gameData, seconds, mistakes, hints]);

  function startGame() {
    setGenerating(true);
    setSelected(null);
    setNoteMode(false);
    setGameOver(false);
    setPaused(false);
    hintTapRef.current = { count: 0, giftWindowUntil: 0 };
    setHintAlert(null);
    setTimeout(() => {
      const { puzzle, solution, size, boxR, boxC } = generatePuzzle(difficulty);
      setGameData({
        puzzle, solution, board: puzzle.map(r => [...r]),
        notes: Array.from({ length: size }, () => Array.from({ length: size }, () => new Set())),
        size, boxR, boxC,
      });
      setSeconds(0);
      setMistakes(0);
      setHints(maxHints(difficulty));
      setGenerating(false);
      localStorage.removeItem(SAVE_KEY);
    }, 60);
  }

  function handleNumber(num) {
    if (!gameData || !selected || paused || gameOver) return;
    hintTapRef.current = { count: 0, giftWindowUntil: 0 };
    const { puzzle, solution, board, notes, size, boxR, boxC } = gameData;
    const [r, c] = selected;
    if (puzzle[r][c] !== 0) return;

    if (noteMode) {
      const newNotes = notes.map(row => row.map(s => new Set(s)));
      newNotes[r][c].has(num) ? newNotes[r][c].delete(num) : newNotes[r][c].add(num);
      setGameData({ ...gameData, notes: newNotes });
      return;
    }

    const newBoard = board.map(row => [...row]);
    newBoard[r][c] = num;

    if (num !== solution[r][c]) {
      setMistakes(m => m + 1);
    } else {
      const newNotes = notes.map(row => row.map(s => new Set(s)));
      newNotes[r][c].clear();
      for (let i = 0; i < size; i++) { newNotes[r][i].delete(num); newNotes[i][c].delete(num); }
      const br = Math.floor(r / boxR) * boxR, bc = Math.floor(c / boxC) * boxC;
      for (let dr = 0; dr < boxR; dr++)
        for (let dc = 0; dc < boxC; dc++)
          newNotes[br + dr][bc + dc].delete(num);
      setGameData({ ...gameData, board: newBoard, notes: newNotes });
      checkWin(newBoard);
      return;
    }
    setGameData({ ...gameData, board: newBoard });
  }

  function handleErase() {
    if (!gameData || !selected || paused) return;
    hintTapRef.current = { count: 0, giftWindowUntil: 0 };
    const [r, c] = selected;
    if (gameData.puzzle[r][c] !== 0) return;
    const newBoard = gameData.board.map(row => [...row]);
    newBoard[r][c] = 0;
    const newNotes = gameData.notes.map(row => row.map(s => new Set(s)));
    newNotes[r][c].clear();
    setGameData({ ...gameData, board: newBoard, notes: newNotes });
  }

  function handleHint() {
    if (!gameData || paused || gameOver) return;

    if (hints <= 0) {
      const now = Date.now();
      const hintTap = hintTapRef.current;
      const inGiftWindow = hintTap.giftWindowUntil > now;
      const nextHintTapCount = inGiftWindow
        ? hintTap.count + 1
        : hintTap.count >= 3 ? 1 : hintTap.count + 1;

      if (!inGiftWindow && nextHintTapCount === 3) {
        hintTapRef.current = { count: 3, giftWindowUntil: now + HINT_GIFT_WINDOW_MS };
        setHintAlert({
          title: "ENES SOR",
          message: "Devam etmeden \u00f6nce Enes'e sor.",
        });
      } else if (inGiftWindow && nextHintTapCount >= 6) {
        hintTapRef.current = { count: 0, giftWindowUntil: 0 };
        setHints(maxHints(difficulty));
        setHintAlert({
          title: "ENESTEN HED\u0130YE",
          message: "\u0130pucu hakk\u0131n yenilendi.",
        });
      } else {
        hintTapRef.current = {
          count: nextHintTapCount,
          giftWindowUntil: inGiftWindow ? hintTap.giftWindowUntil : 0,
        };
      }
      return;
    }

    hintTapRef.current = { count: 0, giftWindowUntil: 0 };
    if (!selected) return;
    const [r, c] = selected;
    const { puzzle, solution, board } = gameData;
    if (puzzle[r][c] !== 0 || board[r][c] === solution[r][c]) return;
    const newBoard = board.map(row => [...row]);
    newBoard[r][c] = solution[r][c];
    setGameData({ ...gameData, board: newBoard });
    setHints(h => h - 1);
    checkWin(newBoard);
  }

  function checkWin(b) {
    const { solution } = gameData;
    if (b.every((row, r) => row.every((v, c) => v === solution[r][c]))) {
      const xp = calcXP(difficulty, seconds, mistakes, maxHints(difficulty) - hints);
      setXpGained(xp);
      setGameOver("win");
      applyXP(xp);
      spawnConfetti();
      localStorage.removeItem(SAVE_KEY);
    }
  }

  function applyXP(xp) {
    const p = { ...profile, xp: profile.xp + xp, gamesWon: profile.gamesWon + 1 };
    while (p.xp >= xpForLevel(p.level)) { p.xp -= xpForLevel(p.level); p.level++; }
    setProfile(p);
    writeProfile(p);
  }

  function spawnConfetti() {
    setConfetti(Array.from({ length: 14 }, (_, i) => ({
      id: i, left: Math.random() * 100, top: 55 + Math.random() * 25,
      emoji: ["⭐","✨","🎉","🌟","💎","🔷"][Math.floor(Math.random() * 6)],
      delay: Math.random() * 0.8,
    })));
    setTimeout(() => setConfetti([]), 2500);
  }

  // Keyboard
  useEffect(() => {
    if (!gameData) return;
    const { size } = gameData;
    function onKey(e) {
      if (e.key >= '1' && e.key <= '9') handleNumber(parseInt(e.key));
      // A-K for values 10-20
      const code = e.key.toUpperCase();
      if (code >= 'A' && code <= 'K') handleNumber(code.charCodeAt(0) - 55);
      if (e.key === 'Backspace' || e.key === 'Delete') handleErase();
      if (e.key.toLowerCase() === 'n') setNoteMode(m => !m);
      if (!selected) return;
      const [r, c] = selected;
      if (e.key === 'ArrowUp') setSelected([Math.max(0, r - 1), c]);
      if (e.key === 'ArrowDown') setSelected([Math.min(size - 1, r + 1), c]);
      if (e.key === 'ArrowLeft') setSelected([r, Math.max(0, c - 1)]);
      if (e.key === 'ArrowRight') setSelected([r, Math.min(size - 1, c + 1)]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, gameData, noteMode, paused, gameOver]);

  // ── RENDER HELPERS ──
  const xpNeeded = xpForLevel(profile.level);
  const xpPct = Math.min(100, (profile.xp / xpNeeded) * 100);

  function getCellClass(r, c) {
    if (!gameData) return "cell";
    const { puzzle, board, solution, boxR, boxC } = gameData;
    let cls = "cell";
    if (puzzle[r][c] !== 0) cls += " locked";
    else if (board[r][c] !== 0 && board[r][c] !== solution[r][c]) cls += " error";

    if (selected) {
      const [sr, sc] = selected;
      const sameBox = Math.floor(r / boxR) === Math.floor(sr / boxR) &&
                      Math.floor(c / boxC) === Math.floor(sc / boxC);
      if (r === sr && c === sc) cls += " selected";
      else if (r === sr || c === sc || sameBox) cls += " highlight";
      const selVal = board[sr][sc];
      if (selVal && selVal === board[r][c] && !(r === sr && c === sc)) cls += " same-num";
    }
    if ((c + 1) % boxC === 0 && c < gameData.size - 1) cls += " box-right";
    if ((r + 1) % boxR === 0 && r < gameData.size - 1) cls += " box-bottom";
    return cls;
  }

  // Cell size — shrink for bigger grids
  function cellSize(size) {
    if (size <= 9)  return { w: 52, fs: "1.15rem", nfs: "0.38rem", ncols: 3 };
    if (size <= 12) return { w: 40, fs: "0.9rem",  nfs: "0.3rem",  ncols: 4 };
    if (size <= 16) return { w: 32, fs: "0.72rem", nfs: "0.25rem", ncols: 4 };
    return              { w: 26, fs: "0.6rem",  nfs: "0.2rem",  ncols: 5 };
  }

  const size = gameData?.size ?? cfg.size;
  const cs = cellSize(size);

  // Number buttons for current grid size
  function renderNumpad(gridSize) {
    const nums = Array.from({ length: gridSize }, (_, i) => i + 1);
    return (
      <div className="numpad-wrap">
        <div className="numpad">
          {nums.map(n => (
            <button key={n} className="num-btn" onClick={() => handleNumber(n)}>
              {cellLabel(n, gridSize)}
            </button>
          ))}
          <button className="num-btn erase" onClick={handleErase}>⌫</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {confetti.map(c => (
          <span key={c.id} className="confetti-star"
            style={{ left: `${c.left}%`, top: `${c.top}%`, animationDelay: `${c.delay}s` }}>
            {c.emoji}
          </span>
        ))}

        {/* HEADER */}
        <div className="header">
          <div className="logo-row">
            <span className="logo">SANA ÖZEL SUDOKU</span>
            <div className="profile-badge">
              <div className="level-circle">L{profile.level}</div>
              <div className="xp-info">
                <strong>{profile.xp}</strong> / {xpNeeded} XP
              </div>
            </div>
          </div>

          <div className="xp-bar-wrap">
            <div className="xp-bar-labels">
              <span>Seviye {profile.level}</span>
              <span>{profile.gamesWon} oyun kazanıldı</span>
            </div>
            <div className="xp-bar-track">
              <div className="xp-bar-fill" style={{ width: `${xpPct}%` }} />
            </div>
          </div>

          {gameData && (
            <div className="stats-row">
              <div className="stat-pill">
                <span className="stat-label">Süre</span>
                <span className="stat-value">{fmtTime(seconds)}</span>
              </div>
              <div className="stat-pill">
                <span className="stat-label">Grid</span>
                <span className="stat-value" style={{ color: cfg.color }}>{gameData.size}×{gameData.size}</span>
              </div>
              <div className="stat-pill">
                <span className="stat-label">Seviye</span>
                <span className="stat-value" style={{ color: cfg.color }}>{cfg.label}</span>
              </div>
              <div className="stat-pill">
                <span className="stat-label">Hata</span>
                <span className="stat-value" style={{ color: mistakes > 0 ? "var(--error)" : "var(--text)" }}>{mistakes}</span>
              </div>
              <div className="stat-pill">
                <span className="stat-label">İpucu</span>
                <span className="stat-value" style={{ color: "var(--accent)" }}>{hints}</span>
              </div>
            </div>
          )}

          {/* DIFFICULTY SLIDER */}
          <div className="difficulty-wrap">
            <div className="diff-header">
              <span className="diff-label">Zorluk</span>
              <span className="diff-badge" style={{ color: cfg.color }}>
                {difficulty} — {cfg.label}
              </span>
            </div>
            <div className="slider-track">
              <div className="slider-fill" style={{
                width: `${(difficulty - 1) / 99 * 100}%`,
                background: `linear-gradient(90deg,#4ade80,${cfg.color})`
              }} />
              <input type="range" min="1" max="100" value={difficulty}
                onChange={e => setDifficulty(Number(e.target.value))}
                disabled={generating} />
            </div>
            <div className="diff-ticks">
              {["Kolay","Normal","Zor","Uzman","Ucube"].map(t => (
                <span key={t} className="diff-tick">{t}</span>
              ))}
            </div>
            <div className="grid-info">
              {cfg.size}×{cfg.size} grid · 1–{cfg.size} arası rakamlar · {cfg.boxR}×{cfg.boxC} kutular
            </div>
          </div>
        </div>

        {/* START BUTTON */}
        <div className="start-btn">
          <button onClick={startGame} disabled={generating}>
            {generating ? "⚙ Üretiliyor..." : gameData ? "🔄 Yeni Oyun" : "▶ Oyuna Başla"}
          </button>
        </div>

        {/* BOARD */}
        <div className="board-wrap">
          {generating ? (
            <div className="generating-overlay">
              <div className="spinner" />
              <span className="gen-label">
                {cfg.size}×{cfg.size} BOARD ÜRETİLİYOR...
              </span>
            </div>
          ) : gameData ? (
            <div className="board-scroll">
              <div className="board" style={{
                gridTemplateColumns: `repeat(${gameData.size}, ${cs.w}px)`,
                gridTemplateRows: `repeat(${gameData.size}, ${cs.w}px)`,
              }}>
                {gameData.board.map((row, r) =>
                  row.map((val, c) => {
                    const locked = gameData.puzzle[r][c] !== 0;
                    const noteSet = gameData.notes[r][c];
                    const showNotes = !locked && val === 0 && noteSet.size > 0;
                    const noteNums = Array.from({ length: gameData.size }, (_, i) => i + 1);
                    return (
                      <div
                        key={`${r}-${c}`}
                        className={getCellClass(r, c)}
                        style={{ fontSize: cs.fs, width: cs.w, height: cs.w }}
                        onClick={() => !paused && !gameOver && setSelected([r, c])}
                      >
                        {showNotes ? (
                          <div className="note-grid" style={{
                            gridTemplateColumns: `repeat(${cs.ncols}, 1fr)`,
                            gridTemplateRows: `repeat(${Math.ceil(gameData.size / cs.ncols)}, 1fr)`,
                          }}>
                            {noteNums.map(n => (
                              <div key={n} className="note-num"
                                style={{ fontSize: cs.nfs, color: noteSet.has(n) ? '#f0a2b1' : 'transparent' }}>
                                {cellLabel(n, gameData.size)}
                              </div>
                            ))}
                          </div>
                        ) : val !== 0 ? cellLabel(val, gameData.size) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "32px", gap: "8px",
              color: "var(--muted)", textAlign: "center"
            }}>
              <div style={{ fontSize: "2.5rem" }}>🧩</div>
              <div style={{ fontFamily: "'Orbitron',monospace", fontSize: "0.72rem", letterSpacing: "0.1em" }}>
                ZOR SEVIYE SEÇ, OYNA
              </div>
              <div style={{ fontSize: "0.8rem" }}>
                Slider'ı kaydır → {cfg.size}×{cfg.size} grid
              </div>
            </div>
          )}
        </div>

        {/* NUMBER PAD */}
        {gameData && !generating && renderNumpad(gameData.size)}

        {/* CONTROLS */}
        {gameData && !generating && (
          <div className="controls">
            <button className={`ctrl-btn ${noteMode ? "active" : ""}`} onClick={() => setNoteMode(m => !m)}>
              <span className="icon">✏️</span> Not {noteMode ? "Açık" : "Kapalı"}
            </button>
            <button className="ctrl-btn" onClick={handleHint}>
              <span className="icon">💡</span> İpucu ({hints})
            </button>
            <button className="ctrl-btn" onClick={() => setPaused(p => !p)}>
              <span className="icon">{paused ? "▶" : "⏸"}</span> {paused ? "Devam" : "Durdur"}
            </button>
          </div>
        )}

        {/* PAUSE MODAL */}
        {paused && !gameOver && (
          <div className="modal-backdrop">
            <div className="modal">
              <h2>⏸ Duraklatıldı</h2>
              <p>Beyin dinleniyor mu?</p>
              <div className="modal-stats">
                <div className="modal-stat">
                  <div className="ms-label">Süre</div>
                  <div className="ms-val">{fmtTime(seconds)}</div>
                </div>
                <div className="modal-stat">
                  <div className="ms-label">Grid</div>
                  <div className="ms-val" style={{ color: cfg.color }}>{gameData?.size}×{gameData?.size}</div>
                </div>
              </div>
              <button className="modal-btn primary" onClick={() => setPaused(false)}>▶ Devam Et</button>
              <button className="modal-btn secondary" onClick={startGame}>🔄 Yeni Oyun</button>
            </div>
          </div>
        )}

        {/* HINT ALERT MODAL */}
        {hintAlert && (
          <div className="modal-backdrop">
            <div className="modal">
              <h2>{hintAlert.title}</h2>
              <p>{hintAlert.message}</p>
              <button className="modal-btn primary" onClick={() => setHintAlert(null)}>Tamam</button>
            </div>
          </div>
        )}

        {/* RULES CARD */}
        <RulesCard difficulty={difficulty} />

        {/* WIN MODAL */}
        {gameOver === "win" && (
          <div className="modal-backdrop">
            <div className="modal">
              <h2>🎉 Tebrikler!</h2>
              <p>{gameData?.size}×{gameData?.size} grid'i çözdün!</p>
              <div className="xp-gained">+{xpGained} XP</div>
              <div className="modal-stats">
                <div className="modal-stat">
                  <div className="ms-label">Süre</div>
                  <div className="ms-val">{fmtTime(seconds)}</div>
                </div>
                <div className="modal-stat">
                  <div className="ms-label">Seviye</div>
                  <div className="ms-val" style={{ color: cfg.color }}>{cfg.label}</div>
                </div>
                <div className="modal-stat">
                  <div className="ms-label">Hata</div>
                  <div className="ms-val" style={{ color: mistakes > 0 ? "var(--error)" : "var(--success)" }}>{mistakes}</div>
                </div>
                <div className="modal-stat">
                  <div className="ms-label">Level</div>
                  <div className="ms-val" style={{ color: "var(--accent)" }}>Lv.{profile.level}</div>
                </div>
              </div>
              <button className="modal-btn primary" onClick={startGame}>🔄 Tekrar Oyna</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
