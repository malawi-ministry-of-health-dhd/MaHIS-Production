import{p as S,a_ as v,w as T,y as R,ak as A,q as C,G as L,F as c,D as a,E as l,at as N,aC as P,g as $}from"./vendor-DbhrX6_N.js";import{G as B}from"./GoBack-D4EphkhY.js";import{i as h,T as D,d as I}from"../index-1gLJeaTV.js";import{R as k}from"./ReusableDataTable-BaE4GlK8.js";import{H as d,i,f as m,d as x,l as F,_ as H}from"./encounter_type-DwpJ9uL1.js";import O from"./CPR-BsnYk4B5.js";import{s as U}from"./pinia-DVZah_rs.js";import{u as E}from"./useAETCStageRealtime-CRdo3Xc2.js";const G=S({__name:"ScreeningList",setup(J){const s=$([]),u=v(),b=["Visit Number","First Name","Last Name","Arrival Time","WaitingTime","Attended By","Action"],f={responsive:!0,ordering:!1,buttons:[]},o=h(),{AETCScreeningList:r}=U(o),e=()=>{s.value=r.value.map(t=>[t.visit_number,t.given_name,t.family_name,d.toStandardHisTimeFormat(t.arrival_time),d.waitingTime(t.latest_encounter_time),t.last_encounter_creator,_({identifier:t?.identifier,ID:t?.identifier,patient_id:t?.patient_id})])},{setupStageRealtimeUpdates:p,teardownStageRealtimeUpdates:g}=E({onUpdated:e}),_=t=>`
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
    `,y={"redirection-btn":async t=>{await m.getPatient(t),u.push("/aetc/screening")},"abscond-btn":async t=>{if(await F("Are you sure you want to abscond?")){await I(t);const n=`${t?.identifier||t?.ID||""}`.trim();n&&(o.removeFromAllRealtimeStageLists(n),e())}},"cpr-btn":async t=>{await m.getPatient(t),x(O,{class:"medium-modal"})}};return T(r,()=>{e()},{deep:!0}),R(async()=>{e(),await p()}),A(()=>{g()}),(t,n)=>(C(),L(l(P),null,{default:c(()=>[a(D),a(l(N),{fullscreen:!0},{default:c(()=>[a(B,{title:"Patients waiting for screening"}),a(k,{headers:b,data:s.value,options:f,actionHandlers:y},null,8,["data"])]),_:1})]),_:1}))}}),Q=H(G,[["__scopeId","data-v-df9fab38"]]);export{Q as default};
