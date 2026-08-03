import{bI as t,bJ as e,bK as n}from"../index-DY3JJRcS.js";
/*!
 * (C) Ionic http://ionicframework.com - MIT License
 */const r=(r,o,a,s,i)=>{const c=r.ownerDocument.defaultView;let d=t(r);const l=t=>d?-t.deltaX:t.deltaX;return e({el:r,gestureName:"goback-swipe",gesturePriority:101,threshold:10,canStart:e=>(d=t(r),(t=>{const{startX:e}=t;return d?e>=c.innerWidth-50:e<=50})(e)&&o()),onStart:a,onMove:t=>{const e=l(t);s(e/c.innerWidth)},onEnd:t=>{const e=l(t),r=c.innerWidth,o=e/r,a=(u=t,d?-u.velocityX:u.velocityX),s=a>=0&&(a>.2||e>r/2),h=(s?1-o:o)*r;var u;let b=0;if(h>5){const t=h/Math.abs(a);b=Math.min(t,540)}i(s,o<=0?.01:n(0,o,.9999),b)}})};export{r as createSwipeBackGesture};
