import{d as x,a4 as T,c as $,w as p,a as f,h as r,G as A,L as C,u as O,o as B,e as o,V as L,a2 as W}from"./navigation-BglLrznb.js";import{T as k}from"./Toolbar-ClmKF5AV.js";import{R as w}from"./ReusableDataTable-Cv5OA_au.js";import{G}from"./GoBack-Cltg5u1e.js";import{createModal as V}from"./Alerts-DIsW0NSB.js";import{i as b}from"./svg-COr7WdNJ.js";import{P as q}from"./patient_opd_list-29XVKYey.js";import{P as E,H as _}from"./service-DhdzE8sY.js";import{P as H}from"./observation_service-B5YqcjVX.js";import{useDemographicsStore as J}from"./DemographicStore-CTUAzWeG.js";import M from"./CPR-DQOjIzfy.js";import{toastWarning as F}from"./toasts-DaA7oCoV.js";import{_ as K}from"./_plugin-vue_export-helper-DlAUqK2U.js";const X="ipdToolbarContext",Y=x({__name:"PreAdmissionList",setup(j){const d=C(),m=O(),v=J(),c=A([]),g=["Visit No","First Name","Last Name","MRN","Gender","Arrival Time","Waiting Time","Ward","Actions"],I={responsive:!0,ordering:!1,buttons:[]},l=(()=>{try{return JSON.parse(localStorage.getItem(X)||"{}")}catch{return{}}})(),P=r(()=>String(m.query.department||l.department||"").trim()),s=r(()=>String(m.query.ward||l.ward||"").trim()),u=r(()=>String(m.query.wardId||l.wardId||"").trim()),y=r(()=>`Patients Awaiting Admission${s.value?` - ${s.value}`:""}`),S=e=>`
        <div class="pre-admission-actions">
            <button
                class="btn btn-outline-success btn-sm btn-table redirection-btn pre-admission-icon-btn"
                style="color:rgb(0, 100, 1)"
                title="Start admission"
                data-id='${JSON.stringify(e)}'
            >
                ${b.redirection}
            </button>
            <button
                class="btn btn-outline-danger btn-sm btn-table cpr-btn pre-admission-icon-btn"
                style="color:#B42318"
                title="Start CPR"
                data-id='${JSON.stringify(e)}'
            >
                ${b.cpr}
            </button>
            <button class="btn btn-outline-secondary btn-sm btn-table dispose-btn" title="Dispose" data-id='${JSON.stringify(e)}'>
                Dispose
            </button>
        </div>
    `,a=(e,...t)=>{for(const n of t){const i=e?.[n];if(i!=null&&i!=="")return i}return""},N=e=>{c.value=e.map((t,n)=>{const i=a(t,"identifier","ID","npid");return[a(t,"visit_number","visitNumber","visit_id")||`${n+1}`,a(t,"given_name","first_name")||t?.patient?.personInformation?.given_name||"",a(t,"family_name","last_name")||t?.patient?.personInformation?.family_name||"",i,a(t,"gender")||t?.patient?.personInformation?.gender||"",_.toStandardHisTimeFormat(a(t,"arrival_time","created_at","date_created")),_.waitingTime(a(t,"arrival_time","created_at","date_created")),s.value||a(t,"ward_name","ward")||"",S({identifier:i,ID:i,patient_id:a(t,"patient_id","person_id"),visitNumber:a(t,"visit_number","visitNumber","visit_id")||`${n+1}`})]})},h=async()=>{if(!u.value){c.value=[],F("Ward context not found. Open this page from the IPD ward dashboard.");return}const e=await q.getPatientList("PRE_ADMISSION",u.value,E.IPD_PROGRAM);N(e||[])},D={"redirection-btn":async e=>{if(!`${e?.identifier||e?.ID||""}`.trim())return;const n=await H.getPatient(e);await v.setRecord(n),d.push("/aetc/template-forms/medical-admission?next=/ipd/assign-bed")},"cpr-btn":async()=>{await V(M,{class:"medium-modal"})},"dispose-btn":async e=>{`${e?.visitNumber||""}`.trim()&&d.push("/aetc/disposition")}},R=()=>{d.push({path:"/home",query:{department:P.value,ward:s.value}})};return T(h),(e,t)=>(B(),$(f(W),null,{default:p(()=>[o(k),o(f(L),{fullscreen:!0},{default:p(()=>[o(G,{title:y.value,onBack:R},null,8,["title"]),o(w,{headers:g,data:c.value,options:I,actionHandlers:D},null,8,["data"])]),_:1})]),_:1}))}}),ct=K(Y,[["__scopeId","data-v-19a022b9"]]);export{ct as default};
