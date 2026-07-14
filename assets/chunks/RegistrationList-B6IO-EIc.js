import{p as v,aV as R,w as S,y as T,a_ as h,q as A,G as C,F as m,D as i,E as d,aq as L,az as N,g as $}from"./vendor-DnALXmE4.js";import{G as B}from"./GoBack-73kBosDU.js";import{i as D,T as P,d as I}from"../index-CBeydS2A.js";import{R as k}from"./ReusableDataTable-Dk6_qPGL.js";import{h as x,H as n,i as s,d as F,k as H,f as O,_ as U}from"./encounter_type-DqKyvLOe.js";import V from"./CPR-Bezf2D-5.js";import{s as E}from"./pinia-CIieWJbU.js";import{u as G}from"./useAETCStageRealtime-BnnS2lBD.js";const J=v({__name:"RegistrationList",setup(q){const o=$([]),l=R(),u=["Visit Number","First Name","Last Name","Arrival Time","WaitingTime","Aggregate","Screened By","Action"],b=x(),p={responsive:!0,ordering:!1,buttons:[]},r=D(),{AETCRegistrationList:c}=E(r),a=()=>{o.value=c.value.map(t=>[t.visit_number,t.given_name,t.family_name,n.toStandardHisTimeFormat(t.arrival_time),n.waitingTime(t.updated_at),n.waitingTime(t.arrival_time),t.last_encounter_creator,_({identifier:t?.identifier,ID:t?.identifier,patient_id:t?.patient_id,given_name:t?.given_name,family_name:t?.family_name})])},{setupStageRealtimeUpdates:f,teardownStageRealtimeUpdates:g}=G({onUpdated:a}),_=t=>`
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
    `,y={"redirection-btn":async t=>{const e=await O.getPatient(t);await b.setRecord(e),l.push({path:"/aetc/find-patient"})},"abscond-btn":async t=>{if(await H("Are you sure you want to abscond?")){await I(t);const e=`${t?.identifier||t?.ID||""}`.trim();e&&(r.removeFromAllRealtimeStageLists(e),a())}},"cpr-btn":t=>{F(V,{class:"medium-modal"})}};return S(c,()=>{a()},{deep:!0}),T(async()=>{a(),await f()}),h(()=>{g()}),(t,e)=>(A(),C(d(N),null,{default:m(()=>[i(P),i(d(L),{fullscreen:!0},{default:m(()=>[i(B,{title:"Patients waiting for Registration"}),i(k,{headers:u,data:o.value,options:p,actionHandlers:y},null,8,["data"])]),_:1})]),_:1}))}}),Y=U(J,[["__scopeId","data-v-e240fcee"]]);export{Y as default};
