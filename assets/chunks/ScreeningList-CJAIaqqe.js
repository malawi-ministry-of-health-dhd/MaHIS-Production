import{p as S,aZ as v,w as T,y as R,b2 as A,q as B,G as C,F as c,D as a,E as l,as as L,aB as N,g as P}from"./vendor-CHp07Sex.js";import{G as $}from"./GoBack-B2pR6eZv.js";import{i as h,T as D,d as I}from"../index-FlpgkyEr.js";import{R as x}from"./ReusableDataTable-BDQBf-b8.js";import{H as d,i,f as m,d as F,l as H,_ as O}from"./encounter_type-BBRslAAq.js";import U from"./CPR-BINpNRl0.js";import{s as k}from"./pinia-CcG0qhHt.js";import{u as E}from"./useAETCStageRealtime-tbczxF5q.js";const G=S({__name:"ScreeningList",setup(J){const s=P([]),u=v(),b=["Visit Number","First Name","Last Name","Arrival Time","WaitingTime","Attended By","Action"],f={responsive:!0,ordering:!1,buttons:[]},o=h(),{AETCScreeningList:r}=k(o),e=()=>{s.value=r.value.map(t=>[t.visit_number,t.given_name,t.family_name,d.toStandardHisTimeFormat(t.arrival_time),d.waitingTime(t.latest_encounter_time),t.last_encounter_creator,_({identifier:t?.identifier,ID:t?.identifier,patient_id:t?.patient_id})])},{setupStageRealtimeUpdates:p,teardownStageRealtimeUpdates:g}=E({onUpdated:e}),_=t=>`
        <button class="btn btn-outline-danger btn-sm btn-table redirection-btn" 
                style="color:rgb(0, 100, 1)" 
                data-id='${JSON.stringify(t)}'>
            ${i.redirection}
        </button>
        <button class="btn btn-outline-danger btn-sm btn-table abscond-btn" 
                style="color: rgba(0, 0, 0, 0.54);" 
                data-id='${JSON.stringify(t)}'>
            ${i.abscond}
        </button>
        <button class="btn btn-outline-danger btn-sm btn-table cpr-btn" 
                style="color: red;" 
                data-id='${JSON.stringify(t)}'>
            ${i.cpr}
        </button>
    `,y={"redirection-btn":async t=>{await m.getPatient(t),u.push("/aetc/screening")},"abscond-btn":async t=>{if(await H("Are you sure you want to abscond?")){await I(t);const n=`${t?.identifier||t?.ID||""}`.trim();n&&(o.removeFromAllRealtimeStageLists(n),e())}},"cpr-btn":async t=>{await m.getPatient(t),F(U,{class:"medium-modal"})}};return T(r,()=>{e()},{deep:!0}),R(async()=>{e(),await p()}),A(()=>{g()}),(t,n)=>(B(),C(l(N),null,{default:c(()=>[a(D),a(l(L),{fullscreen:!0},{default:c(()=>[a($,{title:"Patients waiting for screening"}),a(x,{headers:b,data:s.value,options:f,actionHandlers:y},null,8,["data"])]),_:1})]),_:1}))}}),K=O(G,[["__scopeId","data-v-df9fab38"]]);export{K as default};
