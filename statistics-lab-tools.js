/* Lab v2 extension. Reuses v1 unchanged and mounts five original teaching tools.
 * Explicit input allowlists; no eval, external requests, cookies or data persistence.
 */
(function (root) {
  "use strict";
  const base = root.StatisticsLab, M = root.StatisticsLabToolsMath, N = root.StatisticsLabMath;
  if (!base || !M || !N) return;
  const names = {normal:"Normal distribution",ztable:"Z-table",quantiles:"Cutoffs & percentiles",sampling:"Sample means",confidence:"Confidence intervals",descriptive:"Data summary",tdist:"t-distribution"};
  const hints = {normal:"I know the limits. What is the probability?",ztable:"How do I read a cumulative normal table?",quantiles:"I know the probability. What are the limits?",sampling:"My question is about a sample mean, not one observation.",confidence:"I have a sample. How precisely can I estimate the population mean?",descriptive:"I have data. How do I describe their centre and spread?",tdist:"How do degrees of freedom change tail areas and critical values?"};
  const keys = Object.keys(names), extra = keys.slice(2);
  const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const f = (v,d=5) => v === null ? "Not defined" : !Number.isFinite(v) ? String(v) : v!==0 && (Math.abs(v)<1e-4 || Math.abs(v)>=1e7) ? v.toExponential(4) : Number(v.toFixed(d)).toString();
  const pct = p => `${f(p*100,4)}%`;
  const input=(tool,key,label,val,attrs="")=>`<label class="sl-field" for="st-${tool}-${key}"><span>${label}</span><input id="st-${tool}-${key}" name="${key}" type="number" value="${val}" step="any" inputmode="decimal" ${attrs}></label>`;
  const select=(tool,key,label,options)=>`<label class="sl-field" for="st-${tool}-${key}"><span>${label}</span><select id="st-${tool}-${key}" name="${key}">${options.map(([v,t])=>`<option value="${v}">${t}</option>`).join("")}</select></label>`;
  const fields=html=>`<div class="sl-fields">${html}</div>`;
  const modeOptions=[["between","Between · a < X̄ < b"],["left","Left tail · X̄ < b"],["right","Right tail · X̄ > a"],["outside","Outside · X̄ < a or X̄ > b"]];
  const metric=(label,value)=>`<div class="sl2-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  const metrics=items=>`<div class="sl2-metrics">${items.map(([l,v])=>metric(l,v)).join("")}</div>`;
  const steps=items=>`<div class="sl2-working"><p class="sl-eyebrow">SHOW YOUR WORKING</p>${items.map(([title,formula,text],i)=>`<article class="sl2-work-step"><span>0${i+1}</span><div><h3>${esc(title)}</h3><pre class="sl-formula">${esc(formula)}</pre><p class="sl-small">${esc(text)}</p></div></article>`).join("")}</div>`;
  const note=text=>`<aside class="sl-info">${esc(text)}</aside>`;
  const excel=formula=>`<details class="sl2-excel"><summary>Reproduce this in Excel</summary><pre class="sl-formula">${esc(formula)}</pre><p class="sl-hint">English function names are shown. Depending on your locale, argument separators may be semicolons instead of commas.</p></details>`;
  const refs=links=>`<p class="sl2-sources">Method references: ${links.map(([title,url])=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${title} ↗</a>`).join(" · ")}</p>`;
  const sources={normal:["NIST · normal distribution","https://www.itl.nist.gov/div898/handbook/eda/section3/eda3661.htm"],ci:["NIST · confidence limits","https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm"],t:["R stats · t distribution","https://stat.ethz.ch/R-manual/R-devel/library/stats/html/TDist.html"],q:["R stats · quantile definitions","https://stat.ethz.ch/R-manual/R-devel/library/stats/html/quantile.html"],excel:["Microsoft · QUARTILE.INC","https://support.microsoft.com/en-us/office/quartile-inc-function-1bbacc80-5075-42f1-aed6-47d735c4819d"]};

  // Accessible SVGs have both a description and a text result outside the drawing.
  function curve(id, density, regions, cfg={}) {
    const extent=cfg.extent||4, mu=cfg.mu||0, scale=cfg.scale||1, W=760,B=235,L=68,R=735,T=30;
    const peak=Math.max(density(0),cfg.overlay?N.pdf(0):0), sx=z=>L+(z+extent)/(2*extent)*(R-L), sy=y=>B-y/peak*(B-T);
    const path=(fun,lo,hi,fill=false)=>{
      lo=Math.max(-extent,lo);hi=Math.min(extent,hi);if(!(hi>lo))return "";
      let d=`M${sx(lo)} ${sy(fun(lo))}`;
      for(let i=1;i<=300;i++){const z=lo+(hi-lo)*i/300;d+=` L${sx(z)} ${sy(fun(z))}`;}
      return fill?`${d} L${sx(hi)} ${B} L${sx(lo)} ${B} Z`:d;
    };
    let content=`<title id="${id}-title">${esc(cfg.title||"Probability density")}</title><desc id="${id}-desc">${esc(cfg.description||"The shaded area represents the selected probability. Numerical results are given below the plot.")}</desc>`;
    for(let i=1;i<=4;i++){const y=peak*i/4,py=sy(y);content+=`<path class="sl-gridline" d="M${L} ${py}H${R}"/><text class="sl-tick" x="${L-9}" y="${py+4}" text-anchor="end">${f(y/scale,3)}</text>`;}
    for(let i=0;i<=4;i++){const z=-extent+2*extent*i/4,px=sx(z);content+=`<text class="sl-tick" x="${px}" y="${B+24}" text-anchor="middle">${f(mu+scale*z,3)}</text>`;}
    for(const [a,b] of regions)content+=`<path class="sl-area" d="${path(density,a,b,true)}"/>`;
    if(cfg.overlay)content+=`<path class="sl2-comparison" d="${path(N.pdf,-extent,extent)}"/>`;
    content+=`<path class="sl-curve" d="${path(density,-extent,extent)}"/><path class="sl-axis" d="M${L} ${B}H${R}"/><text class="sl-axis-label" x="${L}" y="17">Density</text><text class="sl-axis-label" x="400" y="292" text-anchor="middle">${esc(cfg.axis||"Value")}</text>`;
    (cfg.bounds||[]).forEach(z=>{if(Math.abs(z)<=extent)content+=`<path class="sl-boundary" d="M${sx(z)} ${T}V${B}"/>`;});
    return `<svg id="${id}" class="sl-graph sl2-graph" viewBox="0 0 ${W} 310" role="img" aria-labelledby="${id}-title ${id}-desc">${content}</svg><p class="sl-hint">${esc(cfg.caption||"The drawing shows a finite part of the distribution. Probabilities include the full selected tails.")}</p>`;
  }
  function histogram(id,data,bins,overlaySD=null) {
    const h=M.histogram(data,bins),L=65,R=735,T=25,B=230,max=Math.max(...h.counts,overlaySD?N.pdf(0)/overlaySD*h.n*h.width:0)*1.15;
    const x=v=>L+(v-h.min)/(h.max-h.min)*(R-L),y=v=>B-v/max*(B-T);
    let body=`<title id="${id}-title">Histogram of ${h.n} observations</title><desc id="${id}-desc">${h.counts.length} equal-width bins. Counts: ${h.counts.join(", ")}. All ${h.n} values are included. Final bin includes its right endpoint.</desc>`;
    h.counts.forEach((c,i)=>{body+=`<rect class="sl2-hist-bar" x="${x(h.min+i*h.width)+1}" y="${y(c)}" width="${(R-L)/h.counts.length-2}" height="${B-y(c)}"><title>${esc(`[${f(h.min+i*h.width)}, ${f(h.min+(i+1)*h.width)}${i===h.counts.length-1?"]":")"}: ${c}`)}</title></rect>`;});
    for(let i=0;i<=4;i++){const px=L+(R-L)*i/4;body+=`<text class="sl-tick" x="${px}" y="265" text-anchor="middle">${f(h.min+(h.max-h.min)*i/4,3)}</text>`;}
    for(let i=0;i<4;i++){const c=Math.round(max*i/3);body+=`<text class="sl-tick" x="${L-10}" y="${y(c)+4}" text-anchor="end">${c}</text>`;}
    if(overlaySD){let d="";for(let i=0;i<=300;i++){const v=h.min+(h.max-h.min)*i/300,c=N.pdf(v/overlaySD)/overlaySD*h.n*h.width;d+=`${i?"L":"M"}${x(v)} ${Math.max(T,y(c))} `;}body+=`<path class="sl2-comparison" d="${d}"/>`;}
    body+=`<path class="sl-axis" d="M${L} ${B}H${R}"/><text class="sl-axis-label" x="${L}" y="17">Count</text>`;
    return `<svg class="sl-graph sl2-graph" id="${id}" viewBox="0 0 760 285" role="img" aria-labelledby="${id}-title ${id}-desc">${body}</svg>`;
  }
  function intervalPlot(id,low,mid,high,label) {
    return `<svg class="sl2-interval" viewBox="0 0 760 155" role="img" aria-labelledby="${id}-title"><title id="${id}-title">${esc(`${label}: lower ${f(low)}, centre ${f(mid)}, upper ${f(high)}`)}</title><path class="sl2-interval-line" d="M110 70H650"/><path class="sl-boundary" d="M110 47V93M650 47V93"/><circle class="sl-handle" cx="380" cy="70" r="9"/>${[[110,low,"Lower"],[380,mid,"Centre"],[650,high,"Upper"]].map(([x,v,s])=>`<text class="sl-tick" x="${x}" y="120" text-anchor="middle">${f(v)}</text><text class="sl-axis-label" x="${x}" y="28" text-anchor="middle">${s}</text>`).join("")}</svg>`;
  }
  function boxplot(d) {
    let min=d.min,max=d.max;if(min===max){min-=1;max+=1;}const L=70,R=730,x=v=>L+(v-min)/(max-min)*(R-L), y=65;
    let body=`<title id="st-box-title">Box plot</title><desc id="st-box-desc">Q1 ${f(d.q1)}, median ${f(d.median)}, Q3 ${f(d.q3)}; whiskers at ${f(d.lowWhisker)} and ${f(d.highWhisker)}. ${d.outliers.length} observations beyond the 1.5 IQR fences. At most 300 outlier markers are drawn.</desc><path class="sl2-box-line" d="M${x(d.lowWhisker)} ${y}H${x(d.highWhisker)}M${x(d.lowWhisker)} 45V85M${x(d.highWhisker)} 45V85"/><rect class="sl2-box" x="${x(d.q1)}" y="35" width="${Math.max(1,x(d.q3)-x(d.q1))}" height="60"/><path class="sl2-box-line" d="M${x(d.median)} 35V95"/>`;
    d.outliers.slice(0,300).forEach((v,i)=>{body+=`<circle class="sl2-outlier" cx="${x(v)}" cy="${y+(i%5-2)*5}" r="4"><title>${v}</title></circle>`;});
    for(let i=0;i<=4;i++)body+=`<text class="sl-tick" x="${L+(R-L)*i/4}" y="130" text-anchor="middle">${f(min+(max-min)*i/4,3)}</text>`;
    return `<svg class="sl2-boxplot" viewBox="0 0 760 150" role="img" aria-labelledby="st-box-title st-box-desc">${body}</svg>`;
  }

  function extend(host) {
    if(host.dataset.statisticsLabV2)return;
    host.dataset.statisticsLabV2="true";host.classList.add("sl2-lab");
    const $=id=>host.querySelector(`#${id}`), val=(t,k)=>$(`st-${t}-${k}`).value;
    const panels={},valid={},initialized=new Set();let active="normal";
    const read=(t,k,min=-1e12,max=1e12,integer=false)=>{
      const node=$(`st-${t}-${k}`),n=node.value.trim()===""?NaN:Number(node.value);
      if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n))){node.setAttribute("aria-invalid","true");throw new Error(`${node.closest("label").querySelector("span").textContent}: enter ${integer?"a whole number":"a number"} from ${min} to ${max}.`);}return n;
    };
    const sd=(t,k)=>{const n=read(t,k,1e-12,1e12);return n;};
    const unitP=(t,k)=>{const p=read(t,k,0.000001,0.999999);return p;};
    const choice=(t,k,allowed)=>{const v=val(t,k);if(!allowed.includes(v))throw new Error("Choose a valid option.");return v;};
    host.querySelector(".sl-header h1").innerHTML="Your question.<br><em>A clearer way to solve it.</em>";
    host.querySelector(".sl-lead").textContent="Seven connected tools. Visual answers, worked steps and the assumptions that matter.";
    host.querySelector(".sl-version").textContent="Interactive Lab · v2";
    host.querySelector(".sl-header-note p").innerHTML="Choose your question.<br>Explore the result.<br>Understand the method.";
    const tablist=host.querySelector(".sl-tabs"),toolbar=host.querySelector(".sl-toolbar");
    tablist.classList.add("sl2-tabs");
    const guide=document.createElement("p");guide.className="sl2-guide";guide.id="st-guide";toolbar.insertAdjacentElement("afterend",guide);
    const actions=document.createElement("div");actions.className="sl2-actions";actions.hidden=true;
    actions.innerHTML='<button type="button" class="sl-text-button" id="st-copy">Copy worked result</button><button type="button" class="sl-text-button" id="st-share">Copy setup link ↗</button>';
    toolbar.appendChild(actions);
    function panel(t,form,description) {
      const section=document.createElement("section");section.id=`sl-panel-${t}`;section.hidden=true;section.setAttribute("role","tabpanel");section.setAttribute("aria-labelledby",`sl-tab-${t}`);
      section.innerHTML=`<div class="sl2-intro"><p class="sl-eyebrow">LEARN / CALCULATE / CHECK</p><h2>${names[t]}</h2><p class="sl-small">${description}</p></div><div class="sl-workspace"><div class="sl-controls sl-card"><form id="st-${t}-form" novalidate>${form}<p id="st-${t}-error" class="sl-error" role="alert" hidden></p><button class="sl-button" type="submit">Calculate &amp; explain →</button></form></div><div id="st-${t}-result" class="sl-card sl2-result"></div></div>`;
      host.querySelector(".sl-methods").insertAdjacentElement("beforebegin",section);panels[t]=section;
      const status=document.createElement("p");status.id=`st-${t}-status`;status.className="sl2-sr-only";status.setAttribute("role","status");status.setAttribute("aria-live","polite");section.appendChild(status);
      const button=document.createElement("button");button.type="button";button.id=`sl-tab-${t}`;button.setAttribute("role","tab");button.setAttribute("aria-controls",section.id);button.setAttribute("aria-selected","false");button.tabIndex=-1;button.innerHTML=`0${keys.indexOf(t)+1} <span>${names[t]}</span>`;tablist.appendChild(button);
      const formEl=$(`st-${t}-form`);
      formEl.addEventListener("submit",e=>{e.preventDefault();compute(t);});
      formEl.addEventListener("input",()=>compute(t));formEl.addEventListener("change",()=>compute(t));
    }
    panel("quantiles",fields(input("quantiles","mu","Mean · μ",0)+input("quantiles","sd","Standard deviation · σ",2))+
      select("quantiles","kind","What is given?",[["percentiles","Two cumulative probabilities"],["left","Left-tail probability"],["right","Right-tail probability"],["central","Central probability (equal tails)"]])+
      `<div id="st-quantiles-single">${input("quantiles","p","Probability · 0 < p < 1",.95)}</div><div id="st-quantiles-pair">${fields(input("quantiles","pl","Lower cumulative p",.05)+input("quantiles","pu","Upper cumulative p",.75))}</div><p class="sl-hint">Use 0.95 for 95%. Two cumulative probabilities 0.05 and 0.75 enclose 70%, not 75%.</p>`,
      "Go backwards: start with an area and find the z-score and the original X value.");
    panel("sampling",fields(input("sampling","mu","Population mean · μ",28)+input("sampling","sd","Population SD · σ",10))+input("sampling","n","Sample size · n",100,'min="1" max="1000000" step="1"')+
      select("sampling","model","Why use a normal curve?",[["normal","Population is normal (exact)"],["clt","Large-sample normal approximation"]])+
      select("sampling","mode","Probability for the sample mean",modeOptions)+
      fields(`<div id="st-sampling-a-wrap">${input("sampling","a","Lower value · a",26)}</div><div id="st-sampling-b-wrap">${input("sampling","b","Upper value · b",30)}</div>`)+
      input("sampling","coverage","Central sampling area (%)",95,'min="50" max="99.9"')+'<p class="sl-hint">Independent, identically distributed observations with finite variance; no finite-population correction is applied. These values are a hypothetical teaching example.</p>',
      "Distinguish the spread of individual observations (σ) from the spread of sample means (σ / √n).");
    panel("confidence",select("confidence","method","What SD do you have?",[["t","Sample SD · s → Student t"],["z","Known population SD · σ → z"]])+input("confidence","mean","Sample mean · x̄",70)+fields(input("confidence","sd","Standard deviation · s or σ",10)+input("confidence","n","Sample size · n",25,'step="1"'))+input("confidence","level","Confidence level (%)",95,'min="50" max="99.9"')+'<p class="sl-hint">Two-sided interval for one population mean. Use a random/representative independent sample. Exact for a normal population under the selected model; otherwise an approximation requiring justification.</p>',
      "Build a two-sided confidence interval and see the critical value, standard error and margin of error.");
    panel("descriptive",'<label class="sl-field" for="st-descriptive-data"><span>Paste one numeric variable</span><textarea id="st-descriptive-data" name="data" rows="6" spellcheck="false">12, 14, 14, 17, 21, 24, 28</textarea></label>'+
      select("descriptive","decimal","Decimal format",[["point","Decimal point · 12.5, 14.2"],["comma","Decimal comma · 12,5; 14,2"]])+
      select("descriptive","quartile","Quartile convention",[["inclusive","Inclusive interpolation (Excel INC)"],["exclusive","Exclusive interpolation (Excel EXC)"],["halves","Median of halves (omit centre)"]])+
      input("descriptive","bins","Histogram bins",10,'min="1" max="40" step="1"')+'<p class="sl-hint">Up to 5000 values. Point mode: commas, whitespace or semicolons separate values. Comma mode: use semicolons or whitespace. No thousands separators. Remove headers and missing entries explicitly.</p><p class="sl-hint">Data stay in memory on this page. Setup links do not include your dataset. Use anonymised practice data, not patient records.</p>',
      "Calculate centre, spread and quartiles, then connect them to a histogram and a correctly labelled box plot.");
    panel("tdist",input("tdist","df","Degrees of freedom · df",9,'min="1" max="10000" step="1"')+input("tdist","t","Observed t value",1.96,'min="-100" max="100"')+
      select("tdist","view","Shade which area?",[["two","Two tails · |T| > |t|"],["left","Left tail · T ≤ t"],["right","Right tail · T > t"]])+
      input("tdist","alpha","Total two-tailed α",.05,'min="0.000001" max="0.999999"')+'<p class="sl-hint">For a one-sample mean t procedure, df = n − 1. The critical values below use α/2 in each tail, independently of the observed-t shading.</p>',
      "Explore Student’s t, compare it with the standard normal curve and find two-tailed critical values.");

    const query=new URLSearchParams(location.search);
    for(const t of extra)panels[t].querySelectorAll("input,select").forEach(el=>{
      const key=`st_${t}_${el.name}`;if(query.has(key))el.value=query.get(key);
    });
    function updateVisibility(t) {
      if(t==="quantiles"){
        const pair=val(t,"kind")==="percentiles";$("st-quantiles-pair").hidden=!pair;$("st-quantiles-single").hidden=pair;
        $("st-quantiles-p").disabled=pair;$("st-quantiles-pl").disabled=$("st-quantiles-pu").disabled=!pair;
      }
      if(t==="sampling")for(const k of ["a","b"]){const unused=val(t,"mode")===(k==="a"?"left":"right");$(`st-sampling-${k}-wrap`).hidden=unused;$(`st-sampling-${k}`).disabled=unused;}
    }
    const renderers={
      quantiles(){
        const t="quantiles",mu=read(t,"mu"),sigma=sd(t,"sd"),kind=choice(t,"kind",["left","right","central","percentiles"]);
        let pl,pu,zl,zu,mass,regions,bounds;
        if(kind==="percentiles"){pl=unitP(t,"pl");pu=unitP(t,"pu");if(pl>=pu)throw new Error("The lower cumulative probability must be smaller than the upper probability.");}
        else {const p=unitP(t,"p");if(kind==="central"){pl=(1-p)/2;pu=1-pl;}else if(kind==="left")pu=p;else pl=1-p;}
        zl=pl===undefined?null:M.normalInv(pl);zu=pu===undefined?null:M.normalInv(pu);
        mass=kind==="left"?pu:kind==="right"?1-pl:pu-pl;
        bounds=[zl,zu].filter(x=>x!==null);regions=[[zl??-Infinity,zu??Infinity]];
        const lower=zl===null?null:mu+sigma*zl,upper=zu===null?null:mu+sigma*zu;
        const pWork=kind==="central"?`pₗ = (1 − ${f(mass)}) / 2 = ${f(pl)}\npᵤ = 1 − pₗ = ${f(pu)}`:kind==="percentiles"?`Enclosed probability = ${f(pu)} − ${f(pl)} = ${f(mass)}`:kind==="left"?`P(X ≤ x) = ${f(pu)}`:`P(X > x) = ${f(mass)}\nCumulative probability = 1 − ${f(mass)} = ${f(pl)}`;
        const values=[...(lower===null?[]:[[kind==="right"?"Cutoff X":"Lower cutoff X",f(lower)]]),...(upper===null?[]:[[kind==="left"?"Cutoff X":"Upper cutoff X",f(upper)]]),["Selected area",pct(mass)]];
        const invert=bounds.map((z,i)=>`z = Φ⁻¹(${f(kind==="left"?pu:i===0?pl:pu)}) = ${f(z,7)}`).join("\n");
        return `<h3>Your probability, translated into values.</h3>${curve("st-quantile-curve",N.pdf,regions,{extent:Math.max(4,...bounds.map(x=>Math.abs(x)+.5)),mu,scale:sigma,bounds,title:"Normal cutoffs",axis:"X value",description:values.map(([a,b])=>`${a}: ${b}`).join(". ")})}${metrics(values)}${steps([["Convert the requested area",pWork,"Cumulative probabilities always count from the far left."],["Invert the normal distribution",invert,"The inverse CDF finds the z-score having this left-hand area."],["Return to the original scale",bounds.map(z=>`x = μ + σz = ${f(mu)} + ${f(sigma)} × (${f(z,7)}) = ${f(mu+sigma*z)}`).join("\n"),"Keep unrounded z-scores until the final answer."]])}${excel(bounds.map((z,i)=>`=NORM.INV(${kind==="left"?pu:i===0?pl:pu},${mu},${sigma})`).join("\n"))}${refs([sources.normal])}`;
      },
      sampling(){
        const t="sampling",mu=read(t,"mu"),sigma=sd(t,"sd"),n=read(t,"n",1,1000000,true),mode=choice(t,"mode",["between","outside","left","right"]),model=choice(t,"model",["normal","clt"]);
        const a=mode==="left"?mu:read(t,"a"),b=mode==="right"?mu:read(t,"b"),coverage=read(t,"coverage",50,99.9)/100;
        const r=M.sampling(mu,sigma,n,a,b,mode),z=M.normalInv((1+coverage)/2),lower=mu-z*r.se,upper=mu+z*r.se;
        const regions=mode==="left"?[[-Infinity,r.zb]]:mode==="right"?[[r.za,Infinity]]:mode==="between"?[[r.za,r.zb]]:[[-Infinity,r.za],[r.zb,Infinity]];
        const bound=mode==="left"?[r.zb]:mode==="right"?[r.za]:[r.za,r.zb];
        const rule=mode==="left"?`Φ(${f(r.zb)})`:mode==="right"?`1 − Φ(${f(r.za)})`:mode==="between"?`Φ(${f(r.zb)}) − Φ(${f(r.za)})`:`Φ(${f(r.za)}) + 1 − Φ(${f(r.zb)})`;
        const excelCDF=x=>`NORM.DIST(${x},${mu},${sigma}/SQRT(${n}),TRUE)`;
        const equation=mode==="left"?excelCDF(b):mode==="right"?`1-${excelCDF(a)}`:mode==="between"?`${excelCDF(b)}-${excelCDF(a)}`:`${excelCDF(a)}+1-${excelCDF(b)}`;
        return `<h3>The distribution of X̄, not X.</h3>${note(model==="normal"?"Exact normal probabilities assume independent observations drawn from a normal population with the stated μ and σ.":"NORMAL APPROXIMATION: independence, finite variance and a sufficiently well-behaved sampling distribution are required. There is no universally sufficient sample size such as n = 30. For small or highly skewed samples, this approximation can be poor.")}${curve("st-sampling-curve",N.pdf,regions,{mu,scale:r.se,extent:Math.min(12,Math.max(4,...bound.map(z=>Math.abs(z)+.5))),bounds:bound,title:"Sampling distribution of the mean",axis:"Sample mean X̄",description:`Mean ${mu}; standard error ${r.se}; selected probability ${r.p}.`})}${metrics([["Standard error",f(r.se)],[model==="normal"?"Probability":"Approximate probability",f(r.p,7)],["Selected area",pct(r.p)]])}${steps([["Choose the correct spread",`SE(X̄) = σ / √n = ${sigma} / √${n} = ${f(r.se)}`,"Do not use σ alone when the question is about a sample mean."],["Standardize and find the area",`${mode!=="left"?`zₐ = (${a} − ${mu}) / ${f(r.se)} = ${f(r.za)}\n`:""}${mode!=="right"?`zᵦ = (${b} − ${mu}) / ${f(r.se)} = ${f(r.zb)}\n`:""}${rule} ≈ ${f(r.p,7)}`,"The probability calculation uses unrounded values."],[`Find the central ${pct(coverage)} sampling interval`,`μ ± z*SE = ${mu} ± ${f(z)} × ${f(r.se)}\n[${f(lower)}, ${f(upper)}]`,"This predicts the spread of future sample means around a known μ. It is NOT a confidence interval estimating an unknown μ."]])}${excel(`=${equation}`)}${refs([sources.normal])}`;
      },
      confidence(){
        const t="confidence",method=choice(t,"method",["t","z"]),mean=read(t,"mean"),s=sd(t,"sd"),n=read(t,"n",method==="t"?2:1,method==="t"?10001:1000000,true),level=read(t,"level",50,99.9)/100;
        const r=M.meanInterval(mean,s,n,level,method),critical=method==="t"?`t*(df=${r.df})`:'z*';
        const formula=method==="t"?`T.INV.2T(${f(1-level,8)},${n-1})`:`NORM.S.INV(${(1+level)/2})`;
        return `<p class="sl-eyebrow">TWO-SIDED ${pct(level)} CONFIDENCE INTERVAL</p><h3>[${f(r.lower)}, ${f(r.upper)}]</h3>${intervalPlot("st-ci",r.lower,mean,r.upper,"Confidence interval")}${metrics([["Standard error",f(r.se)],[critical,f(r.critical)],["Margin of error",f(r.margin)]])}${steps([["Select the method",method==="t"?`σ unknown → use sample s = ${s}\ndf = n − 1 = ${r.df}`:`Known population σ = ${s} → use z`,method==="t"?"Using s rather than known σ introduces extra uncertainty; Student’s t accounts for it under the normal model.":"Do not choose z merely because the sample size is above 30; this option requires a known population SD."],["Calculate the critical value and margin",`SE = ${s} / √${n} = ${f(r.se)}\n${critical} = ${f(r.critical,7)}\nMargin = critical × SE = ${f(r.margin)}`,"Two-sided confidence divides the excluded area equally between both tails."],["Build and interpret the interval",`${mean} ± ${f(r.margin)}\n[${f(r.lower)}, ${f(r.upper)}]`,`In repeated sampling under the model, about ${pct(level)} of intervals constructed by this method contain the fixed population mean. This is not a ${pct(level)} probability assigned to μ after seeing this particular interval, nor an interval covering ${pct(level)} of individual observations.`]])}${note("For small samples, strong skewness or outliers can make the normal-population assumption unreliable. Increasing the confidence level widens the interval; increasing n narrows it when the SD is held fixed.")}${excel(`Lower: =${mean}-${formula}*${s}/SQRT(${n})\nUpper: =${mean}+${formula}*${s}/SQRT(${n})`)}${refs([sources.ci,sources.t])}`;
      },
      descriptive(){
        const t="descriptive",data=M.parseData(val(t,"data"),choice(t,"decimal",["point","comma"])),method=choice(t,"quartile",["inclusive","exclusive","halves"]),bins=read(t,"bins",1,40,true),d=M.describe(data,method);
        const range=`A1:A${d.n}`,methodLabel={inclusive:"Inclusive linear interpolation · Excel QUARTILE.INC",exclusive:"Exclusive linear interpolation · Excel QUARTILE.EXC",halves:"Median of each half, excluding the middle observation when n is odd"}[method];
        const qWork=method==="halves"?`Lower-half median = ${f(d.q1)}\nUpper-half median = ${f(d.q3)}`:`1-based rank h = ${method==="inclusive"?"1 + (n − 1)p":"(n + 1)p"}\nInterpolate between neighbouring ordered values.\nQ1 = ${f(d.q1)}; Q3 = ${f(d.q3)}`;
        const modeText=d.modes.length?d.modes.slice(0,12).map(x=>f(x)).join(", ")+(d.modes.length>12?` … (${d.modes.length} tied values)`:""):"None (all values unique)";
        const rows=d.sorted.slice(0,100).map((x,i)=>`<tr><td>${i+1}</td><td>${f(x)}</td><td>${f(x-d.mean)}</td><td>${f((x-d.mean)**2)}</td></tr>`).join("");
        return `<h3>Your data, from centre to spread.</h3>${metrics([["Observations · n",d.n],["Mean",f(d.mean)],["Median · Q2",f(d.median)],["Sample SD · s",f(d.sampleSD)],["Sample variance · s²",f(d.sampleVariance)],["Population SD",f(d.popSD)],["Population variance",f(d.popVariance)],["Q1",f(d.q1)],["Q3",f(d.q3)],["IQR",f(d.iqr)],["Minimum / maximum",`${f(d.min)} / ${f(d.max)}`],["Range",f(d.range)]])}<p class="sl-small"><strong>Mode:</strong> ${esc(modeText)}. <strong>Sum:</strong> ${f(d.sum)}.</p><h3 class="sl2-chart-title">Histogram · frequency, not density</h3>${histogram("st-data-histogram",data,bins)}<p class="sl-hint">Equal-width bins include their left endpoint; the final bin also includes the maximum. Constant data use one bin. Hover a bar for its count.</p><h3 class="sl2-chart-title">Box plot · ${esc(methodLabel)}</h3>${boxplot(d)}<p class="sl-small">Whiskers: ${f(d.lowWhisker)} to ${f(d.highWhisker)}. Flagged observations: <strong>${d.outliers.length}</strong>. Whiskers are actual observations within the fences, not the fence values.</p>${steps([["Compute the centre",`Mean = Σx / n = ${f(d.sum)} / ${d.n} = ${f(d.mean)}\nMedian = ${f(d.median)}`,"The median uses the sorted data; the mean uses every value."],["Choose the variance denominator",`Σ(x − x̄)² = ${f(d.ss)}\nPopulation variance = ${f(d.ss)} / ${d.n} = ${f(d.popVariance)}\n${d.n>1?`Sample variance = ${f(d.ss)} / (${d.n} − 1) = ${f(d.sampleVariance)}\nSample SD = √sample variance = ${f(d.sampleSD)}`:"Sample variance and SD are undefined for n = 1."}`,"Use n − 1 when estimating population variance from a sample; use n when describing the complete population at hand."],["Find quartiles and fences",`${qWork}\nIQR = Q3 − Q1 = ${f(d.iqr)}\nFences: Q1 − 1.5 IQR = ${f(d.lowerFence)}; Q3 + 1.5 IQR = ${f(d.upperFence)}`,"Quartile conventions can legitimately disagree. Flagged outliers are prompts to investigate, not automatic reasons to remove observations."]])}<details class="sl2-excel"><summary>Inspect sorted values and squared deviations</summary><p class="sl-hint">First ${Math.min(100,d.n)} of ${d.n} rows shown; calculations include every observation. Values below are display-rounded.</p><div class="sl2-table-wrap"><table><thead><tr><th>Rank</th><th>x</th><th>x − mean</th><th>(x − mean)²</th></tr></thead><tbody>${rows}</tbody></table></div></details>${excel(`Assuming the raw data occupy ${range}:\n=AVERAGE(${range})\n=MEDIAN(${range})\n=VAR.S(${range})\n=STDEV.S(${range})\n=VAR.P(${range})\n=STDEV.P(${range})\n${method==="halves"?"Median-of-halves requires splitting the sorted range; it is not QUARTILE.INC or QUARTILE.EXC.":`=QUARTILE.${method==="inclusive"?"INC":"EXC"}(${range},1)\n=QUARTILE.${method==="inclusive"?"INC":"EXC"}(${range},3)`}`)}${refs([sources.q,sources.excel])}`;
      },
      tdist(){
        const t="tdist",df=read(t,"df",1,10000,true),observed=read(t,"t",-100,100),alpha=unitP(t,"alpha"),view=choice(t,"view",["two","left","right"]);
        const left=M.tCDF(observed,df),right=M.tSF(observed,df),two=2*M.tSF(Math.abs(observed),df),critical=M.tInv(1-alpha/2,df);
        const regions=view==="left"?[[-Infinity,observed]]:view==="right"?[[observed,Infinity]]:[[-Infinity,-Math.abs(observed)],[Math.abs(observed),Infinity]];
        const p=view==="left"?left:view==="right"?right:two;
        return `<h3>Selected tail area ≈ ${f(p,7)}</h3>${curve("st-t-curve",x=>M.tPDF(x,df),regions,{extent:Math.min(12,Math.max(4,Math.abs(observed)+.5)),overlay:true,bounds:view==="two"?[-Math.abs(observed),Math.abs(observed)]:[observed],title:`Student t, df ${df}`,axis:"t value",caption:"Solid: Student t. Dashed: standard normal. The drawing is clipped at ±12 at most; computed tails are not clipped."})}${metrics([["Left tail",f(left,7)],["Right tail",f(right,7)],["Two tails",f(two,7)]])}${note(`Two-tailed critical values at α = ${alpha}: −${f(critical)} and +${f(critical)}. These cutoffs leave ${f(alpha/2)} in each tail; they are separate from the observed t used for shading.`)}${steps([["Specify degrees of freedom",`df = ${df}`,"In a one-sample t procedure df is n − 1; other procedures can use different rules."],["Read the requested area",view==="two"?`P(|T| > ${f(Math.abs(observed))}) = 2 × P(T > ${f(Math.abs(observed))})\n≈ ${f(two,7)}`:view==="left"?`P(T ≤ ${observed}) ≈ ${f(left,7)}`:`P(T > ${observed}) ≈ ${f(right,7)}`,"This is a tail probability under the specified distribution. In a correctly specified test it can be a p-value; it is not the probability that the null hypothesis is true."],["Find the critical values",`t* = F⁻¹(${f(1-alpha/2,8)}; df=${df}) = ${f(critical)}\nCritical pair: ±${f(critical)}`,"As df increases, t approaches the standard normal. With few degrees of freedom its heavier tails increase the critical value."]])}${excel(`Left: =T.DIST(${observed},${df},TRUE)\nRight: =T.DIST.RT(${observed},${df})\nTwo tails: =T.DIST.2T(ABS(${observed}),${df})\nCritical value: =T.INV.2T(${alpha},${df})`)}${refs([sources.t,sources.ci])}`;
      }
    };
    function compute(t) {
      updateVisibility(t);panels[t].querySelectorAll('[aria-invalid="true"]').forEach(el=>el.removeAttribute("aria-invalid"));
      const result=$(`st-${t}-result`),error=$(`st-${t}-error`);
      try {result.innerHTML=renderers[t]();result.hidden=false;error.hidden=true;valid[t]=true;$(`st-${t}-status`).textContent=`${names[t]} updated. `+[...result.querySelectorAll(".sl2-metric")].slice(0,3).map(el=>el.textContent).join(". ");}
      catch(e){result.replaceChildren();result.hidden=true;error.textContent=e.message;error.hidden=false;valid[t]=false;}
      if(active===t)$("st-copy").disabled=$("st-share").disabled=!valid[t];
      return valid[t];
    }

    // A separate seeded CLT experiment. It does not silently change the calculator's assumptions.
    const sim=document.createElement("section");sim.className="sl-card sl2-simulator";
    sim.innerHTML=`<p class="sl-eyebrow">EXPERIMENT / CENTRAL LIMIT THEOREM</p><h2>Watch sample means take shape.</h2><p class="sl-small">All three simulated populations have μ = 0 and σ = 1. Each histogram shows 500 independently drawn sample means, not individual observations.</p><form id="st-sim-form" class="sl2-sim-controls" novalidate>${select("sim","shape","Population shape",[["skewed","Right-skewed (shifted exponential)"],["normal","Normal"],["uniform","Uniform"]])}${input("sim","n","Observations per sample",30,'min="1" max="500" step="1"')}${input("sim","seed","Reproducible seed",2026,'min="1" max="2147483646" step="1"')}<button class="sl-button" type="submit">Draw 500 samples →</button></form><p id="st-sim-error" class="sl-error" role="alert" hidden></p><div id="st-sim-result"></div><p class="sl-hint">Change n and keep the seed for a reproducible experiment. The dashed curve is the normal approximation, not a claim that every finite-sample distribution is normal. For a skewed population, try n = 1, 5, 30 and 100.</p>`;
    panels.sampling.appendChild(sim);
    sim.querySelectorAll("input,select").forEach(el=>{const key=`st_sim_${el.name}`;if(query.has(key))el.value=query.get(key);});
    function runSim(){
      try {const n=read("sim","n",1,500,true),seed=read("sim","seed",1,2147483646,true),r=M.simulate(choice("sim","shape",["normal","skewed","uniform"]),n,500,seed),d=M.describe(r.means);
        $("st-sim-result").innerHTML=histogram("st-sim-histogram",r.means,20,r.se)+metrics([["Theoretical mean",0],["Observed mean of means",f(d.mean)],["Theoretical SE",f(r.se)],["Observed SD of means",f(d.sampleSD)]]);$("st-sim-error").hidden=true;
      }catch(e){$("st-sim-result").replaceChildren();$("st-sim-error").textContent=e.message;$("st-sim-error").hidden=false;}
    }
    $("st-sim-form").addEventListener("submit",e=>{e.preventDefault();runSim();});

    function activate(t,focus=false){
      if(!keys.includes(t))t="normal";active=t;$("sl-status").textContent="";
      for(const key of keys){$(`sl-panel-${key}`).hidden=key!==t;const button=$(`sl-tab-${key}`);button.setAttribute("aria-selected",String(key===t));button.tabIndex=key===t?0:-1;}
      guide.textContent=hints[t];actions.hidden=!extra.includes(t);$("sl-share").hidden=extra.includes(t);
      if(extra.includes(t)){
        if(!initialized.has(t)){compute(t);initialized.add(t);if(t==="sampling")runSim();}
        $("st-copy").disabled=$("st-share").disabled=!valid[t];
      }
      if(focus)$(`sl-tab-${t}`).focus();
    }
    // Existing v1 handlers run first. Delegation then hides every inactive v2 panel.
    host.addEventListener("click",e=>{
      const button=e.target.closest('[role="tab"]');
      if(button&&tablist.contains(button))activate(button.id.replace("sl-tab-",""));
      if(e.target.closest("[data-lookup]"))activate("ztable");
    });
    tablist.addEventListener("keydown",e=>{
      const button=e.target.closest('[role="tab"]');if(!button||!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;
      e.preventDefault();e.stopImmediatePropagation();const index=keys.indexOf(button.id.replace("sl-tab-",""));
      const next=e.key==="Home"?0:e.key==="End"?keys.length-1:(index+(e.key==="ArrowRight"?1:-1)+keys.length)%keys.length;
      $(`sl-tab-${keys[next]}`).click();activate(keys[next],true);
    },true);
    async function copy(text){
      try{if(!navigator.clipboard||!window.isSecureContext)throw new Error();await navigator.clipboard.writeText(text);$("sl-status").textContent="Copied.";}
      catch(_){$("sl-copy-fallback").hidden=false;$("sl-copy-text").value=text;$("sl-copy-text").focus();$("sl-copy-text").select();$("sl-status").textContent="Select and copy the text below.";}
    }
    $("st-copy").addEventListener("click",()=>{
      if(!extra.includes(active)||!compute(active))return;
      const snapshot=$(`st-${active}-result`).cloneNode(true);snapshot.querySelectorAll(".sl2-table-wrap").forEach(el=>el.remove());
      const copiedResult=[...snapshot.querySelectorAll("h3,p,pre,.sl2-metric,summary")].map(el=>el.textContent.trim()).filter(Boolean).join("\n\n");
      const fields=[...$(`st-${active}-form`).querySelectorAll("input,select")].filter(el=>!el.disabled).map(el=>`${el.closest("label").querySelector("span").textContent}: ${el.value}`).join("\n");
      copy(`EU-HEM Interactive Statistics Lab v2\n${names[active]}\n${fields}\n\n${copiedResult}\n\nStudent-made educational tool. Check model assumptions and rounding. Dataset not included.`);
    });
    $("st-share").addEventListener("click",()=>{
      if(!extra.includes(active)||!compute(active))return;
      const url=new URL(location.href);
      [...url.searchParams.keys()].forEach(k=>{if(k.startsWith("st_")||k.startsWith("lab"))url.searchParams.delete(k);});
      if(url.pathname.endsWith("course.html")){url.searchParams.set("course","quant-methods");url.searchParams.set("tab","lab");}
      url.searchParams.set("labtool",active);
      $(`st-${active}-form`).querySelectorAll("input,select").forEach(el=>{if(!el.disabled)url.searchParams.set(`st_${active}_${el.name}`,el.value);});
      if(active==="sampling")$("st-sim-form").querySelectorAll("input,select").forEach(el=>url.searchParams.set(`st_sim_${el.name}`,el.value));
      if(active==="descriptive")$("sl-status").textContent="The link excludes your dataset; it opens the sample data.";
      copy(url.href);
    });
    $("sl-copy-close").addEventListener("click",()=>{$("sl-status").textContent="";if(extra.includes(active))$("st-share").focus();});
    const methods=host.querySelector(".sl-methods > div"),p=document.createElement("p");
    p.textContent="v2 adds inverse-normal cutoffs, sampling means and a seeded CLT demonstration, z/t mean confidence intervals, descriptive statistics with explicit quartile conventions, and Student t tails. Each tool states its own assumptions and references. t calculations support df 1–10000. New tool setup links omit raw datasets. Calculations use floating-point arithmetic; displayed results are rounded. No tool assesses whether your data satisfy its statistical assumptions.";
    methods.prepend(p);
    activate(keys.includes(query.get("labtool"))?query.get("labtool"):(query.get("labtool")==="ztable"?"ztable":"normal"));
  }
  root.StatisticsLab=Object.freeze({mount(host){base.mount(host);if(host&&host.querySelector(".sl-tabs"))extend(host);}});
})(typeof globalThis!=="undefined"?globalThis:this);
