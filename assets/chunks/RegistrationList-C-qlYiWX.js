import{p as v,aV as R,w as S,y as T,a_ as h,q as A,G as C,F as m,D as i,E as d,aq as L,az as N,g as P}from"./vendor-BT9RBXwx.js";import{G as $}from"./GoBack-BSF1t9Wf.js";import{i as B,T as D,d as I}from"../index-CRqjyK7L.js";import{R as x}from"./ReusableDataTable-VSgoFEnX.js";import{f as F,H as n,i as s,d as H,j as O,P as U,_ as V}from"./encounter_type-CEyrAM46.js";import k from"./CPR-Cabjhtm9.js";import{s as E}from"./pinia-BRRJo76B.js";import{u as G}from"./useAETCStageRealtime-_S6bU3qF.js";const J=v({__name:"RegistrationList",setup(q){const o=P([]),l=R(),u=["Visit Number","First Name","Last Name","Arrival Time","WaitingTime","Aggregate","Screened By","Action"],b=F(),p={responsive:!0,ordering:!1,buttons:[]},r=B(),{AETCRegistrationList:c}=E(r),a=()=>{o.value=c.value.map(t=>[t.visit_number,t.given_name,t.family_name,n.toStandardHisTimeFormat(t.arrival_time),n.waitingTime(t.updated_at),n.waitingTime(t.arrival_time),t.last_encounter_creator,_({identifier:t?.identifier,ID:t?.identifier,patient_id:t?.patient_id,given_name:t?.given_name,family_name:t?.family_name})])},{setupStageRealtimeUpdates:f,teardownStageRealtimeUpdates:g}=G({onUpdated:a}),_=t=>`
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
    `,y={"redirection-btn":async t=>{const e=await U.getPatient(t);await b.setRecord(e),l.push({path:"/aetc/find-patient"})},"abscond-btn":async t=>{if(await O("Are you sure you want to abscond?")){await I(t);const e=`${t?.identifier||t?.ID||""}`.trim();e&&(r.removeFromAllRealtimeStageLists(e),a())}},"cpr-btn":t=>{H(k,{class:"medium-modal"})}};return S(c,()=>{a()},{deep:!0}),T(async()=>{a(),await f()}),h(()=>{g()}),(t,e)=>(A(),C(d(N),null,{default:m(()=>[i(D),i(d(L),{fullscreen:!0},{default:m(()=>[i($,{title:"Patients waiting for Registration"}),i(x,{headers:u,data:o.value,options:p,actionHandlers:y},null,8,["data"])]),_:1})]),_:1}))}}),Y=V(J,[["__scopeId","data-v-e240fcee"]]);export{Y as default};
