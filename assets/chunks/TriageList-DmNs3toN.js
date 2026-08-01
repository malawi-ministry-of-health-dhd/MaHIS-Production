import{d as y,a3 as v,M as R,B as S,b4 as A,c as L,w as c,a as l,G as P,L as B,o as C,e as a,V as N,a2 as $}from"./navigation-BglLrznb.js";import{G as h}from"./GoBack-Cltg5u1e.js";import{T as I}from"./Toolbar-ClmKF5AV.js";import{R as x}from"./ReusableDataTable-Cv5OA_au.js";import{i as n}from"./svg-COr7WdNJ.js";import{createModal as D,alertConfirmation as H}from"./Alerts-DIsW0NSB.js";import O from"./CPR-DQOjIzfy.js";import{P as d}from"./observation_service-B5YqcjVX.js";import{closeVisit as U}from"./visits_service-BaFFEi12.js";import{H as o}from"./service-DhdzE8sY.js";import{usePatientList as V}from"./patientListStore-BTW-n0J_.js";import{u as k}from"./useAETCStageRealtime-BvPd4BAQ.js";import{_ as F}from"./_plugin-vue_export-helper-DlAUqK2U.js";const G=y({__name:"TriageList",setup(J){const s=P([]),u=B(),b=["Visit Number","First Name","Last Name","Arrival Time","WaitingTime","Aggregate","Registered By","Action"],p={responsive:!0,ordering:!1,buttons:[]},r=V(),{AETCTriageList:m}=v(r),e=()=>{s.value=m.value.map(t=>[t.visit_number,t.given_name,t.family_name,o.toStandardHisTimeFormat(t.arrival_time),o.waitingTime(t.latest_encounter_time),o.waitingTime(t.arrival_time),t.last_encounter_creator,_({identifier:t?.identifier,ID:t?.identifier,patient_id:t?.patient_id})])},{setupStageRealtimeUpdates:f,teardownStageRealtimeUpdates:g}=k({onUpdated:e}),_=t=>`
        <button class="btn btn-outline-danger btn-sm btn-table redirection-btn" 
                style="color:rgb(0, 100, 1)" 
                data-id='${JSON.stringify(t)}'>
            ${n.redirection}
        </button>
        <button class="btn btn-outline-danger btn-sm btn-table abscond-btn"
                style="color: rgba(0, 0, 0, 0.54);" 
                data-id='${JSON.stringify(t)}'>
            ${n.abscond}
        </button>

        <button class="btn btn-outline-danger btn-sm btn-table cpr-btn" 
                style="color: red;" 
                data-id='${JSON.stringify(t)}'>
            ${n.cpr}
        </button>
    `,T={"redirection-btn":async t=>{await d.getPatient(t),u.push("/aetc/triage")},"abscond-btn":async t=>{if(await H("Are you sure you want to abscond?")){await U(t);const i=`${t?.identifier||t?.ID||""}`.trim();i&&(r.removeFromAllRealtimeStageLists(i),e())}},"print-btn":t=>{console.log("🚀 ~ print data:",t)},"cpr-btn":async t=>{await d.getPatient(t),D(O,{class:"medium-modal"})}};return R(m,()=>{e()},{deep:!0}),S(async()=>{e(),await f()}),A(()=>{g()}),(t,i)=>(C(),L(l($),null,{default:c(()=>[a(I),a(l(N),{fullscreen:!0},{default:c(()=>[a(h,{title:"Patients waiting for Triage"}),a(x,{headers:b,data:s.value,options:p,actionHandlers:T},null,8,["data"])]),_:1})]),_:1}))}}),et=F(G,[["__scopeId","data-v-969f682a"]]);export{et as default};
