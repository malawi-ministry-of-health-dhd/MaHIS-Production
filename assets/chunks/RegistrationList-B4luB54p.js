import{p as N,a_ as P,w as A,y as C,ak as L,q as $,G as x,F as _,D as s,E as b,at as B,aC as k,g as F}from"./vendor-DbhrX6_N.js";import{G as H}from"./GoBack-SOBj9pGX.js";import{i as O,T as U,d as E}from"../index-dc3P2841.js";import{R as G}from"./ReusableDataTable-B_sIlOuy.js";import{j as J,H as o,i as r,d as V,l as M,f as j,_ as q}from"./encounter_type-QHH8iigX.js";import W from"./CPR-DuMx2OWX.js";import{s as z}from"./pinia-DVZah_rs.js";import{u as K}from"./useAETCStageRealtime-C9Wlolbw.js";const Q=N({__name:"RegistrationList",setup(X){const m=F([]),y=P(),I=["Visit Number","First Name","Last Name","Arrival Time","WaitingTime","Aggregate","Screened By","Action"],v=J(),D={responsive:!0,ordering:!1,buttons:[]},c=O(),{AETCRegistrationList:d}=z(c),l=e=>{const t=e?.patient||{},n=t?.person||e?.person||{},a=n?.names?.[0]||{},p=e?.identifier??e?.ID??t?.identifier??t?.ID,f=e?.given_name??t?.given_name??t?.personInformation?.given_name??a?.given_name??"",u=e?.family_name??t?.family_name??t?.personInformation?.family_name??a?.family_name??"",g=e?.gender??e?.sex??t?.gender??t?.sex??t?.personInformation?.gender??n?.gender??"";return{patient_id:e?.patient_id??e?.patientID??e?.person_id??t?.patient_id??t?.patientID,identifier:p,ID:p,given_name:f,family_name:u,gender:g,personInformation:{given_name:f,family_name:u,gender:g}}},i=()=>{m.value=d.value.map(e=>[e.visit_number,e.given_name,e.family_name,o.toStandardHisTimeFormat(e.arrival_time),o.waitingTime(e.updated_at),o.waitingTime(e.arrival_time),e.last_encounter_creator,T(l(e))])},{setupStageRealtimeUpdates:R,teardownStageRealtimeUpdates:S}=K({onUpdated:i}),T=e=>`
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
    `,h={"redirection-btn":async e=>{const t=l(e),n=await j.getPatient(t),a=n?.personInformation||{};await v.setRecord({...n||t,patientID:n?.patientID??n?.patient_id??t.patient_id,ID:n?.ID??t.ID,personInformation:{...t.personInformation,...a,given_name:a.given_name||t.personInformation.given_name,family_name:a.family_name||t.personInformation.family_name,gender:a.gender||t.personInformation.gender}}),y.push({path:"/aetc/find-patient"})},"abscond-btn":async e=>{if(await M("Are you sure you want to abscond?")){await E(e);const t=`${e?.identifier||e?.ID||""}`.trim();t&&(c.removeFromAllRealtimeStageLists(t),i())}},"cpr-btn":e=>{V(W,{class:"medium-modal"})}};return A(d,()=>{i()},{deep:!0}),C(async()=>{i(),await R()}),L(()=>{S()}),(e,t)=>($(),x(b(k),null,{default:_(()=>[s(U),s(b(B),{fullscreen:!0},{default:_(()=>[s(H,{title:"Patients waiting for Registration"}),s(G,{headers:I,data:m.value,options:D,actionHandlers:h},null,8,["data"])]),_:1})]),_:1}))}}),se=q(Q,[["__scopeId","data-v-4769cb97"]]);export{se as default};
