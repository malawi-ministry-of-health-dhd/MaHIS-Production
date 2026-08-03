import{bN as t,bO as e,bP as s,bQ as n,bR as o}from"../index-Bu28mEyu.js";
/*!
 * (C) Ionic http://ionicframework.com - MIT License
 */const r=()=>{const r=window;r.addEventListener("statusTap",()=>{t(()=>{const t=document.elementFromPoint(r.innerWidth/2,r.innerHeight/2);if(!t)return;const a=e(t);a&&new Promise(t=>s(a,t)).then(()=>{n(async()=>{a.style.setProperty("--overflow","hidden"),await o(a,300),a.style.removeProperty("--overflow")})})})})};export{r as startStatusTap};
