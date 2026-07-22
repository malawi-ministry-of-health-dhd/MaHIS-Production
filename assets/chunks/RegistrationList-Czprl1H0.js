import{p as N,aV as P,w as A,y as C,a_ as L,q as $,G as x,F as _,D as s,E as b,aq as B,az as k,g as F}from"./vendor-Puu7tX6q.js";import{G as H}from"./GoBack-h1b1kqMH.js";import{i as O,T as U,d as V}from"../index-DDSHOBxE.js";import{R as E}from"./ReusableDataTable-BgqoHvfS.js";import{h as G,H as o,i as r,d as J,k as q,f as M,_ as z}from"./encounter_type-Di7uah7d.js";import W from"./CPR-C8lzQZsO.js";import{s as j}from"./pinia-mL8J5YzK.js";import{u as K}from"./useAETCStageRealtime-BTw59d54.js";const Q=N({__name:"RegistrationList",setup(X){const m=F([]),y=P(),I=["Visit Number","First Name","Last Name","Arrival Time","WaitingTime","Aggregate","Screened By","Action"],v=G(),D={responsive:!0,ordering:!1,buttons:[]},c=O(),{AETCRegistrationList:d}=j(c),l=e=>{const t=e?.patient||{},n=t?.person||e?.person||{},a=n?.names?.[0]||{},p=e?.identifier??e?.ID??t?.identifier??t?.ID,f=e?.given_name??t?.given_name??t?.personInformation?.given_name??a?.given_name??"",u=e?.family_name??t?.family_name??t?.personInformation?.family_name??a?.family_name??"",g=e?.gender??e?.sex??t?.gender??t?.sex??t?.personInformation?.gender??n?.gender??"";return{patient_id:e?.patient_id??e?.patientID??e?.person_id??t?.patient_id??t?.patientID,identifier:p,ID:p,given_name:f,family_name:u,gender:g,personInformation:{given_name:f,family_name:u,gender:g}}},i=()=>{m.value=d.value.map(e=>[e.visit_number,e.given_name,e.family_name,o.toStandardHisTimeFormat(e.arrival_time),o.waitingTime(e.updated_at),o.waitingTime(e.arrival_time),e.last_encounter_creator,h(l(e))])},{setupStageRealtimeUpdates:R,teardownStageRealtimeUpdates:S}=K({onUpdated:i}),h=e=>`
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
    `,T={"redirection-btn":async e=>{const t=l(e),n=await M.getPatient(t),a=n?.personInformation||{};await v.setRecord({...n||t,patientID:n?.patientID??n?.patient_id??t.patient_id,ID:n?.ID??t.ID,personInformation:{...t.personInformation,...a,given_name:a.given_name||t.personInformation.given_name,family_name:a.family_name||t.personInformation.family_name,gender:a.gender||t.personInformation.gender}}),y.push({path:"/aetc/find-patient"})},"abscond-btn":async e=>{if(await q("Are you sure you want to abscond?")){await V(e);const t=`${e?.identifier||e?.ID||""}`.trim();t&&(c.removeFromAllRealtimeStageLists(t),i())}},"cpr-btn":e=>{J(W,{class:"medium-modal"})}};return A(d,()=>{i()},{deep:!0}),C(async()=>{i(),await R()}),L(()=>{S()}),(e,t)=>($(),x(b(k),null,{default:_(()=>[s(U),s(b(B),{fullscreen:!0},{default:_(()=>[s(H,{title:"Patients waiting for Registration"}),s(E,{headers:I,data:m.value,options:D,actionHandlers:T},null,8,["data"])]),_:1})]),_:1}))}}),se=z(Q,[["__scopeId","data-v-4769cb97"]]);export{se as default};
