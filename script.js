(function(){
"use strict";

/* ---------- Théorie ---------- */
const LETTERS = ["C","D","E","F","G","A","B"];
const NATURAL = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const LATIN = {C:"Do",D:"Ré",E:"Mi",F:"Fa",G:"Sol",A:"La",B:"Si"};

// Fondamentales, dans l'ordre chromatique. alt = orthographe secondaire (affichée aussi).
const ROOTS = [
  {id:"C",  main:"C"},
  {id:"Db", main:"Db", alt:"C#"},
  {id:"D",  main:"D"},
  {id:"Eb", main:"Eb"},
  {id:"E",  main:"E"},
  {id:"F",  main:"F"},
  {id:"Gb", main:"Gb", alt:"F#"},
  {id:"G",  main:"G"},
  {id:"Ab", main:"Ab"},
  {id:"A",  main:"A"},
  {id:"Bb", main:"Bb"},
  {id:"B",  main:"B"}
];
const ROOT_LABEL = {Db:"C♯/D♭", Eb:"D♯/E♭", Gb:"F♯/G♭", Ab:"G♯/A♭", Bb:"A♯/B♭"};

// Types : intervalles en demi-tons (tierce, quinte, septième)
const TYPES = [
  {id:"maj", label:"Majeur", sym:"Δ7",      iv:[0,4,7,11]},
  {id:"dom", label:"7 (dominante)", sym:"7", iv:[0,4,7,10]},
  {id:"min", label:"Mineur", sym:"-7",       iv:[0,3,7,10]},
  {id:"hd",  label:"Demi-diminué", sym:"-7(♭5)", iv:[0,3,6,10]},
  {id:"dim", label:"Diminué", sym:"°7",      iv:[0,3,6,9]}
];

// Lettres repères notées sous la structure (reprises de la fiche) : [index de la note]
const MARKS = {
  "F|min":[2], "F|hd":[2],
  "Bb|min":[2], "Bb|hd":[2],
  "Ab|dom":[1], "Ab|min":[1],
  "Db|maj":[3], "Db|dom":[1,3], "Db|min":[1],
  "Gb|maj":[3], "Gb|dom":[3],
  "D|hd":[3], "D|dim":[3],
  "G|hd":[3], "G|dim":[3]
};

// Couleur de la forme : une forme et son inverse (blanches ↔ noires) partagent la couleur
const SHAPE_COLOR = {
  "0000":"yellow","0001":"orange","0010":"purple","0011":"gray",
  "0100":"red","0101":"blue","0110":"green","0111":"pink"
};

function parseNote(n){ return {letter:n[0], acc:(n.slice(1).match(/#/g)||[]).length - (n.slice(1).match(/b/g)||[]).length}; }
function pc(n){ const p=parseNote(n); return ((NATURAL[p.letter]+p.acc)%12+12)%12; }

// Orthographe « pratique » de la fiche : pas de F♭, C♭, E♯, B♯ ni de doubles altérations
const SIMPLE = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
const SIMPLE_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
function spell(root, iv){
  const r = parseNote(root), ri = LETTERS.indexOf(r.letter), rpc = pc(root);
  return iv.map((semi, k)=>{
    const letter = LETTERS[(ri + 2*k) % 7];
    const target = (rpc + semi) % 12;
    let acc = target - NATURAL[letter];
    if (acc > 6) acc -= 12; if (acc < -6) acc += 12;
    let name = letter + (acc>0 ? "#".repeat(acc) : "b".repeat(-acc));
    const odd = Math.abs(acc)>1 || ["Fb","Cb","E#","B#"].includes(name);
    if (odd) name = (acc>0 ? SIMPLE_SHARP : SIMPLE)[target];
    return name;
  });
}
const isBlack = n => [1,3,6,8,10].includes(pc(n));

// Construction des 60 accords
const CHORDS = [];
ROOTS.forEach(r=>TYPES.forEach(t=>{
  const notes = spell(r.main, t.iv);
  const bits = notes.map(n=>isBlack(n)?"1":"0").join("");
  const canon = bits[0]==="1" ? bits.replace(/./g,c=>c==="1"?"0":"1") : bits;
  CHORDS.push({
    key:r.id+"|"+t.id, root:r, type:t, notes,
    altNotes: r.alt ? spell(r.alt, t.iv) : null,
    bits, color: SHAPE_COLOR[canon], marks: MARKS[r.id+"|"+t.id] || []
  });
}));

/* ---------- Affichage des noms ---------- */
const state = {
  mode:"auto", duration:4, notation:"us",
  types:{maj:true, dom:true, min:true, hd:false, dim:false},
  roots:Object.fromEntries(ROOTS.map(r=>[r.id,true])),
  showName:true, showNotes:true, showStructure:true
};

function fmt(n){
  const p = parseNote(n);
  const base = state.notation==="fr" ? LATIN[p.letter] : p.letter;
  return base + (p.acc>0 ? "♯".repeat(p.acc) : "♭".repeat(-p.acc));
}
function chordName(rootName, t){ return fmt(rootName) + t.sym; }

/* ---------- Structure (SVG) ---------- */
function structureSVG(ch){
  const W=320, H=150, x0=40, dx=80, yWhite=92, yBlack=38;
  const pts = ch.bits.split("").map((b,i)=>[x0+i*dx, b==="1"?yBlack:yWhite]);
  const color = `var(--c-${ch.color})`;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Structure : ${ch.bits.split("").map(b=>b==="1"?"noire":"blanche").join(", ")}">`;
  s += `<rect x="8" y="20" width="${W-16}" height="36" rx="6" fill="var(--lane-black)"/>`;
  s += `<rect x="8" y="74" width="${W-16}" height="36" rx="6" fill="var(--lane-white)" stroke="var(--line)"/>`;
  s += `<text x="${W-14}" y="16" text-anchor="end" font-size="10" fill="var(--muted)" font-family="Figtree, sans-serif">touches noires</text>`;
  s += `<text x="${W-14}" y="124" text-anchor="end" font-size="10" fill="var(--muted)" font-family="Figtree, sans-serif">touches blanches</text>`;
  s += `<polyline points="${pts.map(p=>p.join(",")).join(" ")}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  ch.marks.forEach(i=>{
    const [x,y] = pts[i];
    s += `<line x1="${x}" y1="${y+10}" x2="${x}" y2="${y+22}" stroke="var(--ink)" stroke-width="1.5"/>`;
    s += `<text x="${x}" y="${y+42}" text-anchor="middle" font-size="18" font-weight="600" fill="var(--ink)" font-family="Sora, sans-serif">${fmt(ch.notes[i])}</text>`;
  });
  return s + `</svg>`;
}

/* ---------- Éléments ---------- */
const $ = id => document.getElementById(id);
const el = {
  name:$("chordName"), alt:$("chordAlt"), notes:$("chordNotes"), structure:$("structure"), empty:$("emptyMsg"),
  counter:$("counter"),
  start:$("startBtn"), stop:$("stopBtn"), next:$("nextBtn"), hint:$("hint"),
  duration:$("duration"), perMinute:$("perMinute"), speedBox:$("speedBox"),
  modeAuto:$("modeAuto"), modeManual:$("modeManual"), notUS:$("notUS"), notFR:$("notFR"),
  showName:$("showName"), showNotes:$("showNotes"), showStructure:$("showStructure")
};

let current = CHORDS.find(c=>c.key==="Db|min");
let count = 0;
let revealed = false;

function render(){
  const ch = current;
  const hasChord = !!ch;
  // Pas d'accord : on masque le contenu sans le retirer, pour garder les mêmes hauteurs
  el.empty.hidden = hasChord;
  $("chord").classList.toggle("is-empty", !hasChord);
  if (!hasChord) return;

  const nameVisible = state.showName || revealed;
  const cls = !nameVisible ? " hidden-name" : (revealed && !state.showName ? " revealed" : "");
  el.name.className = "chord-name" + cls;
  el.alt.className = "chord-alt" + (cls===" revealed" ? " revealed" : "");
  el.name.textContent = nameVisible ? chordName(ch.root.main, ch.type) : "?";
  el.alt.textContent = nameVisible && ch.root.alt ? chordName(ch.root.alt, ch.type) : "\u00a0";

  el.notes.innerHTML = `<div class="notes-line">${ch.notes.map(fmt).join(" – ")}</div>` +
    `<div class="notes-line alt">${ch.altNotes ? ch.altNotes.map(fmt).join(" – ") : "&nbsp;"}</div>`;
  el.notes.classList.toggle("is-concealed", !state.showNotes);

  el.structure.innerHTML = structureSVG(ch);
  el.structure.classList.toggle("is-concealed", !state.showStructure);
}

function pool(){ return CHORDS.filter(c=>state.types[c.type.id] && state.roots[c.root.id]); }
function pickNext(){
  const p = pool();
  if (!p.length){ current = null; return false; }
  let choice = p[Math.floor(Math.random()*p.length)];
  if (p.length>1) while (current && choice.key===current.key) choice = p[Math.floor(Math.random()*p.length)];
  current = choice; revealed = false; count++;
  el.counter.textContent = "Accord n° " + count;
  return true;
}

/* ---------- Défilement ---------- */
const REVEAL_MS = 1000;
let running = false, phase = "show", phaseStart = 0, phaseDur = 0, raf = 0, manualTimer = 0;

function beginShow(){
  if (!pickNext()){ stop(); render(); return; }
  phase = "show"; phaseStart = performance.now(); phaseDur = state.duration*1000;
  render();
}
function tick(now){
  if (!running) return;
  const f = (now - phaseStart)/phaseDur;
  if (f >= 1){
    if (phase==="show" && !state.showName){
      phase = "reveal"; phaseStart = now; phaseDur = REVEAL_MS; revealed = true; render();
    } else {
      beginShow();
    }
  }
  raf = requestAnimationFrame(tick);
}
function start(){
  if (running) return;
  if (!pool().length){ current=null; render(); return; }
  running = true; updateButtons();
  beginShow();
  raf = requestAnimationFrame(tick);
}
function stop(){
  running = false; cancelAnimationFrame(raf); updateButtons();
}
function manualNext(){
  if (manualTimer) return;
  // En manuel, si le nom est masqué et pas encore révélé : on le montre 1 s puis on passe au suivant
  if (current && !state.showName && !revealed && count>0){
    revealed = true; render();
    el.next.disabled = true;
    manualTimer = setTimeout(()=>{ manualTimer=0; el.next.disabled=false; if(!pickNext()) current=null; render(); }, REVEAL_MS);
    return;
  }
  if (!pickNext()) current = null;
  render();
}
function updateButtons(){
  const auto = state.mode==="auto";
  el.start.hidden = !auto; el.stop.hidden = !auto; el.next.hidden = auto;
  el.start.disabled = running; el.stop.disabled = !running;
  el.speedBox.style.opacity = auto ? "1" : ".45";
  el.duration.disabled = el.perMinute.disabled = !auto;
  el.hint.innerHTML = auto
    ? "<kbd>Espace</kbd> démarrer / arrêter"
    : "<kbd>Espace</kbd> ou <kbd>→</kbd> accord suivant";
}

/* ---------- Réglages ---------- */
function save(){ try{ localStorage.setItem("defilementAccords", JSON.stringify(state)); }catch(e){} }
function load(){
  try{
    const s = JSON.parse(localStorage.getItem("defilementAccords")||"null");
    if (s && typeof s==="object"){
      ["mode","duration","notation","showName","showNotes","showStructure"].forEach(k=>{ if (k in s) state[k]=s[k]; });
      if (s.types) Object.assign(state.types, s.types);
      if (s.roots) Object.assign(state.roots, s.roots);
    }
  }catch(e){}
}
const round1 = v => Math.round(v*10)/10;

function buildLists(){
  $("typeList").innerHTML = TYPES.map(t=>
    `<label class="check"><input type="checkbox" id="type-${t.id}" data-type="${t.id}"> ${t.label} <small>${t.sym}</small></label>`).join("");
  // Naturelles à gauche, altérées à droite, comme sur la maquette
  const naturals = ROOTS.filter(r=>r.main.length===1), altered = ROOTS.filter(r=>r.main.length>1);
  const rows = Math.max(naturals.length, altered.length);
  let html = "";
  for (let i=0;i<rows;i++){
    [naturals[i], altered[i]].forEach(r=>{
      html += r ? `<label class="check"><input type="checkbox" id="root-${r.id}" data-root="${r.id}"> <span data-rootlabel="${r.id}"></span></label>` : `<span></span>`;
    });
  }
  $("rootList").innerHTML = html;
}
function rootLabel(r){
  if (ROOT_LABEL[r.id]){
    const [a,b] = ROOT_LABEL[r.id].split("/");
    const conv = s => fmt(s.replace("♯","#").replace("♭","b"));
    return conv(a)+" / "+conv(b);
  }
  return fmt(r.main);
}
function syncInputs(){
  TYPES.forEach(t=>$("type-"+t.id).checked = !!state.types[t.id]);
  ROOTS.forEach(r=>{ $("root-"+r.id).checked = !!state.roots[r.id]; document.querySelector(`[data-rootlabel="${r.id}"]`).textContent = rootLabel(r); });
  el.duration.value = state.duration;
  el.perMinute.value = round1(60/state.duration);
  el.modeAuto.setAttribute("aria-pressed", state.mode==="auto");
  el.modeManual.setAttribute("aria-pressed", state.mode==="manual");
  el.notUS.setAttribute("aria-pressed", state.notation==="us");
  el.notFR.setAttribute("aria-pressed", state.notation==="fr");
  el.showName.checked = state.showName; el.showNotes.checked = state.showNotes; el.showStructure.checked = state.showStructure;
}

function bind(){
  document.addEventListener("change", e=>{
    const t = e.target;
    if (t.dataset.type){ state.types[t.dataset.type] = t.checked; }
    else if (t.dataset.root){ state.roots[t.dataset.root] = t.checked; }
    else if (t===el.showName){ state.showName = t.checked; }
    else if (t===el.showNotes){ state.showNotes = t.checked; }
    else if (t===el.showStructure){ state.showStructure = t.checked; }
    else return;
    save();
    if (!current && pool().length && !running && count>0) pickNext();
    render();
  });
  el.duration.addEventListener("input", ()=>{
    const v = parseFloat(el.duration.value.replace(",", "."));
    if (v>=0.5 && v<=600){ state.duration = v; el.perMinute.value = round1(60/v); save(); }
  });
  el.perMinute.addEventListener("input", ()=>{
    const v = parseFloat(el.perMinute.value.replace(",", "."));
    if (v>=0.1 && v<=120){ state.duration = round1(60/v) || 0.5; el.duration.value = state.duration; save(); }
  });
  [el.duration, el.perMinute].forEach(i=>i.addEventListener("change", syncInputs));

  el.modeAuto.addEventListener("click", ()=>{ state.mode="auto"; save(); syncInputs(); updateButtons(); });
  el.modeManual.addEventListener("click", ()=>{ stop(); state.mode="manual"; save(); syncInputs(); updateButtons(); });
  el.notUS.addEventListener("click", ()=>{ state.notation="us"; save(); syncInputs(); render(); });
  el.notFR.addEventListener("click", ()=>{ state.notation="fr"; save(); syncInputs(); render(); });
  $("rootsAll").addEventListener("click", ()=>{ ROOTS.forEach(r=>state.roots[r.id]=true); save(); syncInputs(); render(); });
  $("rootsNone").addEventListener("click", ()=>{ ROOTS.forEach(r=>state.roots[r.id]=false); save(); syncInputs(); render(); });

  el.start.addEventListener("click", start);
  el.stop.addEventListener("click", stop);
  el.next.addEventListener("click", manualNext);

  document.addEventListener("keydown", e=>{
    if (e.target.closest && e.target.closest("input,select,textarea,button")) return;
    if (e.code==="Space"){ e.preventDefault(); if (state.mode==="auto") (running?stop:start)(); else manualNext(); }
    else if (e.code==="ArrowRight" && state.mode==="manual"){ manualNext(); }
  });
}

load();
buildLists();
syncInputs();
bind();
updateButtons();
render();
})();
