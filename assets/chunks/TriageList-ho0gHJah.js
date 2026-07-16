import{p as y,aV as v,w as R,y as S,a_ as A,q as C,G as L,F as l,D as a,E as d,aq as N,az as P,g as $}from"./vendor-D1XE4Z2z.js";import{G as B}from"./GoBack-Sey7YoYn.js";import{i as h,T as D,d as I}from"../index-mb5tQ4Jh.js";import{R as k}from"./ReusableDataTable-Chsk8qaR.js";import{H as n,i as s,f as m,d as x,k as F,_ as H}from"./encounter_type-b7BWJRgy.js";import O from"./CPR-CFDUEDON.js";import{s as U}from"./pinia-C0wRDVrA.js";import{u as V}from"./useAETCStageRealtime-DUdBrPpa.js";const E=y({__name:"TriageList",setup(G){const o=$([]),u=v(),b=["Visit Number","First Name","Last Name","Arrival Time","WaitingTime","Aggregate","Registered By","Action"],p={responsive:!0,ordering:!1,buttons:[]},r=h(),{AETCTriageList:c}=U(r),e=()=>{o.value=c.value.map(t=>[t.visit_number,t.given_name,t.family_name,n.toStandardHisTimeFormat(t.arrival_time),n.waitingTime(t.latest_encounter_time),n.waitingTime(t.arrival_time),t.last_encounter_creator,_({identifier:t?.identifier,ID:t?.identifier,patient_id:t?.patient_id})])},{setupStageRealtimeUpdates:f,teardownStageRealtimeUpdates:g}=V({onUpdated:e}),_=t=>`
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
    `,T={"redirection-btn":async t=>{await m.getPatient(t),u.push("/aetc/triage")},"abscond-btn":async t=>{if(await F("Are you sure you want to abscond?")){await I(t);const i=`${t?.identifier||t?.ID||""}`.trim();i&&(r.removeFromAllRealtimeStageLists(i),e())}},"print-btn":t=>{console.log("🚀 ~ print data:",t)},"cpr-btn":async t=>{await m.getPatient(t),x(O,{class:"medium-modal"})}};return R(c,()=>{e()},{deep:!0}),S(async()=>{e(),await f()}),A(()=>{g()}),(t,i)=>(C(),L(d(P),null,{default:l(()=>[a(D),a(d(N),{fullscreen:!0},{default:l(()=>[a(B,{title:"Patients waiting for Triage"}),a(k,{headers:b,data:o.value,options:p,actionHandlers:T},null,8,["data"])]),_:1})]),_:1}))}}),Q=H(E,[["__scopeId","data-v-969f682a"]]);export{Q as default};
