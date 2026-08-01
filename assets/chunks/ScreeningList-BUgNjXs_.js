import{d as S,a3 as v,M as T,B as R,b4 as A,c as L,w as c,a as m,G as P,L as B,o as C,e as a,V as N,a2 as $}from"./navigation-BglLrznb.js";import{G as h}from"./GoBack-Cltg5u1e.js";import{T as I}from"./Toolbar-ClmKF5AV.js";import{R as x}from"./ReusableDataTable-Cv5OA_au.js";import{i}from"./svg-COr7WdNJ.js";import{createModal as D,alertConfirmation as H}from"./Alerts-DIsW0NSB.js";import O from"./CPR-DQOjIzfy.js";import{usePatientList as U}from"./patientListStore-BTW-n0J_.js";import{H as l}from"./service-DhdzE8sY.js";import{P as d}from"./observation_service-B5YqcjVX.js";import{closeVisit as V}from"./visits_service-BaFFEi12.js";import{u as k}from"./useAETCStageRealtime-BvPd4BAQ.js";import{_ as F}from"./_plugin-vue_export-helper-DlAUqK2U.js";const G=S({__name:"ScreeningList",setup(J){const s=P([]),u=B(),b=["Visit Number","First Name","Last Name","Arrival Time","WaitingTime","Attended By","Action"],f={responsive:!0,ordering:!1,buttons:[]},o=U(),{AETCScreeningList:r}=v(o),e=()=>{s.value=r.value.map(t=>[t.visit_number,t.given_name,t.family_name,l.toStandardHisTimeFormat(t.arrival_time),l.waitingTime(t.latest_encounter_time),t.last_encounter_creator,_({identifier:t?.identifier,ID:t?.identifier,patient_id:t?.patient_id})])},{setupStageRealtimeUpdates:p,teardownStageRealtimeUpdates:g}=k({onUpdated:e}),_=t=>`
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
    `,y={"redirection-btn":async t=>{await d.getPatient(t),u.push("/aetc/screening")},"abscond-btn":async t=>{if(await H("Are you sure you want to abscond?")){await V(t);const n=`${t?.identifier||t?.ID||""}`.trim();n&&(o.removeFromAllRealtimeStageLists(n),e())}},"cpr-btn":async t=>{await d.getPatient(t),D(O,{class:"medium-modal"})}};return T(r,()=>{e()},{deep:!0}),R(async()=>{e(),await p()}),A(()=>{g()}),(t,n)=>(C(),L(m($),null,{default:c(()=>[a(I),a(m(N),{fullscreen:!0},{default:c(()=>[a(h,{title:"Patients waiting for screening"}),a(x,{headers:b,data:s.value,options:f,actionHandlers:y},null,8,["data"])]),_:1})]),_:1}))}}),et=F(G,[["__scopeId","data-v-df9fab38"]]);export{et as default};
