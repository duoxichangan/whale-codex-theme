(function createWhalePetState(options) {
  'use strict';
  const {storage,now=()=>Date.now(),lock=fn=>Promise.resolve().then(fn),outfits=['daily'],actionEffects={}}=options;
  const key='whale-station:pet:v1',limit=100;
  let cached=null,persistent=!!storage,unsaved=false,serial=Promise.resolve(),sequence=0;
  const instanceId=Math.random().toString(36).slice(2);
  const canonicalMode=mode=>mode==='reading'||mode==='working'?'walking':['walking','resting','immersive'].includes(mode)?mode:null;
  const clamp=v=>Math.min(100,Math.max(0,Number.isFinite(v)?v:0));
  const playHits=payload=>Number.isFinite(Number(payload.hits))?Math.min(20,Math.max(0,Math.floor(Number(payload.hits)))):0;
  const meters=['satiety','mood','energy'],configuredEffects=new Map();
  for(const [id,entry]of Object.entries(actionEffects||{})){
    if(!entry||!['feed','play'].includes(entry.category))continue;
    const values=Object.fromEntries(meters.filter(name=>Number.isFinite(entry.effects?.[name])).map(name=>[name,Math.max(-100,Math.min(100,entry.effects[name]))]));
    if(Object.keys(values).length)configuredEffects.set(id,{category:entry.category,effects:values});
  }
  function effects(kind,payload={}){
    const configured=configuredEffects.get(payload.actionId);
    if(configured?.category===kind)return {...configured.effects};
    return kind==='feed'?{satiety:payload.food==='jelly'?12:18,mood:4}:kind==='play'?{mood:Math.min(12,playHits(payload)*2),energy:-4}:{};
  }
  const defaults=()=>{const t=now();return {schema:1,revision:0,outfit:outfits[0],satiety:75,mood:70,energy:80,lastUpdatedAt:t,satietyUpdatedAt:t,lastFedAt:null,lastPlayedAt:null,lastTouchedAt:null,reading:false,roaming:true,resting:false,recovering:false,events:[],recentCommitIds:[]};};
  function valid(s){return s&&s.schema===1&&['satiety','mood','energy','lastUpdatedAt'].every(k=>Number.isFinite(s[k]))&&Array.isArray(s.events)&&s.events.length<=limit;}
  function load(){
    if(unsaved&&cached)return cached;
    let raw;try{raw=storage?.getItem(key);if(raw){const value=JSON.parse(raw);if(valid(value)){
      cached={...defaults(),...value,outfit:outfits.includes(value.outfit)?value.outfit:outfits[0],events:value.events.filter(e=>e&&typeof e.id==='string'&&typeof e.kind==='string'&&Number.isFinite(e.at)).slice(-limit),recentCommitIds:Array.isArray(value.recentCommitIds)?value.recentCommitIds.filter(id=>typeof id==='string').slice(-limit):[]};
      cached.lastUpdatedAt=Math.max(0,Math.min(now(),cached.lastUpdatedAt));
      cached.satietyUpdatedAt=Number.isFinite(value.satietyUpdatedAt)&&value.satietyUpdatedAt>=0?Math.min(now(),value.satietyUpdatedAt):cached.lastUpdatedAt;
      for(const name of ['satiety','mood','energy'])cached[name]=clamp(cached[name]);
      cached.revision=Number.isSafeInteger(cached.revision)&&cached.revision>=0?cached.revision:0;
      for(const name of ['reading','roaming','resting','recovering'])cached[name]=cached[name]===true;
      for(const name of ['lastFedAt','lastPlayedAt','lastTouchedAt'])cached[name]=Number.isFinite(cached[name])&&cached[name]>=0&&cached[name]<=now()?cached[name]:null;
    }else throw Error('Invalid pet state');}}
    catch{if(raw)try{storage?.setItem(key+':invalid',raw.slice(0,50000));}catch{}persistent=false;}
    if(!cached)cached=defaults();return cached;
  }
  function read(){
    const saved=load(),t=now(),hours=Math.min(8,Math.max(0,t-saved.lastUpdatedAt)/3600000);
    const hungerMinutes=Math.floor(Math.max(0,t-saved.satietyUpdatedAt)/60000),satietyUpdatedAt=saved.satietyUpdatedAt+hungerMinutes*60000;
    const mode=canonicalMode(saved.mode)||(saved.resting?'resting':'walking');
    const energy=clamp(saved.energy+(mode==='resting'?hours*12:0));
    const state={...saved,mode,reading:false,roaming:mode==='walking',resting:mode==='resting',recovering:energy<10,satiety:clamp(saved.satiety-Math.min(480,hungerMinutes)*4/60),satietyUpdatedAt,mood:clamp(saved.mood-hours*1.5),energy,lastUpdatedAt:t,events:saved.events.map(e=>({...e,...(e.appliedEffects?{appliedEffects:{...e.appliedEffects}}:{})})),recentCommitIds:[...saved.recentCommitIds]};
    state.condition=state.recovering?'recovering':state.resting?'resting':state.satiety<35?'hungry':state.mood>80?'happy':'calm';return state;
  }
  function commit(kind,payload={},id=`${now()}-${instanceId}-${++sequence}`){
    const operation=()=>lock(()=>{
      const s=read(),t=now();if(typeof id!=='string'||!id||id.length>200)return {ok:false,reason:'invalid-id',state:s};
      if(s.recentCommitIds.includes(id)||s.events.some(e=>e.id===id))return {ok:false,reason:'duplicate',state:s};
      const before=Object.fromEntries(meters.map(name=>[name,s[name]])),effect=effects(kind,payload);
      if(kind==='feed'){
        if(s.satiety>=100)return {ok:false,reason:'full',state:s};
        for(const [name,delta]of Object.entries(effect))s[name]=clamp(s[name]+delta);s.lastFedAt=t;s.satietyUpdatedAt=t;s.resting=false;
      }else if(kind==='play'){
        if(!playHits(payload))return {ok:false,reason:'no-interaction',state:s};
        if(s.energy<10||s.energy<Math.max(0,-(effect.energy||0)))return {ok:false,reason:'insufficient-energy',state:s};
        for(const [name,delta]of Object.entries(effect))s[name]=clamp(s[name]+delta);s.lastPlayedAt=t;s.resting=false;
      }else if(kind==='touch'){
        if(s.lastTouchedAt!==null&&t-s.lastTouchedAt<1500)return {ok:false,reason:'cooldown',state:s};
        s.mood=clamp(s.mood+1);s.lastTouchedAt=t;
      }else if(kind==='walk'){
        s.energy=clamp(s.energy-2);s.resting=false;
      }else if(kind==='outfit'){
        if(!outfits.includes(payload.outfit))return {ok:false,reason:'unknown-outfit',state:s};s.outfit=payload.outfit;
      }else if(kind==='mode'){
        const mode=canonicalMode(payload.mode);if(!mode)return {ok:false,reason:'unknown-mode',state:s};s.mode=mode;
      }else if(kind==='action'){
        if(typeof payload.name!=='string'||!payload.name||payload.name.length>80)return {ok:false,reason:'invalid-action-name',state:s};
      }else if(kind==='reading'||kind==='roaming'||kind==='resting'){s.mode=kind==='resting'&&payload.value?'resting':'walking';}
      else return {ok:false,reason:'unknown-action',state:s};
      const appliedEffects=Object.fromEntries(meters.filter(name=>s[name]!==before[name]||Object.hasOwn(effect,name)).map(name=>[name,s[name]-before[name]]));
      s.reading=false;s.roaming=s.mode==='walking';s.resting=s.mode==='resting';s.recovering=s.energy<10;s.revision=Math.max(0,Number(s.revision)||0)+1;s.lastUpdatedAt=t;delete s.condition;
      if(kind!=='touch'&&kind!=='reading'&&kind!=='roaming'&&kind!=='walk')s.events.push({id,kind,at:t,...(kind==='feed'?{food:typeof payload.food==='string'?payload.food.slice(0,80):'biscuit'}:kind==='play'?{hits:playHits(payload),toy:typeof payload.toy==='string'?payload.toy.slice(0,80):'bubbles'}:kind==='outfit'?{outfit:s.outfit}:kind==='mode'?{mode:s.mode}:kind==='action'?{name:payload.name}:{value:s.resting}),...(typeof payload.actionId==='string'?{actionId:payload.actionId.slice(0,100)}:{}),appliedEffects:{...appliedEffects}});
      s.events=s.events.slice(-limit);s.recentCommitIds=[...s.recentCommitIds,id].slice(-limit);cached=s;
      try{storage?.setItem(key,JSON.stringify(s));persistent=!!storage;unsaved=!storage;}catch{persistent=false;unsaved=true;}
      return {ok:true,state:read(),appliedEffects};
    });
    const result=serial.then(operation,operation);serial=result.then(()=>{},()=>{});return result;
  }
  return {read,commit,effects,status:()=>({persistent,key}),outfits:[...outfits]};
})
