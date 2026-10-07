/* Solve a Problem v1: explicit educational rules and transparent arithmetic.
 * Pure functions, no network, stored user data or arbitrary expression evaluation.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ToolkitSolveCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const refs=Object.freeze({
    mean:'https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm',
    two:'https://www.itl.nist.gov/div898/handbook/eda/section3/eda353.htm',
    proportion:'https://www.itl.nist.gov/div898/handbook/prc/section2/prc24.htm',
    interval:'https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm',
    nmb:'https://www.yhec.co.uk/glossary-term/net-monetary-benefit/',
    qaly:'https://www.yhec.co.uk/glossary-term/quality-adjusted-life-year-qaly/',
    excel:'https://support.microsoft.com/en-us/excel/statistical-functions-reference',
    npv:'https://support.microsoft.com/en-us/excel/functions/npv-function'
  });
  const finite=(v,name,min=-1e12,max=1e12)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new RangeError(`${name}: use a finite number from ${min} to ${max}.`);return v;};
  const count=(v,name,min=1,max=1000000)=>{finite(v,name,min,max);if(!Number.isInteger(v))throw new RangeError(`${name} must be a whole number.`);return v;};
  const option=(v,allowed,name)=>{if(!allowed.includes(v))throw new RangeError(`Choose a valid ${name}.`);return v;};
  function labURL(tool,course='fundamentals',params={}){
    option(course,['fundamentals','statistics'],'course');
    const tools=['normal','ztable','quantiles','sampling','confidence','descriptive','mean-test','proportion-ci','proportion-test','two-means','discrete','tdist'];
    option(tool,tools,'lab tool');
    const q=new URLSearchParams({course:course==='fundamentals'?'fund-quant-methods':'quant-methods',tab:'lab',labtool:tool});
    for(const [k,v] of Object.entries(params)){
      if(!/^sl3_[a-z-]+_[a-zA-Z0-9]+$|^st_[a-z]+_[a-z]+$/.test(k)||!['number','string'].includes(typeof v)||String(v).length>50)throw new RangeError('Invalid calculator preset.');
      q.set(k,String(v));
    }
    return 'course.html?'+q;
  }
  function chooseMethod(s){
    if(!s||typeof s!=='object')throw new TypeError('Complete the question guide.');
    const goal=option(s.goal,['describe','probability','estimate','test'],'goal'),course=option(s.course,['fundamentals','statistics'],'course');
    const base={course,title:'',why:[],checks:[],warning:'This rule-based guide cannot assess your raw data or verify its assumptions. It is not statistical advice for research decisions.',href:null,status:'review',source:refs.mean};
    const out=(title,why,checks,tool=null,preset={},status=tool?'ready':'review',source=refs.mean)=>({...base,title,why,checks,href:tool?labURL(tool,course,preset):null,status,source});
    if(goal==='describe')return out('Describe before you test',['Your goal is to summarise, not test a population claim.'],['Use a numeric variable for the data summary; check missing values and the quartile convention.'],'descriptive');
    if(goal==='probability')return out('Choose a probability model first',['A distribution must be specified or justified before calculating an area.'],['The normal lab is for a stated normal model. For a specified discrete probability table, use Discrete Probability instead.'],'normal');
    const outcome=option(s.outcome,['numeric','binary','other'],'outcome type'),groups=option(s.groups,['one','two','many'],'number of groups'),design=option(s.design,['independent','paired','complex','unsure'],'design');
    if(design==='complex'||design==='unsure')return out('Clarify the design before choosing a method',['Clustering, repeated observations beyond one pair, weighting or an unknown sampling unit can invalidate ordinary independent-sample methods.'],['Ask your instructor how to define the observational unit and dependence structure. Do not treat repeated records as independent people.'],null,{},'outside');
    if(outcome==='other')return out('This outcome needs a different route',['Ordinal categories, multicategory responses, counts/rates and survival times do not share one interchangeable test.'],['Specify the outcome and design. The present calculators do not implement a universal chi-square, rank, count or survival workflow.'],null,{},'outside');
    if(groups==='many')return out('More than two groups: plan an appropriate model',['Repeated pairwise tests can multiply false-positive risk.'],['An ANOVA, regression or another design-specific model may be appropriate; check assumptions and multiplicity with your instructor. No multi-group test is implemented here.'],null,{},'outside');
    if(design==='paired'&&groups!=='two')return out('Pairing needs two matched measurements',['Choose two groups/measurements when each participant contributes one pair.'],['Use the pairing in the design; equal sample sizes alone do not create pairs.'],null,{},'review',refs.two);
    const n=count(s.n,'Sample size / number of pairs',1);
    if(outcome==='numeric'){
      const model=option(s.model,['reasonable','uncertain','poor'],'distribution / approximation');
      if(model!=='reasonable')return out('Review the mean-model assumptions first',['The ordinary t/z route is conditional on a suitable sampling distribution. A sample-size threshold alone does not establish this.'],['Check outliers, skewness, sampling and independence. Rank-based tests target different hypotheses and are not an automatic substitute for every mean question.'],null,{},'review');
      if(groups==='one'||design==='paired'){
        const paired=design==='paired';const known=paired?'sample':option(s.sd,['known','sample','unsure'],'SD information');
        if(known==='unsure')return out('Identify whether the SD is known or estimated',['A reported sample SD is not a known population SD.'],['Check the wording of the exercise before selecting z or Student t.']);
        if(known==='sample'&&n<2)throw new RangeError('Student t requires at least two observations (or two paired differences).');
        if(known==='sample'&&n>10001)return out('Student t family; use software for this sample size',['This Hub t implementation is limited to df ≤ 10000.'],['Use a validated package; do not silently change methods just to fit the calculator.'],null,{},'outside');
        const tool=goal==='estimate'?'confidence':'mean-test',method=known==='known'?'z':'t';
        const preset=goal==='estimate'?{st_confidence_method:method,st_confidence_n:n}:{'sl3_mean-test_method':method,'sl3_mean-test_n':n};
        return out(paired?(goal==='estimate'?'Mean paired-difference interval':'Paired t: analyse the within-pair differences'):(goal==='estimate'?`${method==='t'?'Student t':'Known-SD z'} interval for one mean`:`${method==='t'?'One-sample t':'Known-SD z'} test for one mean`),
          [paired?'Reduce each matched pair to its signed difference. The linked one-mean tool then uses the mean and SD of those differences.':known==='known'?'The exercise supplies population σ, so the known-SD normal reference is appropriate under the model.':'Population σ is unknown; Student t uses sample s and df = n − 1, rather than an automatic switch at n = 30.'],
          [paired?'Use n PAIRS and SD of DIFFERENCES, never the two marginal SDs. No raw-pair subtraction is performed by this guide.':'Assume independent observations; exact t inference uses a normal population. Other uses require a defensible approximation.',goal==='estimate'?'The linked interval is two-sided.':'Choose one- or two-sided alternatives before looking at the result.',paired?'Paired calculations are supplementary in the current Fundamentals Topic 6 guide.':'Course-specific approximations may differ; follow the method explicitly required by the assignment.'],tool,preset,paired?'supplementary':'ready',paired?refs.two:refs.mean);
      }
      const n2=count(s.n2,'Group 2 sample size',2);if(n<2)throw new RangeError('Group 1 needs at least two observations.');
      const courseZ=course==='fundamentals'&&n>=30&&n2>=30;
      if(!courseZ&&(n>5001||n2>5001))return out('Independent mean comparison; use external software',['The Hub Welch tool is limited to n ≤ 5001 per group.'],['Do not round fractional degrees of freedom or force a paired method.'],null,{},'outside',refs.two);
      return out(courseZ?'Independent means: course large-sample z':'Independent means: Welch t',['The contrast is group 1 minus group 2.',courseZ?'The current Fundamentals Topic 6 guide uses this normal approximation for large samples.':'Welch does not assume equal population variances.'],['Independent groups, not before/after measurements.','n ≥ 30 is a course heuristic, not a universal guarantee of validity.','The linked workbench shows a test and a TWO-SIDED interval. Topic 6 is additional/time permitting; Welch is supplementary to that course recipe.'],'two-means',{'sl3_two-means_method':courseZ?'course-z':'welch','sl3_two-means_n1':n,'sl3_two-means_n2':n2},courseZ?'ready':'supplementary',refs.two);
    }
    if(groups!=='one'||design==='paired')return out('Binary outcomes in two groups need a dedicated procedure',['A one-proportion test cannot test a difference between two proportions. Paired binary responses also require the paired structure.'],['This release does not implement a two-proportion or McNemar workflow. Do not use the two-MEANS calculator for binary-group inference.'],null,{},'outside',refs.proportion);
    const k=count(s.k,'Observed successes',0,n);
    if(goal==='estimate'){
      const low=Math.min(k,n-k)<5,method=low?'wilson':'wald';
      return out(low?'Wilson score interval · supplementary':'Wald proportion interval · course recipe',[`Observed successes = ${k}; failures = ${n-k}.`,low?'The observed counts fail the course Wald minimum of 5 in each category.':'The observed counts meet the implemented course minimum.'],['Independent Bernoulli observations are required.',low?'Wilson is not an exact interval and is not the course Wald recipe.':'Counts below 10 in either category still warrant caution about approximation quality.','Wald intervals can leave [0,1]; the lab flags rather than clips them.'],'proportion-ci',{'sl3_proportion-ci_method':method,'sl3_proportion-ci_n':n,'sl3_proportion-ci_k':k},low?'supplementary':'ready',refs.interval);
    }
    const p0=finite(s.p0,'Null proportion',0,1);if(p0===0||p0===1)throw new RangeError('The null proportion must be strictly between 0 and 1.');
    if(Math.min(n*p0,n*(1-p0))<5)return out('Do not use this normal-approximation test',[`Under H₀, expected successes = ${n*p0}; failures = ${n*(1-p0)}. At least one is below 5.`],['An exact binomial approach or other appropriate method may be needed. No exact-test calculator is implemented here.'],null,{},'outside',refs.proportion);
    return out('One-proportion z test',['Check EXPECTED counts under π₀, not the observed counts used for a Wald interval.'],['The null SE is √[π₀(1−π₀)/n].','The count check does not verify independence. Below 10 expected per category, interpret the approximation cautiously.'],'proportion-test',{'sl3_proportion-test_n':n,'sl3_proportion-test_k':k,'sl3_proportion-test_nullProportion':p0},'ready',refs.proportion);
  }
  function costEffectiveness(v){
    const ca=finite(v.ca,'Option A cost'),cb=finite(v.cb,'Option B cost'),ea=finite(v.ea,'Option A effect',-1e6,1e6),eb=finite(v.eb,'Option B effect',-1e6,1e6),lambda=finite(v.lambda,'Threshold λ',0,1e9);
    const dc=ca-cb,de=ea-eb,nmb=lambda*de-dc,icer=de===0?null:dc/de;
    if(icer!==null&&!Number.isFinite(icer))throw new RangeError('Effect difference is too small for a representable ICER. Rescale the input.');
    const tolerance=32*Number.EPSILON*Math.max(1,Math.abs(lambda*de),Math.abs(dc));
    const preference=Math.abs(nmb)<=tolerance?'tie':nmb>0?'A':'B';
    let relation=de===0?(dc===0?'Same cost and effect':dc<0?'Equal effect; A costs less':'Equal effect; A costs more'):dc===0?(de>0?'Equal cost; A gains effect':'Equal cost; A loses effect'):de>0?(dc<0?'A dominates B':'More effect, more cost (NE)'):(dc>0?'A is dominated by B':'Less effect, less cost (SW)');
    return {ca,cb,ea,eb,lambda,dc,de,nmb,icer,preference,relation,nhb:lambda>0?nmb/lambda:null};
  }
  function parseRows(text,columns,max=101){
    if(typeof text!=='string'||!text.trim()||text.length>20000)throw new RangeError('Enter a small numeric table without a header.');
    const rows=text.trim().split(/\r?\n/);if(rows.length>max)throw new RangeError(`Use at most ${max} rows.`);
    return rows.map((line,i)=>{
      if(/[,;]\s*[,;]|\t[ \t]*\t/.test(line))throw new RangeError(`Row ${i+1} contains a missing cell.`);
      const a=line.trim().split(/[,;\s]+/);
      if(a.length!==columns||a.some(t=>!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(t)))throw new RangeError(`Row ${i+1}: enter exactly ${columns} numbers using decimal points.`);
      return a.map(x=>finite(Number(x),'Table value'));
    });
  }
  function qaly(rows){
    if(!Array.isArray(rows)||!rows.length||rows.length>30)throw new RangeError('Use 1–30 time periods.');
    let time=0,a=0,b=0;
    const periods=rows.map((r,i)=>{
      if(!Array.isArray(r)||r.length!==3)throw new RangeError('Each row needs years, utility A and utility B.');
      const years=finite(r[0],'Years',.000001,150),ua=finite(r[1],'Utility A',-1,1),ub=finite(r[2],'Utility B',-1,1),start=time;time+=years;
      if(time>150)throw new RangeError('The total horizon must not exceed 150 years.');
      a+=years*ua;b+=years*ub;return {period:i+1,start,end:time,years,ua,ub,qa:years*ua,qb:years*ub};
    });
    return {periods,time,a,b,difference:a-b};
  }
  function discount(rows,rc,re){
    finite(rc,'Annual cost rate',0,1);finite(re,'Annual effect rate',0,1);
    if(!Array.isArray(rows)||!rows.length||rows.length>101)throw new RangeError('Use 1–101 dated cash-flow rows.');
    const seen=new Set();let rawCost=0,rawEffect=0,cost=0,effect=0;
    const result=rows.map(r=>{
      if(!Array.isArray(r)||r.length!==3)throw new RangeError('Each row needs year, cost and effect.');
      const year=count(r[0],'Year',0,100),c=finite(r[1],'Cost'),e=finite(r[2],'Effect',-1e6,1e6);
      if(seen.has(year))throw new RangeError('Combine amounts occurring in the same year before entering them.');seen.add(year);
      const pc=c/(1+rc)**year,pe=e/(1+re)**year;rawCost+=c;rawEffect+=e;cost+=pc;effect+=pe;
      return {year,cost:c,effect:e,pvCost:pc,pvEffect:pe};
    }).sort((a,b)=>a.year-b.year);
    return {rows:result,rc,re,rawCost,rawEffect,cost,effect};
  }
  const intents=[
    {id:'ci',title:'Estimate a mean with a confidence interval',words:['confidence interval','interval for a mean','95%','فترة الثقة'],target:'lab',tool:'confidence'},
    {id:'prop',title:'Test a population proportion',words:['proportion','percentage','binary','نسبة'],target:'finder'},
    {id:'pair',title:'Compare matched or before/after measurements',words:['paired','before','after','matched','قبل','بعد'],target:'finder',preset:'paired'},
    {id:'choose',title:'Choose a statistical method',words:['test','hypothesis','compare','groups','اختبار'],target:'finder'},
    {id:'excel',title:'Find a copyable Excel formula',words:['excel','formula','spreadsheet','إكسل'],target:'excel'},
    {id:'health',title:'Compare costs and health effects',words:['icer','cost effectiveness','cost-effectiveness','net monetary','nmb','اقتصاد'],target:'health'},
    {id:'qaly',title:'Build QALYs from time and utility',words:['qaly','utility','quality-adjusted'],target:'health',preset:'qaly'},
    {id:'discount',title:'Discount future costs and effects',words:['discount','npv','present value','خصم'],target:'health',preset:'discount'},
    {id:'describe',title:'Summarise data and inspect a box plot',words:['mean','median','variance','quartile','box plot','iqr','انحراف'],target:'lab',tool:'descriptive'},
    {id:'normal',title:'Calculate a normal probability or percentile',words:['normal','probability','z-score','percentile','احتمال'],target:'lab',tool:'normal'}
  ];
  function matchIntent(text){
    const q=String(text||'').trim().toLowerCase().slice(0,240);if(!q)return [];
    return intents.map((r,index)=>({r,index,score:r.words.reduce((s,w)=>s+(q.includes(w)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,3).map(x=>x.r);
  }
  return Object.freeze({refs,chooseMethod,labURL,costEffectiveness,parseRows,qaly,discount,intents,matchIntent});
});
