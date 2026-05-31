import{p as S,aV as v,w as T,y as R,aZ as A,q as P,G as C,F as c,D as a,E as l,aq as L,ay as N,g as $}from"./vendor-Dk8toxKA.js";import{G as B}from"./GoBack-pSY7jNch.js";import{f as h,T as D,g as I}from"../index-D4hCU5bX.js";import{R as x}from"./ReusableDataTable-D0D-DHHj.js";import{H as d,i,P as m,d as F,j as H,_ as O}from"./encounter_type-CGtYjz1Q.js";import U from"./CPR-Dq4PWUBP.js";import{s as V}from"./pinia-x4YoRtH4.js";import{u as k}from"./useAETCStageRealtime-DZlWplxq.js";const E=S({__name:"ScreeningList",setup(G){const s=$([]),u=v(),b=["Visit Number","First Name","Last Name","Arrival Time","WaitingTime","Attended By","Action"],f={responsive:!0,ordering:!1,buttons:[]},o=h(),{AETCScreeningList:r}=V(o),e=()=>{s.value=r.value.map(t=>[t.visit_number,t.given_name,t.family_name,d.toStandardHisTimeFormat(t.arrival_time),d.waitingTime(t.latest_encounter_time),t.last_encounter_creator,_({identifier:t?.identifier,ID:t?.identifier,patient_id:t?.patient_id})])},{setupStageRealtimeUpdates:p,teardownStageRealtimeUpdates:g}=k({onUpdated:e}),_=t=>`
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
    `,y={"redirection-btn":async t=>{await m.getPatient(t),u.push("/aetc/screening")},"abscond-btn":async t=>{if(await H("Are you sure you want to abscond?")){await I(t);const n=`${t?.identifier||t?.ID||""}`.trim();n&&(o.removeFromAllRealtimeStageLists(n),e())}},"cpr-btn":async t=>{await m.getPatient(t),F(U,{class:"medium-modal"})}};return T(r,()=>{e()},{deep:!0}),R(async()=>{e(),await p()}),A(()=>{g()}),(t,n)=>(P(),C(l(N),null,{default:c(()=>[a(D),a(l(L),{fullscreen:!0},{default:c(()=>[a(B,{title:"Patients waiting for screening"}),a(x,{headers:b,data:s.value,options:f,actionHandlers:y},null,8,["data"])]),_:1})]),_:1}))}}),K=O(E,[["__scopeId","data-v-df9fab38"]]);export{K as default};
