import{bX as s,bY as r,bZ as a,b_ as i,b$ as m}from"./navigation-BglLrznb.js";/*!
 * (C) Ionic http://ionicframework.com - MIT License
 */const d=()=>{const e=window;e.addEventListener("statusTap",(()=>{s((()=>{const n=document.elementFromPoint(e.innerWidth/2,e.innerHeight/2);if(!n)return;const t=r(n);t&&new Promise((o=>a(t,o))).then((()=>{i((async()=>{t.style.setProperty("--overflow","hidden"),await m(t,300),t.style.removeProperty("--overflow")}))}))}))}))};export{d as startStatusTap};
