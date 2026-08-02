import{bE as e,bF as t,bG as n,bH as o,bI as r}from"./breadCrumb.js";
/*!
 * (C) Ionic http://ionicframework.com - MIT License
 */const s=()=>{const s=window;s.addEventListener("statusTap",()=>{e(()=>{const e=s.innerWidth,a=s.innerHeight,i=document.elementFromPoint(e/2,a/2);if(!i)return;const d=t(i);d&&new Promise(e=>n(d,e)).then(()=>{o(async()=>{d.style.setProperty("--overflow","hidden"),await r(d,300),d.style.removeProperty("--overflow")})})})})};export{s as startStatusTap};