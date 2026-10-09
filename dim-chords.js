(function(){
"use strict";
const {LETTERS, NATURAL, LATIN, ROOTS, ROOT_LABEL, SIMPLE, SIMPLE_SHARP, parseNote, pc} = window.Theory;

/* ---------- Données ---------- */
// Les trois autres notes de l'accord diminué : tierce mineure, quarte augmentée, sixte majeure
// (semi = demi-tons depuis la note, degree = écart de lettres). Ex. C → Eb, F#, A.
const OTHERS = [
  {semi:3, degree:2},
  {semi:6, degree:3},
  {semi:9, degree:5}
];
const REVEAL_MS = 2000;

const state = {
  duration:4, notation:"us", showCorrection:true,
  roots:Object.fromEntries(ROOTS.map(r=>[r.id,true]))
};

/* ---------- Théorie ---------- */
function noteAt(root, o){
  const r = parseNote(root);
  const letter = LETTERS[(LETTERS.indexOf(r.letter) + o.degree) % 7];
  const pcTarget = (pc(root) + o.semi) % 12;
  let acc = pcTarget - NATURAL[letter];
  if (acc > 6) acc -= 12; if (acc < -6) acc += 12;
  let name = letter + (acc>0 ? "#".repeat(acc) : "b".repeat(-acc));
  // Pas de F♭, C♭, E♯, B♯ ni de doubles altérations
  if (Math.abs(acc)>1 || ["Fb","Cb","E#","B#"].includes(name)) name = (acc>0 ? SIMPLE_SHARP : SIMPLE)[pcTarget];
  return name;
}
function fmt(n){
  const p = parseNote(n);
  const base = state.notation==="fr" ? LATIN[p.letter] : p.letter;
  return base + (p.acc>0 ? "♯".repeat(p.acc) : "♭".repeat(-p.acc));
}
const othersOf = root => OTHERS.map(o=>noteAt(root, o));

/* ---------- Éléments ---------- */
const $ = id => document.getElementById(id);
const el = {
  panel:$("panel-dim-chords"), chord:$("dChord"), name:$("dName"), alt:$("dAlt"), answer:$("dAnswer"),
  empty:$("dEmpty"), counter:$("dCounter"), start:$("dStart"), stop:$("dStop"), next:$("dNext"),
  duration:$("dDuration"), perMinute:$("dPerMinute"), showCorrection:$("dShowCorrection"),
  notUS:$("dNotUS"), notFR:$("dNotFR")
};

let current = ROOTS.find(r=>r.id==="C");
let count = 0;
let revealed = false;

function render(){
  const r = current;
  el.empty.hidden = !!r;
  el.chord.classList.toggle("is-empty", !r);
  if (!r) return;
  el.name.textContent = fmt(r.main);
  el.alt.textContent = r.alt ? fmt(r.alt) : " ";
  el.answer.textContent = othersOf(r.main).map(fmt).join(" – ");
  el.answer.classList.toggle("is-concealed", !revealed);
}

function pool(){ return ROOTS.filter(r=>state.roots[r.id]); }
function pickNext(){
  const p = pool();
  if (!p.length){ current = null; return false; }
  let choice = p[Math.floor(Math.random()*p.length)];
  if (p.length>1) while (current && choice.id===current.id) choice = p[Math.floor(Math.random()*p.length)];
  current = choice; revealed = false; count++;
  el.counter.textContent = "Note n° " + count;
  return true;
}

/* ---------- Défilement ---------- */
let running = false, phase = "show", phaseStart = 0, phaseDur = 0, raf = 0;

function beginShow(){
  if (!pickNext()){ stop(); render(); return; }
  phase = "show"; phaseStart = performance.now(); phaseDur = state.duration*1000;
  render();
}
function tick(now){
  if (!running) return;
  if ((now - phaseStart)/phaseDur >= 1){
    if (phase==="show" && state.showCorrection){
      phase = "reveal"; phaseStart = now; phaseDur = REVEAL_MS; revealed = true; render();
    } else {
      beginShow();
    }
  }
  raf = requestAnimationFrame(tick);
}
function start(){
  if (running) return;
  if (!pool().length){ current = null; render(); return; }
  running = true; updateButtons();
  beginShow();
  raf = requestAnimationFrame(tick);
}
function stop(){
  running = false; cancelAnimationFrame(raf); updateButtons();
}
// Passe tout de suite à la note suivante (et relance le minuteur si le défilement tourne)
function skip(){
  if (running) return beginShow();
  if (!pickNext()) current = null;
  render();
}
function updateButtons(){
  el.start.disabled = running; el.stop.disabled = !running;
}

/* ---------- Réglages ---------- */
const KEY = "defilementDimChords";
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} }
function load(){
  try{
    const s = JSON.parse(localStorage.getItem(KEY)||"null");
    if (s && typeof s==="object"){
      if (typeof s.duration==="number") state.duration = s.duration;
      if (typeof s.showCorrection==="boolean") state.showCorrection = s.showCorrection;
      if (s.notation==="us" || s.notation==="fr") state.notation = s.notation;
      if (s.roots) Object.assign(state.roots, s.roots);
    }
  }catch(e){}
}
const round1 = v => Math.round(v*10)/10;

function buildLists(){
  // Naturelles à gauche, altérées à droite
  const naturals = ROOTS.filter(r=>r.main.length===1), altered = ROOTS.filter(r=>r.main.length>1);
  let html = "";
  for (let i=0;i<Math.max(naturals.length, altered.length);i++){
    [naturals[i], altered[i]].forEach(r=>{
      html += r ? `<label class="check"><input type="checkbox" data-droot="${r.id}"> <span data-drootlabel="${r.id}"></span></label>` : `<span></span>`;
    });
  }
  $("dRootList").innerHTML = html;
}
function rootLabel(r){
  if (ROOT_LABEL[r.id]){
    const conv = s => fmt(s.replace("♯","#").replace("♭","b"));
    return ROOT_LABEL[r.id].split("/").map(conv).join(" / ");
  }
  return fmt(r.main);
}
function syncInputs(){
  ROOTS.forEach(r=>{
    el.panel.querySelector(`[data-droot="${r.id}"]`).checked = !!state.roots[r.id];
    el.panel.querySelector(`[data-drootlabel="${r.id}"]`).textContent = rootLabel(r);
  });
  el.duration.value = state.duration;
  el.perMinute.value = round1(60/state.duration);
  el.showCorrection.checked = state.showCorrection;
  el.notUS.setAttribute("aria-pressed", state.notation==="us");
  el.notFR.setAttribute("aria-pressed", state.notation==="fr");
}

function bind(){
  el.panel.addEventListener("change", e=>{
    const t = e.target;
    if (t.dataset.droot){ state.roots[t.dataset.droot] = t.checked; }
    else if (t===el.showCorrection){ state.showCorrection = t.checked; }
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

  el.notUS.addEventListener("click", ()=>{ state.notation="us"; save(); syncInputs(); render(); });
  el.notFR.addEventListener("click", ()=>{ state.notation="fr"; save(); syncInputs(); render(); });
  $("dRootsAll").addEventListener("click", ()=>{ ROOTS.forEach(r=>state.roots[r.id]=true); save(); syncInputs(); render(); });
  $("dRootsNone").addEventListener("click", ()=>{ ROOTS.forEach(r=>state.roots[r.id]=false); save(); syncInputs(); render(); });

  el.start.addEventListener("click", start);
  el.stop.addEventListener("click", stop);
  el.next.addEventListener("click", skip);
  document.addEventListener("tabchange", stop);

  document.addEventListener("keydown", e=>{
    if (el.panel.hidden) return;
    if (e.target.closest && e.target.closest("input,select,textarea,button")) return;
    if (e.code==="Space"){ e.preventDefault(); (running?stop:start)(); }
    else if (e.code==="ArrowRight"){ skip(); }
  });
}

load();
buildLists();
syncInputs();
bind();
updateButtons();
render();
})();
