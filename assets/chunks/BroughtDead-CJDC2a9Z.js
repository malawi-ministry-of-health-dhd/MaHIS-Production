import{p as m,y as u,q as b,G as g,F as o,D as e,E as i,aq as h,az as p,g as D}from"./vendor-CaA7daeG.js";import{G as O}from"./GoBack-CcDD0YLN.js";import{T as y}from"../index-Biqa4LNR.js";import{R as B}from"./ReusableDataTable-BIaR7NK2.js";import{i as s,_}from"./encounter_type-Te2AMUxP.js";const I=m({__name:"BroughtDead",setup(N){const n=D([]),r=["First Name","Surname","Age","National ID","Place Of Death","Date Of Death","Gender","Brought By","Confirmed By","Date Of Confirmation","Action"],d={responsive:!0,ordering:!1,buttons:[]},l=t=>`
        <button class="btn btn-outline-danger btn-sm btn-table redirection-btn" 
                style="color:rgb(0, 100, 1)" 
                data-id='${JSON.stringify(t)}'>
            ${s.view}
        </button>
        <button class="btn btn-outline-danger btn-sm btn-table abscond-btn" 
                style="color: rgba(0, 0, 0, 0.54);" 
                data-id='${JSON.stringify(t)}'>
            ${s.edit}
        </button>

    `,c={"view-btn":t=>{console.log("🚀 ~ redirection data:",t)},"edit-btn":t=>{console.log("🚀 ~ abscond data:",t)}},f=async()=>{const t=[{id:1,firstName:"John",surname:"Doe",age:"45",nationalId:"12345678",placeOfDeath:"Home",dateOfDeath:"2024-05-30",gender:"Male",broughtBy:"Ambulance",confirmedBy:"Dr. Smith",dateOfConfirmation:"2024-05-30"},{id:2,firstName:"Jane",surname:"Smith",age:"60",nationalId:"87654321",placeOfDeath:"Hospital",dateOfDeath:"2024-05-29",gender:"Female",broughtBy:"Family",confirmedBy:"Dr. Jones",dateOfConfirmation:"2024-05-29"}];n.value=t.map(a=>[a.firstName,a.surname,a.age,a.nationalId,a.placeOfDeath,a.dateOfDeath,a.gender,a.broughtBy,a.confirmedBy,a.dateOfConfirmation,l({id:a.id,name:`${a.firstName} ${a.surname}`,nationalId:a.nationalId,dateOfDeath:a.dateOfDeath})])};return u(async()=>{await f()}),(t,a)=>(b(),g(i(p),null,{default:o(()=>[e(y),e(i(h),{fullscreen:!0},{default:o(()=>[e(O,{title:"Dead on Arrival List"}),e(B,{headers:r,data:n.value,options:d,actionHandlers:c},null,8,["data"])]),_:1})]),_:1}))}}),J=_(I,[["__scopeId","data-v-b862a998"]]);export{J as default};
