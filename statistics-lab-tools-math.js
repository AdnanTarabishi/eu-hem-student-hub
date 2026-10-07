/* Interactive Statistics Lab v2: pure, dependency-free teaching calculations.
 * The normal core is reused unchanged. t probabilities use the incomplete beta
 * relationship (R stats TDist documentation / NIST DLMF 8.17).
 * All inverses use bracketed bisection; no rounded table values enter calculations.
 */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(require("./statistics-lab-math.js"));
  else root.StatisticsLabToolsMath = factory(root.StatisticsLabMath);
})(typeof globalThis !== "undefined" ? globalThis : this, function (N) {
  "use strict";
  const finite = (...xs) => { if (!xs.every(Number.isFinite)) throw new RangeError("Use finite numeric values."); };
  const positive = (v, name) => { finite(v); if (v <= 0) throw new RangeError(`${name} must be greater than 0.`); };
  const count = (v, min = 1, max = 1000000) => { if (!Number.isInteger(v) || v < min || v > max) throw new RangeError(`Use a whole-number sample size from ${min} to ${max}.`); };
  function probability(p) { finite(p); if (p <= 0 || p >= 1) throw new RangeError("Enter a probability strictly between 0 and 1 (not a percentage)."); }
  function inverseTail(p, tail) {
    probability(p);
    if (p === .5) return 0;
    const q = Math.min(p, 1 - p);
    let lo = 0, hi = 1;
    while (tail(hi) > q) {
      hi *= 2;
      if (hi > 1e16) throw new RangeError("This probability is outside the supported inverse range.");
    }
    for (let i = 0; i < 100; i++) {
      const mid = lo + (hi - lo) / 2;
      if (mid === lo || mid === hi) break;
      if (tail(mid) > q) lo = mid; else hi = mid;
    }
    return (p < .5 ? -1 : 1) * (lo + (hi - lo) / 2);
  }
  const normalInv = p => inverseTail(p, N.sf);

  // Lanczos approximation of log Γ for positive arguments; g = 7.
  function logGamma(z) {
    positive(z, "Gamma argument");
    const c = [676.5203681218851,-1259.1392167224028,771.3234287776531,-176.6150291621406,12.507343278686905,-.13857109526572012,9.984369578019572e-6,1.5056327351493116e-7];
    if (z < .5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI*z)) - logGamma(1-z);
    z -= 1;
    let sum = .99999999999980993;
    c.forEach((v,i) => { sum += v/(z+i+1); });
    const t = z+7.5;
    return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(sum);
  }
  function betaFraction(a, b, x) {
    const tiny = 1e-290, safe = v => Math.abs(v) < tiny ? (v < 0 ? -tiny : tiny) : v;
    let c = 1, d = 1/safe(1-(a+b)*x/(a+1)), h = d;
    for (let m = 1; m <= 500; m++) {
      const aa = [m*(b-m)*x/((a+2*m-1)*(a+2*m)), -(a+m)*(a+b+m)*x/((a+2*m)*(a+2*m+1))];
      let delta = 1;
      for (const v of aa) { d=1/safe(1+v*d); c=safe(1+v/c); delta=d*c; h*=delta; }
      if (Math.abs(delta-1) < 3e-14) return h;
    }
    throw new RangeError("The probability calculation did not converge for these inputs.");
  }
  function betaI(x, a, b) {
    positive(a, "Beta shape"); positive(b, "Beta shape"); finite(x);
    if (x < 0 || x > 1) throw new RangeError("Beta argument must be between 0 and 1.");
    if (x === 0 || x === 1) return x;
    const scale = Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log1p(-x));
    const value = x < (a+1)/(a+b+2) ? scale*betaFraction(a,b,x)/a : 1-scale*betaFraction(b,a,1-x)/b;
    return Math.max(0, Math.min(1, value));
  }
  function degrees(df) { finite(df); if (df < 1 || df > 10000) throw new RangeError("Degrees of freedom must be between 1 and 10000."); }
  function tPDF(t, df) {
    finite(t); degrees(df);
    return Math.exp(logGamma((df+1)/2)-logGamma(df/2)-.5*Math.log(df*Math.PI)-(df+1)/2*Math.log1p(t*t/df));
  }
  function tSF(t, df) {
    finite(t); degrees(df);
    if (t === 0) return .5;
    // Near zero use the complementary beta in t²/(df+t²), retaining tiny t.
    const s = t*t, x = df/(df+s);
    const tail = x > .99 ? .5-.5*betaI(s/(df+s),.5,df/2) : .5*betaI(x,df/2,.5);
    return t < 0 ? 1-tail : tail;
  }
  const tCDF = (t, df) => tSF(-t, df);
  function tInv(p, df) { degrees(df); return inverseTail(p, t => tSF(t,df)); }
  function meanInterval(mean, sd, n, level, method) {
    finite(mean); positive(sd, "Standard deviation"); count(n, method === "t" ? 2 : 1, method === "t" ? 10001 : 1000000); probability(level);
    if (!["z", "t"].includes(method)) throw new RangeError("Choose z (known population SD) or t (sample SD).");
    const se=sd/Math.sqrt(n), df=method === "t" ? n-1 : null;
    const critical=method === "t" ? tInv((1+level)/2,df) : normalInv((1+level)/2);
    const margin=critical*se;
    const lower=mean-margin, upper=mean+margin;
    finite(se,critical,margin,lower,upper);
    return {se,df,critical,margin,lower,upper,level,method};
  }
  function sampling(mu, sigma, n, a, b, mode) {
    finite(mu); positive(sigma, "Population standard deviation"); count(n);
    const se=sigma/Math.sqrt(n);
    const za=N.standardize(mode === "left" ? mu : a,mu,se), zb=N.standardize(mode === "right" ? mu : b,mu,se);
    return {se,za,zb,p:N.probability(mode,za,zb)};
  }
  function parseData(text, decimal = "point") {
    if (typeof text !== "string" || !text.trim()) throw new RangeError("Paste at least one numeric observation.");
    if (text.length > 150000) throw new RangeError("Use at most 5000 observations.");
    if (!["point", "comma"].includes(decimal)) throw new RangeError("Choose a decimal format.");
    // Do not turn missing CSV cells into zero or silently remove invalid tokens.
    const emptyCell = decimal === "point" ? /[,;]\s*[,;]/ : /;\s*;/;
    if (emptyCell.test(text.trim()) || /\t[ \t]*\t/.test(text) || (decimal === "point" ? /^[,;]|[,;]$/.test(text.trim()) : /^;|;$/.test(text.trim()))) throw new RangeError("A blank cell was found. Remove it or supply its value; missing cells are not zero.");
    const tokens=text.trim().split(decimal === "comma" ? /[;\s]+/ : /[,;\s]+/);
    if (tokens.length > 5000) throw new RangeError("Use at most 5000 observations.");
    return tokens.map((token,i) => {
      if (decimal === "comma") token=token.replace(",", ".");
      if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(token)) throw new RangeError(`Observation ${i+1} is not a valid number. Remove headers, units and missing-value markers.`);
      const n=Number(token);
      if (!Number.isFinite(n) || Math.abs(n)>1e12) throw new RangeError(`Observation ${i+1} must be finite with magnitude no greater than 10¹².`);
      return n;
    });
  }
  const median = sorted => sorted.length%2 ? sorted[(sorted.length-1)/2] : (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;
  function quantile(sorted, p, method = "inclusive") {
    if (!sorted.length) throw new RangeError("No observations.");
    let h;
    if (method === "exclusive") {
      h=(sorted.length+1)*p-1;
      if (h<0 || h>sorted.length-1) throw new RangeError("Exclusive quartiles require at least 3 observations.");
    } else if (method === "inclusive") h=(sorted.length-1)*p;
    else throw new RangeError("Unknown quantile method.");
    const lo=Math.floor(h), hi=Math.ceil(h);
    return sorted[lo]+(h-lo)*(sorted[hi]-sorted[lo]);
  }
  function describe(data, method="inclusive") {
    if (!Array.isArray(data) || !data.length || data.length>5000) throw new RangeError("Use 1–5000 numeric observations.");
    data.forEach(x => { finite(x); if(Math.abs(x)>1e12) throw new RangeError("Values must have magnitude ≤ 10¹²."); });
    const sorted=[...data].sort((a,b)=>a-b), n=sorted.length;
    let mean=0; sorted.forEach((x,i)=>{mean+=(x-mean)/(i+1);});
    let ss=0, correction=0;
    sorted.forEach(x=>{const y=(x-mean)**2-correction,t=ss+y;correction=(t-ss)-y;ss=t;});
    let q1,q3;
    if (method==="halves") {
      if(n===1) q1=q3=sorted[0];
      else {q1=median(sorted.slice(0,Math.floor(n/2)));q3=median(sorted.slice(Math.ceil(n/2)));}
    } else {q1=quantile(sorted,.25,method);q3=quantile(sorted,.75,method);}
    const med=median(sorted), iqr=q3-q1, lowerFence=q1-1.5*iqr, upperFence=q3+1.5*iqr;
    const inside=sorted.filter(x=>x>=lowerFence && x<=upperFence), outliers=sorted.filter(x=>x<lowerFence || x>upperFence);
    const counts=new Map(); sorted.forEach(x=>counts.set(x,(counts.get(x)||0)+1));
    const frequency=Math.max(...counts.values()), modes=frequency===1 ? [] : [...counts.keys()].filter(x=>counts.get(x)===frequency);
    return {n,sorted,mean,median:med,sum:mean*n,ss,min:sorted[0],max:sorted[n-1],range:sorted[n-1]-sorted[0],q1,q3,iqr,lowerFence,upperFence,lowWhisker:inside[0],highWhisker:inside[inside.length-1],outliers,modes,frequency,popVariance:ss/n,sampleVariance:n>1?ss/(n-1):null,popSD:Math.sqrt(ss/n),sampleSD:n>1?Math.sqrt(ss/(n-1)):null,method};
  }
  function histogram(data, bins=10) {
    count(bins,1,40); if(!data.length) throw new RangeError("No observations.");
    let min=Math.min(...data), max=Math.max(...data);
    if(min===max){const pad=Math.max(1,Math.abs(min)*.05);min-=pad;max+=pad;bins=1;}
    const width=(max-min)/bins, counts=Array(bins).fill(0);
    for(const x of data) counts[Math.min(bins-1,Math.max(0,Math.floor((x-min)/width)))]++;
    return {min,max,width,counts,n:data.length};
  }
  // Deterministic educational simulation, not a cryptographic random generator.
  function simulate(shape,n,repetitions=500,seed=2026) {
    count(n,1,500);count(repetitions,1,2000);count(seed,1,2147483646);
    if(!["normal","uniform","skewed"].includes(shape)) throw new RangeError("Unknown population shape.");
    let state=seed;
    const uniform=()=>{state=state*16807%2147483647;return state/2147483647;};
    const draw=()=>shape==="uniform" ? (uniform()-.5)*Math.sqrt(12) : shape==="skewed" ? -Math.log(uniform())-1 : Math.sqrt(-2*Math.log(uniform()))*Math.cos(2*Math.PI*uniform());
    const means=[];
    for(let i=0;i<repetitions;i++){let sum=0;for(let j=0;j<n;j++)sum+=draw();means.push(sum/n);}
    return {means,theoreticalMean:0,se:1/Math.sqrt(n),shape,n,repetitions,seed};
  }
  return Object.freeze({normalInv,tPDF,tSF,tCDF,tInv,meanInterval,sampling,parseData,describe,quantile,histogram,simulate});
});
