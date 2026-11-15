(function(){
"use strict";
const {LETTERS, NATURAL, LATIN, ROOTS, ROOT_LABEL, SIMPLE, SIMPLE_SHARP, parseNote, pc} = window.Theory;

/* ---------- Données ---------- */
const TYPES = [
  {id:"maj", label:"Majeur",  spoken:"majeur", sym:""},
  {id:"min", label:"Mineur",  spoken:"mineur", sym:"m"}
];
// semi = demi-tons depuis la fondamentale, degree = écart de lettres (sixte = 5, septième = 6, neuvième = 1)
const TARGETS = [
  {id:"sixth",   label:"Sixte",            spoken:"sixte",           sym:"6",  semi:9,  degree:5},
  {id:"seventh", label:"Septième",         spoken:"septième",         sym:"7",  semi:10, degree:6},
  {id:"maj7",    label:"Septième majeure", spoken:"septième majeure", sym:"Δ7", semi:11, degree:6},
  {id:"ninth",   label:"Neuvième",         spoken:"neuvième",         sym:"9",  semi:2,  degree:1}
];
const REVEAL_MS = 1500;
const FEEDBACK_MS = 800;

const CHORDS = [];
ROOTS.forEach(r=>TYPES.forEach(t=>CHORDS.push({key:r.id+"|"+t.id, root:r, type:t})));

const state = {
  duration:4, notation:"us", target:"sixth", mode:"reveal", voice:false, score:{ok:0, total:0},
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
  pad:$("eNotePad"), score:$("eScore"), scoreText:$("eScoreText"), modeReveal:$("eModeReveal"), modeQuiz:$("eModeQuiz"),
  voice:$("eVoice"), voiceMsg:$("eVoiceMsg"), heard:$("eHeard")
};

let current = CHORDS.find(c=>c.key==="Db|min");
let count = 0;
let revealed = false;
let picked = null; // pitch class cliqué (mode « Réponse »), null tant que l'utilisateur n'a pas répondu
let timedOut = false;
const isQuiz = () => state.mode==="quiz";

function renderScore(){
  const {ok, total} = state.score;
  el.score.hidden = !isQuiz();
  el.scoreText.textContent = total
    ? "Réussite : " + Math.round(100*ok/total) + " % (" + ok + " / " + total + ")"
    : "Réussite : —";
}
function renderPad(){
  el.pad.hidden = !isQuiz();
  renderScore();
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
  setHeard("");
  el.counter.textContent = "Accord n° " + count;
  return true;
}

/* ---------- Voix (synthèse + reconnaissance) ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const TTS = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const VOICE_OK = !!SR && TTS;
const voice = () => VOICE_OK && state.voice;

const NOTE_WORDS = {
  0:["do","dos","deau","dot","dau"], 2:["re","ray","rey","rez","res"], 4:["mi","mie","mis","mit","my"],
  5:["fa","fat","fas","phat"], 7:["sol","sole","soul","sold"], 9:["la","las"], 11:["si","ci","cie","sis"]
};
// « sol dièse », « si bémol »… → classe de hauteur (0-11), ou null si aucune note reconnue
function parseSpoken(text){
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")
    .replace(/#|♯/g," diese ").replace(/♭/g," bemol ").replace(/[^a-z ]/g," ").replace(/\s+/g," ").trim();
  if (!t) return null;
  const tokens = t.split(" ");
  for (let i=0;i<tokens.length;i++){
    const hit = Object.keys(NOTE_WORDS).find(k=>NOTE_WORDS[k].includes(tokens[i]));
    if (hit===undefined) continue;
    const rest = tokens.slice(i+1);
    let acc = 0;
    if (rest.some(w=>w==="diese"||w==="dieze")) acc = 1;
    else if (rest.some(w=>w==="bemol"||w==="bemole")) acc = -1;
    return ((+hit + acc) % 12 + 12) % 12;
  }
  return null;
}
const spokenNote = n => { const p = parseNote(n); return LATIN[p.letter].toLowerCase() + (p.acc>0 ? " dièse" : p.acc<0 ? " bémol" : ""); };
const spokenSubject = ch => targetDef().spoken + " de " + spokenNote(ch.root.main) + " " + ch.type.spoken;
const questionText = ch => "Quelle est la " + spokenSubject(ch) + " ?";
const correctionText = ch => "La " + spokenSubject(ch) + " est " + spokenNote(noteAt(ch.root.main, targetDef())) + ".";

let speechId = 0, utterance = null;
function cancelSpeech(){
  speechId++;
  if (TTS) window.speechSynthesis.cancel();
}
// Dit le texte puis appelle onend (sauf si la parole a été annulée entre-temps)
function say(text, onend){
  const id = ++speechId;
  const done = () => { if (id===speechId && onend) onend(); };
  if (!TTS){ setTimeout(done, 0); return; }
  window.speechSynthesis.cancel();
  utterance = new SpeechSynthesisUtterance(text); // référence conservée : évite que le GC coupe l'événement « end »
  utterance.lang = "fr-FR";
  utterance.onend = done;
  utterance.onerror = done;
  window.speechSynthesis.speak(utterance);
}

let rec = null, listening = false;
function setVoiceMsg(msg){ el.voiceMsg.textContent = msg; }
function setHeard(txt){ el.heard.textContent = txt ? "Entendu : " + txt : ""; }
function startRec(){
  const r = new SR();
  r.lang = "fr-FR"; r.maxAlternatives = 5; r.interimResults = false; r.continuous = false;
  r.onresult = e=>{
    for (let i=e.resultIndex;i<e.results.length;i++){
      const res = e.results[i];
      setHeard(res[0].transcript);
      for (let a=0;a<res.length;a++){
        const p = parseSpoken(res[a].transcript);
        if (p!==null){ answer(p); return; }
      }
    }
  };
  r.onerror = e=>{
    if (e.error==="not-allowed" || e.error==="service-not-allowed"){
      listening = false; setVoiceMsg("Micro refusé : réponse au clic uniquement.");
    } else if (e.error==="network" || e.error==="audio-capture"){
      listening = false; setVoiceMsg("Micro ou reconnaissance indisponible : réponse au clic uniquement.");
    }
  };
  // La reconnaissance s'arrête d'elle-même après un silence : on la relance tant que la question est ouverte
  r.onend = ()=>{ if (rec===r && listening && picked===null && !timedOut){ try{ startRec(); }catch(err){} } };
  rec = r;
  try{ r.start(); }catch(err){}
}
function listen(){
  if (!voice() || !isQuiz()) return;
  stopListening();
  listening = true; startRec();
}
function stopListening(){
  listening = false;
  if (rec){ const r = rec; rec = null; try{ r.abort(); }catch(err){} }
}
function stopVoice(){ cancelSpeech(); stopListening(); }

/* ---------- Défilement ---------- */
let running = false, phase = "show", phaseStart = 0, phaseDur = 0, raf = 0;

function beginShow(){
  stopVoice();
  if (!pickNext()){ stop(); render(); return; }
  render();
  if (!voice()){
    phase = "show"; phaseStart = performance.now(); phaseDur = state.duration*1000;
    return;
  }
  // Le temps imparti ne commence qu'une fois la question entièrement dite
  phase = "speak";
  say(questionText(current), ()=>{
    if (!running) return;
    phase = "show"; phaseStart = performance.now(); phaseDur = state.duration*1000;
    listen();
  });
}
function tick(now){
  if (!running) return;
  if (phase!=="speak" && (now - phaseStart)/phaseDur >= 1){
    if (phase==="show"){
      revealed = true;
      if (picked===null){ timedOut = true; if (isQuiz()){ state.score.total++; save(); } }
      render();
      if (voice()){
        // Annonce la bonne réponse, puis question suivante dès la fin de l'annonce
        stopListening(); phase = "speak";
        say(correctionText(current), ()=>{ if (running) beginShow(); });
      } else {
        phase = "reveal"; phaseStart = now; phaseDur = REVEAL_MS;
      }
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
  running = false; cancelAnimationFrame(raf); stopVoice(); updateButtons();
}
// Passe tout de suite à l'accord suivant (et relance le minuteur si le défilement tourne)
function skip(){
  if (running) return beginShow();
  stopVoice();
  if (!pickNext()) current = null;
  render();
  if (voice() && current) say(questionText(current), isQuiz() ? listen : null);
}
// Réponse de l'utilisateur : feedback immédiat, puis accord suivant sans attendre la fin du temps imparti
function answer(p){
  if (!current || picked!==null || timedOut) return;
  stopListening();
  picked = p;
  const good = p===pc(noteAt(current.root.main, targetDef()));
  state.score.total++;
  if (good) state.score.ok++;
  save();
  if (voice() && !good){
    // Mauvaise réponse : annonce la bonne, puis question suivante sans attendre la fin du temps
    if (running) phase = "speak";
    render();
    say(correctionText(current), ()=>{ if (running) beginShow(); });
    return;
  }
  if (voice()) cancelSpeech();
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
      if (typeof s.voice==="boolean") state.voice = s.voice;
      if (s.score && s.score.total>=s.score.ok && s.score.ok>=0) state.score = {ok:s.score.ok, total:s.score.total};
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
  el.voice.checked = voice();
  el.voice.disabled = !VOICE_OK;
  if (!VOICE_OK) setVoiceMsg("Navigateur non compatible (reconnaissance vocale indisponible) : essayez Chrome ou Edge.");
}

function bind(){
  el.panel.addEventListener("change", e=>{
    const t = e.target;
    if (t.dataset.eroot){ state.roots[t.dataset.eroot] = t.checked; }
    else if (t.name==="eTargetRadio"){ state.target = t.value; }
    else if (t===el.voice){
      state.voice = t.checked; setVoiceMsg(""); setHeard("");
      if (!state.voice) stopVoice();
    }
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
  $("eScoreReset").addEventListener("click", ()=>{ state.score = {ok:0, total:0}; save(); renderScore(); });
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
