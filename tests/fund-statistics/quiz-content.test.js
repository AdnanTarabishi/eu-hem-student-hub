// Independent arithmetic/SciPy reference values for original mixed-format practice.
const assert=require('node:assert/strict');
const legacy=require('../../content/modules/fund-statistics/questions.json');
const extra=require('../../content/modules/fund-statistics/self-tests.json');
const C=require('../../fund-statistics-quiz-core.js');
const forms=require('../../fund-statistics-mock-bank.js');
const bank=C.normalize(legacy,extra);
assert.equal(legacy.length,90);assert.equal(extra.questions.length,50);assert.equal(bank.length,140);
assert.equal(new Set(bank.map(q=>q.id)).size,140);
assert.equal(bank.filter(q=>!q.supplementary).length,124);
const expected={
  '005':7,'006':11.5,'007':6.72,'008':37,
  '015':1.4,'016':0.06680720126885807,'017':0.8185946141203637,'018':1.3303909435699093,
  '025':1.875,'026':1.6,'027':12,'028':0.022750131948179195,
  '035':66.04,'036':44.47667827395363,'037':0.0715690808473417,'038':5.152,
  '045':-2.5,'046':-2.25,'047':0.07186063822585158,'048':3.4503277967117723
};
for(const topic of new Set(extra.questions.map(q=>q.topic))){
  const qs=extra.questions.filter(q=>q.topic===topic);assert.equal(qs.length,10);
  for(const [type,n]of Object.entries({mcq:2,'multi-select':2,numeric:4,written:2}))assert.equal(qs.filter(q=>q.type===type).length,n);
}
for(const q of extra.questions){
  assert.ok(q.question&&q.explanation&&q.hint&&q.source,q.id);
  assert.ok(['easy','medium','hard'].includes(q.difficulty));
  if(['mcq','multi-select'].includes(q.type)){
    assert.equal(q.rationales.length,q.options.length);assert.equal(new Set(q.options).size,q.options.length);
    const answers=q.type==='mcq'?[q.answer]:q.answer;
    assert.ok(answers.length&&answers.every(i=>Number.isInteger(i)&&i>=0&&i<q.options.length));
    assert.equal(C.grade(q,q.answer).correct,true);
    if(q.type==='multi-select')assert.equal(C.grade(q,q.answer.slice(1)).correct,false);
  }else if(q.type==='numeric'){
    const value=expected[q.id.split('.').at(-1)];assert.ok(Number.isFinite(value),q.id);
    assert.ok(Math.abs(q.answer-value)<1e-10,q.id+' independent reference');
    assert.ok(q.tolerance>0&&q.steps.length>=2,q.id);
    assert.equal(C.grade(q,String(value)).correct,true);
    assert.equal(C.grade(q,String(value+4*q.tolerance)).correct,false);
    for(const text of ['','0x10','Infinity','NaN'])assert.notEqual(C.grade(q,text).correct,true);
  }else{
    assert.ok(q.rubric.length>=3&&typeof q.answer==='string');assert.equal(C.grade(q,'A written draft').correct,null);
  }
}
// Independent small-sample t and null-based proportion reference values.
const numerical={
  'clinic-b':[[16.5,15.368921418600898,17.631078581399102,-3],[.45,.037267799624996496,-1.3416407864998734,.17971249487899998]],
  'clinic-c':[[41.5,39.75470359159705,43.24529640840295,1.8916430035849912],[.65,.032113081446662826,3.1139957766460906,.0018457213176962756]]
};
assert.equal(forms.length,2);
for(const form of forms){
  assert.equal(form.interpretations.length,2);form.interpretations.forEach(i=>assert.equal(i.rubric.length,3));
  assert.equal(form.applied.length,2);
  for(let i=0;i<2;i++){
    assert.equal(form.applied[i].fields.length,4);
    form.applied[i].fields.forEach((field,j)=>assert.ok(Math.abs(field[1]-numerical[form.id][i][j])<1e-9,form.id+' numeric field'));
  }
  assert.ok(form.applied[1].fields[3][1]>form.applied[1].fields[3][2],'p-value must not accept a rounded zero');
}
console.log('Quiz content passed: 50 original mixed items, 20 independent numeric oracles, 124 core/140 total questions, choice/rubric schema and both alternative mock forms.');
