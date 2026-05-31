const f=(t,s)=>{!t||!s||Object.entries(s).forEach(([n,c])=>{const e=t.get(n);e&&typeof e.setValue=="function"&&e.setValue(c)})};export{f as s};
