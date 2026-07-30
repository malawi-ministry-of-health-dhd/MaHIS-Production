import{p as y,aZ as v,w as R,y as S,b2 as A,q as B,G as C,F as l,D as a,E as d,as as L,aB as N,g as P}from"./vendor-CHp07Sex.js";import{G as $}from"./GoBack-BMGoAsBi.js";import{i as h,T as D,d as I}from"../index-DYFIwsBJ.js";import{R as x}from"./ReusableDataTable-B_xSE5lL.js";import{H as n,i as s,f as m,d as F,l as H,_ as O}from"./encounter_type-B47EfQCH.js";import U from"./CPR-gzHkNaVg.js";import{s as k}from"./pinia-CcG0qhHt.js";import{u as E}from"./useAETCStageRealtime-BB5nXEJX.js";const G=y({__name:"TriageList",setup(J){const o=P([]),u=v(),b=["Visit Number","First Name","Last Name","Arrival Time","WaitingTime","Aggregate","Registered By","Action"],p={responsive:!0,ordering:!1,buttons:[]},r=h(),{AETCTriageList:c}=k(r),e=()=>{o.value=c.value.map(t=>[t.visit_number,t.given_name,t.family_name,n.toStandardHisTimeFormat(t.arrival_time),n.waitingTime(t.latest_encounter_time),n.waitingTime(t.arrival_time),t.last_encounter_creator,_({identifier:t?.identifier,ID:t?.identifier,patient_id:t?.patient_id})])},{setupStageRealtimeUpdates:f,teardownStageRealtimeUpdates:g}=E({onUpdated:e}),_=t=>`
        <button class="btn btn-outline-danger btn-sm btn-table redirection-btn" 
                style="color:rgb(0, 100, 1)" 
                data-id='${JSON.stringify(t)}'>
            ${s.redirection}
        </button>
        <button class="btn btn-outline-danger btn-sm btn-table abscond-btn"
                style="color: rgba(0, 0, 0, 0.54);" 
                data-id='${JSON.stringify(t)}'>
            ${s.abscond}
        </button>

        <button class="btn btn-outline-danger btn-sm btn-table cpr-btn" 
                style="color: red;" 
                data-id='${JSON.stringify(t)}'>
            ${s.cpr}
        </button>
    `,T={"redirection-btn":async t=>{await m.getPatient(t),u.push("/aetc/triage")},"abscond-btn":async t=>{if(await H("Are you sure you want to abscond?")){await I(t);const i=`${t?.identifier||t?.ID||""}`.trim();i&&(r.removeFromAllRealtimeStageLists(i),e())}},"print-btn":t=>{console.log("🚀 ~ print data:",t)},"cpr-btn":async t=>{await m.getPatient(t),F(U,{class:"medium-modal"})}};return R(c,()=>{e()},{deep:!0}),S(async()=>{e(),await f()}),A(()=>{g()}),(t,i)=>(B(),C(d(N),null,{default:l(()=>[a(D),a(d(L),{fullscreen:!0},{default:l(()=>[a($,{title:"Patients waiting for Triage"}),a(x,{headers:b,data:o.value,options:p,actionHandlers:T},null,8,["data"])]),_:1})]),_:1}))}}),K=O(G,[["__scopeId","data-v-969f682a"]]);export{K as default};
