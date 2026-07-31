import{p as x,a_ as C,b2 as T,e6 as $,q as A,G as O,F as p,D as r,E as b,at as B,aC as W,g as k,c as o}from"./vendor-DbhrX6_N.js";import{T as L,P as q}from"../index-BliGEXk7.js";import{R as E}from"./ReusableDataTable-DWCDeUUi.js";import{G}from"./GoBack-BTXnGb3V.js";import{j as w,e as H,r as J,d as M,f as V,H as f,i as _,_ as F}from"./encounter_type-B9B82s57.js";import j from"./CPR-BzBoTwio.js";const K="ipdToolbarContext",X=x({__name:"PreAdmissionList",setup(Y){const d=C(),c=T(),v=w(),m=k([]),g=["Visit No","First Name","Last Name","MRN","Gender","Arrival Time","Waiting Time","Ward","Actions"],I={responsive:!0,ordering:!1,buttons:[]},l=(()=>{try{return JSON.parse(localStorage.getItem(K)||"{}")}catch{return{}}})(),y=o(()=>String(c.query.department||l.department||"").trim()),s=o(()=>String(c.query.ward||l.ward||"").trim()),u=o(()=>String(c.query.wardId||l.wardId||"").trim()),P=o(()=>`Patients Awaiting Admission${s.value?` - ${s.value}`:""}`),S=e=>`
        <div class="pre-admission-actions">
            <button
                class="btn btn-outline-success btn-sm btn-table redirection-btn pre-admission-icon-btn"
                style="color:rgb(0, 100, 1)"
                title="Start admission"
                data-id='${JSON.stringify(e)}'
            >
                ${_.redirection}
            </button>
            <button
                class="btn btn-outline-danger btn-sm btn-table cpr-btn pre-admission-icon-btn"
                style="color:#B42318"
                title="Start CPR"
                data-id='${JSON.stringify(e)}'
            >
                ${_.cpr}
            </button>
            <button class="btn btn-outline-secondary btn-sm btn-table dispose-btn" title="Dispose" data-id='${JSON.stringify(e)}'>
                Dispose
            </button>
        </div>
    `,a=(e,...t)=>{for(const i of t){const n=e?.[i];if(n!=null&&n!=="")return n}return""},N=e=>{m.value=e.map((t,i)=>{const n=a(t,"identifier","ID","npid");return[a(t,"visit_number","visitNumber","visit_id")||`${i+1}`,a(t,"given_name","first_name")||t?.patient?.personInformation?.given_name||"",a(t,"family_name","last_name")||t?.patient?.personInformation?.family_name||"",n,a(t,"gender")||t?.patient?.personInformation?.gender||"",f.toStandardHisTimeFormat(a(t,"arrival_time","created_at","date_created")),f.waitingTime(a(t,"arrival_time","created_at","date_created")),s.value||a(t,"ward_name","ward")||"",S({identifier:n,ID:n,patient_id:a(t,"patient_id","person_id"),visitNumber:a(t,"visit_number","visitNumber","visit_id")||`${i+1}`})]})},h=async()=>{if(!u.value){m.value=[],H("Ward context not found. Open this page from the IPD ward dashboard.");return}const e=await q.getPatientList("PRE_ADMISSION",u.value,J.IPD_PROGRAM);N(e||[])},D={"redirection-btn":async e=>{if(!`${e?.identifier||e?.ID||""}`.trim())return;const i=await V.getPatient(e);await v.setRecord(i),d.push("/aetc/template-forms/medical-admission?next=/ipd/assign-bed")},"cpr-btn":async()=>{await M(j,{class:"medium-modal"})},"dispose-btn":async e=>{`${e?.visitNumber||""}`.trim()&&d.push("/aetc/disposition")}},R=()=>{d.push({path:"/home",query:{department:y.value,ward:s.value}})};return $(h),(e,t)=>(A(),O(b(W),null,{default:p(()=>[r(L),r(b(B),{fullscreen:!0},{default:p(()=>[r(G,{title:P.value,onBack:R},null,8,["title"]),r(E,{headers:g,data:m.value,options:I,actionHandlers:D},null,8,["data"])]),_:1})]),_:1}))}}),nt=F(X,[["__scopeId","data-v-19a022b9"]]);export{nt as default};
