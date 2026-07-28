import{p as N,aX as P,w as A,y as B,b0 as C,q as L,G as $,F as _,D as s,E as b,as as x,aB as k,g as F}from"./vendor-BHih14ng.js";import{G as H}from"./GoBack-D03uybKc.js";import{i as O,T as U,d as E}from"../index-BVARciTa.js";import{R as G}from"./ReusableDataTable-BstPXIma.js";import{h as J,H as o,i as r,d as V,k as M,f as q,_ as W}from"./encounter_type-BlakkUE0.js";import X from"./CPR-COIL6b-Y.js";import{s as j}from"./pinia-DepOfgUz.js";import{u as z}from"./useAETCStageRealtime-BW2cenDk.js";const K=N({__name:"RegistrationList",setup(Q){const m=F([]),y=P(),I=["Visit Number","First Name","Last Name","Arrival Time","WaitingTime","Aggregate","Screened By","Action"],v=J(),D={responsive:!0,ordering:!1,buttons:[]},c=O(),{AETCRegistrationList:d}=j(c),l=e=>{const t=e?.patient||{},n=t?.person||e?.person||{},a=n?.names?.[0]||{},p=e?.identifier??e?.ID??t?.identifier??t?.ID,f=e?.given_name??t?.given_name??t?.personInformation?.given_name??a?.given_name??"",u=e?.family_name??t?.family_name??t?.personInformation?.family_name??a?.family_name??"",g=e?.gender??e?.sex??t?.gender??t?.sex??t?.personInformation?.gender??n?.gender??"";return{patient_id:e?.patient_id??e?.patientID??e?.person_id??t?.patient_id??t?.patientID,identifier:p,ID:p,given_name:f,family_name:u,gender:g,personInformation:{given_name:f,family_name:u,gender:g}}},i=()=>{m.value=d.value.map(e=>[e.visit_number,e.given_name,e.family_name,o.toStandardHisTimeFormat(e.arrival_time),o.waitingTime(e.updated_at),o.waitingTime(e.arrival_time),e.last_encounter_creator,h(l(e))])},{setupStageRealtimeUpdates:R,teardownStageRealtimeUpdates:S}=z({onUpdated:i}),h=e=>`
        <button class="btn btn-outline-danger btn-sm btn-table redirection-btn" 
                style="color:rgb(0, 100, 1)" 
                data-id='${JSON.stringify(e)}'>
            ${r.redirection}
        </button>
        <button class="btn btn-outline-danger btn-sm btn-table abscond-btn" 
                style="color: rgba(0, 0, 0, 0.54);" 
                data-id='${JSON.stringify(e)}'>
            ${r.abscond}
        </button>
        <button class="btn btn-outline-danger btn-sm btn-table cpr-btn" 
                style="color: red;" 
                data-id='${JSON.stringify(e)}'>
            ${r.cpr}
        </button>
    `,T={"redirection-btn":async e=>{const t=l(e),n=await q.getPatient(t),a=n?.personInformation||{};await v.setRecord({...n||t,patientID:n?.patientID??n?.patient_id??t.patient_id,ID:n?.ID??t.ID,personInformation:{...t.personInformation,...a,given_name:a.given_name||t.personInformation.given_name,family_name:a.family_name||t.personInformation.family_name,gender:a.gender||t.personInformation.gender}}),y.push({path:"/aetc/find-patient"})},"abscond-btn":async e=>{if(await M("Are you sure you want to abscond?")){await E(e);const t=`${e?.identifier||e?.ID||""}`.trim();t&&(c.removeFromAllRealtimeStageLists(t),i())}},"cpr-btn":e=>{V(X,{class:"medium-modal"})}};return A(d,()=>{i()},{deep:!0}),B(async()=>{i(),await R()}),C(()=>{S()}),(e,t)=>(L(),$(b(k),null,{default:_(()=>[s(U),s(b(x),{fullscreen:!0},{default:_(()=>[s(H,{title:"Patients waiting for Registration"}),s(G,{headers:I,data:m.value,options:D,actionHandlers:T},null,8,["data"])]),_:1})]),_:1}))}}),se=W(K,[["__scopeId","data-v-4769cb97"]]);export{se as default};
