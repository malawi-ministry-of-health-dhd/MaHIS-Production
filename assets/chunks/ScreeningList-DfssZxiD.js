import{p as S,aV as v,w as T,y as R,a_ as A,q as C,G as L,F as c,D as a,E as l,aq as N,az as P,g as $}from"./vendor-CL4j9M6D.js";import{G as B}from"./GoBack-Bk2LZ7bi.js";import{i as h,T as D,d as I}from"../index-dxmev6Rt.js";import{R as k}from"./ReusableDataTable-B2w_DqcD.js";import{H as d,i,f as m,d as x,k as F,_ as H}from"./encounter_type-qkJEK_Ds.js";import O from"./CPR-Ctzh1JCF.js";import{s as U}from"./pinia-DWx7nDuw.js";import{u as V}from"./useAETCStageRealtime-DgWYSWwo.js";const E=S({__name:"ScreeningList",setup(G){const s=$([]),u=v(),b=["Visit Number","First Name","Last Name","Arrival Time","WaitingTime","Attended By","Action"],f={responsive:!0,ordering:!1,buttons:[]},o=h(),{AETCScreeningList:r}=U(o),e=()=>{s.value=r.value.map(t=>[t.visit_number,t.given_name,t.family_name,d.toStandardHisTimeFormat(t.arrival_time),d.waitingTime(t.latest_encounter_time),t.last_encounter_creator,_({identifier:t?.identifier,ID:t?.identifier,patient_id:t?.patient_id})])},{setupStageRealtimeUpdates:p,teardownStageRealtimeUpdates:g}=V({onUpdated:e}),_=t=>`
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
    `,y={"redirection-btn":async t=>{await m.getPatient(t),u.push("/aetc/screening")},"abscond-btn":async t=>{if(await F("Are you sure you want to abscond?")){await I(t);const n=`${t?.identifier||t?.ID||""}`.trim();n&&(o.removeFromAllRealtimeStageLists(n),e())}},"cpr-btn":async t=>{await m.getPatient(t),x(O,{class:"medium-modal"})}};return T(r,()=>{e()},{deep:!0}),R(async()=>{e(),await p()}),A(()=>{g()}),(t,n)=>(C(),L(l(P),null,{default:c(()=>[a(D),a(l(N),{fullscreen:!0},{default:c(()=>[a(B,{title:"Patients waiting for screening"}),a(k,{headers:b,data:s.value,options:f,actionHandlers:y},null,8,["data"])]),_:1})]),_:1}))}}),Q=H(E,[["__scopeId","data-v-df9fab38"]]);export{Q as default};
