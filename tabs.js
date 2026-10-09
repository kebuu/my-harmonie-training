(function(){
"use strict";
const tabs = Array.from(document.querySelectorAll('[role="tab"]'));

function select(tab, focus){
  tabs.forEach(t=>{
    const on = t===tab;
    t.setAttribute("aria-selected", on);
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  });
  if (focus) tab.focus();
  try{ history.replaceState(null, "", "#" + tab.id.replace(/^tab-/, "")); }catch(e){}
}

tabs.forEach((t,i)=>{
  t.addEventListener("click", ()=>select(t));
  t.addEventListener("keydown", e=>{
    const d = e.key==="ArrowRight" ? 1 : e.key==="ArrowLeft" ? -1 : 0;
    if (d){ e.preventDefault(); select(tabs[(i+d+tabs.length)%tabs.length], true); }
  });
});

select(tabs.find(t=>"#"+t.id.replace(/^tab-/, "")===location.hash) || tabs[0]);
})();
