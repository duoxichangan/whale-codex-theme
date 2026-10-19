import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const create=vm.runInNewContext(await fs.readFile(new URL('../runtime/pet-state.js',import.meta.url),'utf8'));
test('pet modes are mutually exclusive and feeding keeps the chosen mode',async()=>{const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},service=create({storage,outfits:['daily']});for(const mode of ['walking','resting','immersive']){await service.commit('mode',{mode});const state=service.read();assert.equal(state.mode,mode);assert.equal(state.reading,false);assert.equal(state.roaming,mode==='walking');assert.equal(state.resting,mode==='resting');}await service.commit('feed',{food:'吃汤圆'});assert.equal(service.read().mode,'immersive');assert.equal(service.read().events.at(-1).food,'吃汤圆');assert.equal((await service.commit('mode',{mode:'unsupported'})).reason,'unknown-mode');});
function harness(){let clock=100000;const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};return {data,advance:n=>clock+=n,create:(options={})=>create({...options,storage,now:()=>clock,outfits:['daily','sailor','star']})};}

test('displayed action effects match committed deltas and respect meter limits',async()=>{
 const h=harness(),s=h.create();
 for(const [kind,payload]of [['feed',{food:'吃汤圆'}],['play',{hits:1,toy:'抓星星'}]]){
  const before=s.read(),effect=s.effects(kind,payload),result=await s.commit(kind,payload);
  assert.equal(result.ok,true);
  for(const [key,delta]of Object.entries(effect))assert.equal(result.state[key],Math.min(100,Math.max(0,before[key]+delta)));
 }
 assert.equal(s.effects('action').mood,undefined);
 h.advance(61000);const before=s.read(),effect=s.effects('feed',{food:'jelly'}),result=await s.commit('feed',{food:'jelly'});
 assert.equal(result.state.satiety,Math.min(100,before.satiety+effect.satiety));
 assert.equal(result.state.satiety,100);
});
test('feeding has no cooldown, stops only at full, and retains durable exactly-once events',async()=>{const h=harness(),s=h.create();assert.equal((await s.commit('feed',{food:'biscuit'},'food-1')).ok,true);assert.equal(s.read().satiety,93);assert.equal((await s.commit('feed',{},'food-1')).reason,'duplicate');assert.equal((await s.commit('feed',{},'food-2')).ok,true);assert.equal(s.read().satiety,100);assert.equal((await s.commit('feed',{},'food-3')).reason,'full');assert.equal(h.create().read().events.filter(e=>e.kind==='feed').length,2);});
test('offline hunger is capped and history stays finite across outfit and play commits',async()=>{const h=harness(),s=h.create();await s.commit('outfit',{outfit:'sailor'});h.advance(24*3600000);assert.equal(s.read().satiety,43);assert.equal((await s.commit('play',{hits:0})).ok,false);await s.commit('play',{hits:5});assert.equal(h.create().read().outfit,'sailor');for(let i=0;i<110;i++)await s.commit('resting',{value:!!(i%2)});assert.equal(s.read().events.length,100);assert.equal((await s.commit('outfit',{outfit:'remote-url'})).reason,'unknown-outfit');});
test('corrupt storage recovers without accepting arbitrary values',async()=>{const h=harness();h.data.set('whale-station:pet:v1','{"schema":1,"satiety":"bad"}');const s=h.create();assert.equal(s.read().satiety,75);await s.commit('reading',{value:true});assert.equal(h.create().read().mode,'walking');assert.equal(h.create().read().reading,false);assert.ok(h.data.has('whale-station:pet:v1:invalid'));});

test('failed storage writes preserve live state and retry persistence on the next commit',async()=>{
 const data=new Map();let fail=false,clock=100000;
 const storage={getItem:k=>data.get(k),setItem:(k,v)=>{if(fail)throw Error('quota');data.set(k,v);}};
 const s=create({storage,now:()=>clock});await s.commit('mode',{mode:'reading'});
 fail=true;const result=await s.commit('feed',{},'failed-write-feed');
 assert.equal(result.ok,true);assert.equal(result.state.satiety,93);assert.equal(s.read().satiety,93);assert.equal(s.status().persistent,false);
 assert.equal((await s.commit('feed',{},'failed-write-feed')).reason,'duplicate');
 fail=false;await s.commit('touch',{},'persist-retry');assert.equal(s.status().persistent,true);
 const restored=create({storage,now:()=>clock});assert.equal(restored.read().satiety,93);assert.equal(restored.read().mood,75);
});

test('all action kinds retain retry IDs across reloads without adding noisy history entries',async()=>{
 const h=harness(),s=h.create();await s.commit('walk',{},'walk-once');h.advance(2000);
 assert.equal((await h.create().commit('walk',{},'walk-once')).reason,'duplicate');
 const before=s.read().mood;await s.commit('touch',{},'touch-once');h.advance(2000);
 assert.equal((await h.create().commit('touch',{},'touch-once')).reason,'duplicate');
 assert.ok(s.read().mood<=before+1);assert.equal(s.read().events.length,0);
 assert.equal((await s.commit('action',{name:'wave'},{})).reason,'invalid-id');
});

test('independent services generate distinct default IDs within the same millisecond',async()=>{
 const h=harness(),a=h.create(),b=h.create();
 assert.equal((await a.commit('action',{name:'wave'})).ok,true);
 assert.equal((await b.commit('action',{name:'jump'})).ok,true);
 assert.equal(a.read().events.length,2);
});

test('stored meter bounds and malformed cooldowns are normalized before use',async()=>{
 const h=harness(),s=h.create();await s.commit('action',{name:'wave'});
 const key=s.status().key,value=JSON.parse(h.data.get(key));
 Object.assign(value,{satiety:1000,mood:-10,lastUpdatedAt:0,satietyUpdatedAt:0,lastFedAt:1e15,lastTouchedAt:'invalid',revision:-3,resting:'false'});
 h.data.set(key,JSON.stringify(value));
 const restored=h.create(),state=restored.read();
 assert.ok(state.satiety<100);assert.equal(state.mood,0);assert.equal(state.revision,0);
 assert.equal(state.lastFedAt,null);assert.equal(state.lastTouchedAt,null);assert.equal(state.resting,false);
 assert.equal((await restored.commit('touch')).ok,true);
});

test('play rejects nonfinite and sub-hit inputs and keeps valid recorded hits integral',async()=>{
 const h=harness(),s=h.create();
 for(const hits of [Infinity,-Infinity,NaN,0.5])assert.equal((await s.commit('play',{hits})).reason,'no-interaction');
 const before=s.read(),result=await s.commit('play',{hits:1.9});
 assert.equal(result.state.mood,before.mood+2);assert.equal(result.state.energy,before.energy-4);assert.equal(result.state.events.at(-1).hits,1);
});

test('read results cannot mutate the service event log or duplicate protection',async()=>{
 const s=create({now:()=>100000});await s.commit('action',{name:'wave'},'immutable-event');
 const snapshot=s.read();snapshot.events[0].id='replaced';snapshot.events[0].appliedEffects.mood=999;snapshot.recentCommitIds.length=0;
 assert.equal(s.read().events[0].id,'immutable-event');
 assert.equal(s.read().events[0].appliedEffects.mood,undefined);
 assert.equal((await s.commit('action',{name:'wave'},'immutable-event')).reason,'duplicate');
});

test('completed walks consume energy once and only explicit rest recovers energy',async()=>{
 const h=harness(),s=h.create();await s.commit('mode',{mode:'walking'});
 const key=s.status().key,value=JSON.parse(h.data.get(key));value.energy=10;h.data.set(key,JSON.stringify(value));
 const walked=await s.commit('walk',{},'complete-walk');assert.equal(walked.state.energy,8);assert.equal(walked.state.recovering,true);assert.equal(walked.state.mode,'walking');
 assert.equal((await s.commit('walk',{},'complete-walk')).reason,'duplicate');h.advance(3600000);assert.equal(h.create().read().energy,8);
 await s.commit('mode',{mode:'resting'});h.advance(3*3600000);const recovered=h.create().read();assert.equal(recovered.energy,44);assert.equal(recovered.recovering,false);assert.equal(recovered.mode,'resting');
 await s.commit('mode',{mode:'walking'});await s.commit('walk',{},'another-complete-walk');assert.equal(s.read().energy,42);
});

test('legacy modes and old boolean interfaces migrate to the three manual modes',async()=>{
 const h=harness(),s=h.create();assert.equal(s.read().mode,'walking');
 for(const mode of ['reading','working']){
  const result=await s.commit('mode',{mode});assert.equal(result.state.mode,'walking');assert.equal(result.state.reading,false);
  const key=s.status().key,value=JSON.parse(h.data.get(key));Object.assign(value,{mode,energy:8,recovering:true});h.data.set(key,JSON.stringify(value));
  const migrated=h.create().read();assert.equal(migrated.mode,'walking');assert.equal(migrated.recovering,true);
 }
 for(const [kind,value,mode]of [['reading',true,'walking'],['reading',false,'walking'],['roaming',false,'walking'],['resting',true,'resting'],['resting',false,'walking']])assert.equal((await s.commit(kind,{value})).state.mode,mode);
 const key=s.status().key,legacy=JSON.parse(h.data.get(key));delete legacy.mode;legacy.resting=true;h.data.set(key,JSON.stringify(legacy));assert.equal(h.create().read().mode,'resting');
});

test('manual rest remains chosen after recovery while other modes do not recover energy',async()=>{
 for(const mode of ['walking','resting','immersive']){
  const h=harness(),s=h.create();await s.commit('mode',{mode});const key=s.status().key,value=JSON.parse(h.data.get(key));Object.assign(value,{energy:8,recovering:true});h.data.set(key,JSON.stringify(value));
  h.advance(3600000);const current=s.read();assert.equal(current.energy,mode==='resting'?20:8);assert.equal(current.mode,mode);assert.equal(current.recovering,mode!=='resting');
  await s.commit('action',{name:'idle'});h.advance(3*3600000);const after=s.read();assert.equal(after.mode,mode);assert.equal(after.energy,mode==='resting'?56:8);assert.equal(after.recovering,mode!=='resting');
 }
});

test('legacy low energy requires rest only below ten, without a sixty-point recovery lock',async()=>{
 const h=harness(),s=h.create();await s.commit('mode',{mode:'walking'});const key=s.status().key,value=JSON.parse(h.data.get(key));
 for(const energy of [0,9,9.99,10,24,25,59]){Object.assign(value,{energy,recovering:true});h.data.set(key,JSON.stringify(value));assert.equal(h.create().read().recovering,energy<10);}
 value.energy=8;delete value.recovering;h.data.set(key,JSON.stringify(value));h.advance(4*3600000);assert.equal(h.create().read().energy,8);assert.equal(h.create().read().recovering,true);
});

test('feeding accepts every actual value below 100 including fractional fullness and reports actual clamped gains',async()=>{
 for(const satiety of [95,99,99.999999,100]){
  const h=harness(),s=h.create();await s.commit('mode',{mode:'walking'});
  const key=s.status().key,value=JSON.parse(h.data.get(key));Object.assign(value,{satiety,mood:99});h.data.set(key,JSON.stringify(value));
  const result=await s.commit('feed',{},'near-full');
  if(satiety===100){assert.equal(result.reason,'full');continue;}
  assert.equal(result.ok,true);assert.equal(result.state.satiety,100);assert.equal(result.appliedEffects.satiety,100-satiety);assert.equal(result.appliedEffects.mood,1);
  assert.equal(result.state.events.at(-1).appliedEffects.satiety,100-satiety);
 }
 const h=harness(),s=h.create();await s.commit('feed');await s.commit('feed');assert.equal(s.read().satiety,100);
 h.advance(1);assert.equal((await s.commit('feed')).reason,'full');
 h.advance(29999);assert.equal((await s.commit('feed')).reason,'full');
 h.advance(30000);assert.equal((await s.commit('feed')).ok,true);
});

test('trusted per-action effects differ by action and ignore caller-supplied effects or mismatched categories',async()=>{
 const actionEffects={snack:{category:'feed',effects:{satiety:7,mood:1}},meal:{category:'feed',effects:{satiety:38,mood:15}},dance:{category:'play',effects:{mood:15,energy:-12}},gentle:{category:'play',effects:{mood:1,energy:-1}}};
 const h=harness(),s=h.create({actionEffects});
 assert.deepEqual({...s.effects('feed',{actionId:'snack'})},{satiety:7,mood:1});
 assert.deepEqual({...s.effects('feed',{actionId:'meal'})},{satiety:38,mood:15});
 assert.deepEqual({...s.effects('play',{actionId:'dance',hits:1})},{mood:15,energy:-12});
 assert.deepEqual({...s.effects('play',{actionId:'gentle',hits:1})},{mood:1,energy:-1});
 assert.deepEqual({...s.effects('feed',{actionId:'dance',effects:{satiety:99}})},{satiety:18,mood:4});
 assert.deepEqual({...s.effects('play',{actionId:'unknown',hits:1,effects:{mood:99,energy:0}})},{mood:2,energy:-4});
 const exposed=s.effects('feed',{actionId:'snack'});exposed.satiety=99;actionEffects.snack.effects.satiety=99;
 const fed=await s.commit('feed',{actionId:'snack',effects:{satiety:99}});
 assert.equal(fed.state.satiety,82);assert.equal(fed.appliedEffects.satiety,7);assert.equal(fed.state.events.at(-1).actionId,'snack');
 const played=await s.commit('play',{actionId:'dance',hits:1});assert.equal(played.appliedEffects.mood,15);assert.equal(played.appliedEffects.energy,-12);
});

test('play accepts zero mood and any affordable action from ten energy, ignoring legacy recovery locks',async()=>{
 const h=harness(),s=h.create({actionEffects:{intense:{category:'play',effects:{mood:15,energy:-12}},gentle:{category:'play',effects:{mood:1,energy:-1}}}});
 await s.commit('mode',{mode:'walking'});const key=s.status().key,value=JSON.parse(h.data.get(key));
 const set=(energy,mood=0)=>{Object.assign(value,{energy,mood,recovering:true});h.data.set(key,JSON.stringify(value));};
 set(9);const before=s.read();assert.equal((await s.commit('play',{actionId:'gentle',hits:1},'retry-later')).reason,'insufficient-energy');assert.equal(s.read().revision,before.revision);
 set(10);const allowed=await s.commit('play',{actionId:'gentle',hits:1},'retry-later');assert.equal(allowed.ok,true);assert.equal(allowed.state.energy,9);assert.equal(allowed.state.mood,1);assert.equal(allowed.state.recovering,true);
 assert.equal((await s.commit('play',{actionId:'gentle',hits:1})).reason,'insufficient-energy');
 set(11);assert.equal((await s.commit('play',{actionId:'intense',hits:1})).reason,'insufficient-energy');
 set(12);const exact=await s.commit('play',{actionId:'intense',hits:1});assert.equal(exact.ok,true);assert.equal(exact.state.energy,0);assert.equal(exact.state.mood,15);
 set(8);await s.commit('mode',{mode:'resting'});h.advance(10*60000);assert.equal(s.read().energy,10);assert.equal(s.read().recovering,false);assert.equal((await s.commit('play',{actionId:'gentle',hits:1})).ok,true);
});

test('frequent unrelated commits preserve the unfinished hunger minute across reloads',async()=>{
 const h=harness(),s=h.create();await s.commit('feed');await s.commit('feed');
 const start=s.read().satietyUpdatedAt;
 for(let i=0;i<5;i++){h.advance(10000);await h.create().commit('touch');assert.equal(s.read().satiety,100);assert.equal(s.read().satietyUpdatedAt,start);}
 h.advance(10000);await h.create().commit('touch');
 assert.equal(s.read().satiety,100-4/60);assert.equal(s.read().satietyUpdatedAt,start+60000);
 assert.equal((await s.commit('feed')).ok,true);assert.equal(s.read().satietyUpdatedAt,start+60000);
});

test('legacy hunger timestamps migrate from lastUpdatedAt and offline loss remains capped at eight hours',async()=>{
 const h=harness(),s=h.create();await s.commit('mode',{mode:'walking'});
 const key=s.status().key,value=JSON.parse(h.data.get(key));delete value.satietyUpdatedAt;h.data.set(key,JSON.stringify(value));
 h.advance(30000);await s.commit('touch');assert.equal(s.read().satiety,75);
 h.advance(30000);await s.commit('touch');assert.equal(s.read().satiety,75-4/60);
 h.advance(24*3600000);const offline=s.read();assert.equal(offline.satiety,75-4/60-32);
 await s.commit('touch');assert.equal(s.read().satiety,offline.satiety);
});

