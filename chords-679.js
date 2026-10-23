(function(){
"use strict";
const {LETTERS, NATURAL, LATIN, ROOTS, ROOT_LABEL, SIMPLE, SIMPLE_SHARP, parseNote, pc} = window.Theory;

/* ---------- Données ---------- */
const TYPES = [
  {id:"maj", label:"Majeur",  sym:""},
  {id:"min", label:"Mineur",  sym:"m"}
];
// semi = demi-tons depuis la fondamentale, degree = écart de lettres (sixte = 5, septième = 6, neuvième = 1)
const TARGETS = [
  {id:"sixth",   label:"Sixte",            sym:"6",  semi:9,  degree:5},
  {id:"seventh", label:"Septième",         sym:"7",  semi:10, degree:6},
  {id:"maj7",    label:"Septième majeure", sym:"Δ7", semi:11, degree:6},
  {id:"ninth",   label:"Neuvième",         sym:"9",  semi:2,  degree:1}
];
const REVEAL_MS = 1500;
const FEEDBACK_MS = 800;

const CHORDS = [];
ROOTS.forEach(r=>TYPES.forEach(t=>CHORDS.push({key:r.id+"|"+t.id, root:r, type:t})));

const state = {
  duration:4, notation:"us", target:"sixth", mode:"reveal",
  roots:Object.fromEntries(ROOTS.map(r=>[r.id,true]))
};

/* ---------- Théorie ---------- */
function noteAt(root, target){
  const r = parseNote(root);
  const letter = LETTERS[(LETTERS.indexOf(r.letter) + target.degree) % 7];
  const pcTarget = (pc(root) + target.semi) % 12;
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
const targetDef = () => TARGETS.find(t=>t.id===state.target);
const chordName = ch => fmt(ch.root.main) + ch.type.sym;

/* ---------- Éléments ---------- */
const $ = id => document.getElementById(id);
const el = {
  panel:$("panel-chords-679"), chord:$("eChord"), name:$("eName"), target:$("eTarget"), answer:$("eAnswer"),
  empty:$("eEmpty"), counter:$("eCounter"), start:$("eStart"), stop:$("eStop"), next:$("eNext"),
  duration:$("eDuration"), perMinute:$("ePerMinute"), notUS:$("eNotUS"), notFR:$("eNotFR"),
  pad:$("eNotePad"), modeReveal:$("eModeReveal"), modeQuiz:$("eModeQuiz")
};

let current = CHORDS.find(c=>c.key==="Db|min");
let count = 0;
let revealed = false;
let picked = null; // pitch class cliqué (mode « Réponse »), null tant que l'utilisateur n'a pas répondu
let timedOut = false;
const isQuiz = () => state.mode==="quiz";

function renderPad(){
  el.pad.hidden = !isQuiz();
  const answered = picked!==null || timedOut;
  const good = current ? pc(noteAt(current.root.main, targetDef())) : -1;
  el.pad.querySelectorAll(".note-btn").forEach(b=>{
    const p = +b.dataset.pc;
    b.textContent = fmt(SIMPLE[p]);
    b.disabled = !current || answered;
    b.classList.toggle("is-correct", answered && p===good);
    b.classList.toggle("is-wrong", picked!==null && p===picked && p!==good);
  });
}

function render(){
  const ch = current;
  el.empty.hidden = !!ch;
  el.chord.classList.toggle("is-empty", !ch);
  if (!ch) return;
  const t = targetDef();
  el.name.textContent = chordName(ch);
  el.target.textContent = "Trouver la " + t.label.toLowerCase() + " (" + t.sym + ")";
  el.answer.textContent = fmt(noteAt(ch.root.main, t));
  el.answer.classList.toggle("is-concealed", !revealed || isQuiz());
  renderPad();
}

function pool(){ return CHORDS.filter(c=>state.roots[c.root.id]); }
function pickNext(){
  const p = pool();
  if (!p.length){ current = null; return false; }
  let choice = p[Math.floor(Math.random()*p.length)];
  if (p.length>1) while (current && choice.key===current.key) choice = p[Math.floor(Math.random()*p.length)];
  current = choice; revealed = false; picked = null; timedOut = false; count++;
  el.counter.textContent = "Accord n° " + count;
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
    if (phase==="show"){
      phase = "reveal"; phaseStart = now; phaseDur = REVEAL_MS; revealed = true;
      if (picked===null) timedOut = true;
      render();
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
// Passe tout de suite à l'accord suivant (et relance le minuteur si le défilement tourne)
function skip(){
  if (running) return beginShow();
  if (!pickNext()) current = null;
  render();
}
// Réponse de l'utilisateur : feedback immédiat, puis accord suivant sans attendre la fin du temps imparti
function answer(p){
  if (!current || picked!==null || timedOut) return;
  picked = p;
  if (running){ phase = "reveal"; phaseStart = performance.now(); phaseDur = FEEDBACK_MS; }
  render();
}
function updateButtons(){
  el.start.disabled = running; el.stop.disabled = !running;
}

/* ---------- Réglages ---------- */
const KEY = "defilementChords679";
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} }
function load(){
  try{
    const s = JSON.parse(localStorage.getItem(KEY)||"null");
    if (s && typeof s==="object"){
      if (typeof s.duration==="number") state.duration = s.duration;
      if (s.notation==="us" || s.notation==="fr") state.notation = s.notation;
      if (TARGETS.some(t=>t.id===s.target)) state.target = s.target;
      if (s.mode==="reveal" || s.mode==="quiz") state.mode = s.mode;
      if (s.roots) Object.assign(state.roots, s.roots);
    }
  }catch(e){}
}
const round1 = v => Math.round(v*10)/10;

function buildLists(){
  $("eTargetList").innerHTML = TARGETS.map(t=>
    `<label class="check"><input type="radio" name="eTargetRadio" value="${t.id}"> ${t.label} <small>${t.sym}</small></label>`).join("");
  // Naturelles à gauche, altérées à droite
  const naturals = ROOTS.filter(r=>r.main.length===1), altered = ROOTS.filter(r=>r.main.length>1);
  let html = "";
  for (let i=0;i<Math.max(naturals.length, altered.length);i++){
    [naturals[i], altered[i]].forEach(r=>{
      html += r ? `<label class="check"><input type="checkbox" data-eroot="${r.id}"> <span data-erootlabel="${r.id}"></span></label>` : `<span></span>`;
    });
  }
  $("eRootList").innerHTML = html;
  el.pad.innerHTML = SIMPLE.map((_, p)=>`<button type="button" class="note-btn" data-pc="${p}"></button>`).join("");
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
    el.panel.querySelector(`[data-eroot="${r.id}"]`).checked = !!state.roots[r.id];
    el.panel.querySelector(`[data-erootlabel="${r.id}"]`).textContent = rootLabel(r);
  });
  el.panel.querySelector(`input[name="eTargetRadio"][value="${state.target}"]`).checked = true;
  el.duration.value = state.duration;
  el.perMinute.value = round1(60/state.duration);
  el.notUS.setAttribute("aria-pressed", state.notation==="us");
  el.notFR.setAttribute("aria-pressed", state.notation==="fr");
  el.modeReveal.setAttribute("aria-pressed", !isQuiz());
  el.modeQuiz.setAttribute("aria-pressed", isQuiz());
}

function bind(){
  el.panel.addEventListener("change", e=>{
    const t = e.target;
    if (t.dataset.eroot){ state.roots[t.dataset.eroot] = t.checked; }
    else if (t.name==="eTargetRadio"){ state.target = t.value; }
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
  el.modeReveal.addEventListener("click", ()=>{ state.mode="reveal"; save(); syncInputs(); render(); });
  el.modeQuiz.addEventListener("click", ()=>{ state.mode="quiz"; save(); syncInputs(); render(); });
  el.pad.addEventListener("click", e=>{
    const b = e.target.closest(".note-btn");
    if (b) answer(+b.dataset.pc);
  });
  $("eRootsAll").addEventListener("click", ()=>{ ROOTS.forEach(r=>state.roots[r.id]=true); save(); syncInputs(); render(); });
  $("eRootsNone").addEventListener("click", ()=>{ ROOTS.forEach(r=>state.roots[r.id]=false); save(); syncInputs(); render(); });

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
