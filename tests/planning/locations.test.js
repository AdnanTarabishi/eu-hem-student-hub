const assert=require('node:assert/strict');
const locations=require('../../timetable-locations.js');
let count=0;const test=(name,fn)=>{fn();count++;console.log('  ok  '+name);};
test('Scaravilli room numbers resolve to the documented floor',()=>{
  const a=locations.lookup('AULA 11, PIAZZA Antonino Scaravilli 1/2 - Bologna');
  const b=locations.lookup('AULA 21, PIAZZA Antonino Scaravilli 1/2 - Bologna');
  assert.equal(a.floor,'First floor');assert.equal(b.floor,'Second floor');assert.match(a.guidance,/room numbers/i);
});
test('Carinci keeps its Belmeloro entrance even though the building is Via Selmi 3',()=>{
  const a=locations.lookup('AULA MAGNA ISTOLOGIA CARINCI (Accesso da via Belmeloro, 8), Via Selmi, 3 - Bologna');
  assert.equal(a.floor,'Ground floor');assert.equal(a.entrance,'Via Belmeloro 8');assert.match(a.guidance,/Belmeloro entrance/i);
});
test('Comparative Anatomy and Irnerio rooms stay distinct',()=>{
  assert.equal(locations.lookup('AULA MAGNA ANATOMIA COMPARATA, Via Selmi, 3 - Bologna').floor,'Second floor');
  assert.equal(locations.lookup('AULA B (ANATOMIA), Via Irnerio, 48 - Bologna').address,'Via Irnerio 48, Bologna');
  assert.equal(locations.lookup('AULA B, VIA Irnerio 42 - Bologna').address,'Via Irnerio 42, Bologna');
});
test('Ranzani 14 lecture halls are not confused with Ranzani 1 labs',()=>{
  assert.equal(locations.lookup('RANZANI A, Via Camillo Ranzani, 14 - Bologna').address,'Via Camillo Ranzani 14, Bologna');
  assert.equal(locations.lookup('LAB G, Via Ranzani, 1 - Bologna').address,'Via Ranzani 1, Bologna');
});
test('second-term buildings provide researched floor guidance',()=>{
  assert.equal(locations.lookup('AULA D (Accesso da via Centotrecento, 18), Via Centotrecento, 18 - Bologna').floor,'Ground floor');
  assert.equal(locations.lookup('AULA ENRIQUES, Piazza di Porta San Donato, 5 - Bologna').floor,'Ground floor');
  assert.equal(locations.lookup('AULA EMILIO PASQUINI, Via Zamboni, 32 - Bologna').floor,'First floor');
  assert.equal(locations.lookup('AULA A - S.P.V., VIA San Petronio vecchio 32 - Bologna').floor,'Ground floor');
});
test('unknown rooms remain unknown rather than inventing directions',()=>assert.equal(locations.lookup('QA Classroom, Fictional campus, Bologna'),null));
console.log(count+' timetable-location guide checks passed');
