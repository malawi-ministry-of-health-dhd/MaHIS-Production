import{p as T,aV as v,w as R,y as S,a_ as A,q as P,G as C,F as l,D as a,E as d,aq as L,ay as N,g as $}from"./vendor-CJyWLCaR.js";import{G as B}from"./GoBack-YvkFnx-E.js";import{f as h,T as D,g as I}from"../index-DYuBP6qr.js";import{R as x}from"./ReusableDataTable-B-QLFbAB.js";import{H as n,i as s,P as m,d as F,j as H,_ as O}from"./encounter_type-CgEsP7vZ.js";import U from"./CPR-CQt1Z817.js";import{s as V}from"./pinia-CX8xOlAJ.js";import{u as k}from"./useAETCStageRealtime-Dhj8V7Zs.js";const E=T({__name:"TriageList",setup(G){const o=$([]),u=v(),b=["Visit Number","First Name","Last Name","Arrival Time","WaitingTime","Aggregate","Registered By","Action"],p={responsive:!0,ordering:!1,buttons:[]},r=h(),{AETCTriageList:c}=V(r),e=()=>{o.value=c.value.map(t=>[t.visit_number,t.given_name,t.family_name,n.toStandardHisTimeFormat(t.arrival_time),n.waitingTime(t.latest_encounter_time),n.waitingTime(t.arrival_time),t.last_encounter_creator,_({identifier:t?.identifier,ID:t?.identifier,patient_id:t?.patient_id})])},{setupStageRealtimeUpdates:f,teardownStageRealtimeUpdates:g}=k({onUpdated:e}),_=t=>`
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
    `,y={"redirection-btn":async t=>{await m.getPatient(t),u.push("/aetc/triage")},"abscond-btn":async t=>{if(await H("Are you sure you want to abscond?")){await I(t);const i=`${t?.identifier||t?.ID||""}`.trim();i&&(r.removeFromAllRealtimeStageLists(i),e())}},"print-btn":t=>{console.log("🚀 ~ print data:",t)},"cpr-btn":async t=>{await m.getPatient(t),F(U,{class:"medium-modal"})}};return R(c,()=>{e()},{deep:!0}),S(async()=>{e(),await f()}),A(()=>{g()}),(t,i)=>(P(),C(d(N),null,{default:l(()=>[a(D),a(d(L),{fullscreen:!0},{default:l(()=>[a(B,{title:"Patients waiting for Triage"}),a(x,{headers:b,data:o.value,options:p,actionHandlers:y},null,8,["data"])]),_:1})]),_:1}))}}),Q=O(E,[["__scopeId","data-v-969f682a"]]);export{Q as default};
