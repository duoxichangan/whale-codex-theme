// The app has global dialog/form/input resets. Keep every setting in a shadow
// tree and use a real top-layer dialog so native page layout cannot move it.
export function installSettings({ api, preferences, theme, setPet, css, icons }) {
  const host=document.createElement('div');host.dataset.whaleOwned='';host.className='whale-settings-host';
  const shadow=host.attachShadow({mode:'open'}),sheet=document.createElement('style');sheet.textContent=css;
  const dialog=document.createElement('dialog');dialog.className='whale-settings';dialog.setAttribute('aria-label','主题调整');
  dialog.innerHTML=`<form method="dialog"><header><div class="sea-mark" aria-hidden="true">${icons.whale}</div><button value="close" class="close" aria-label="关闭主题调整">${icons.close}</button></header><p class="eyebrow">一小片海 / 外观</p><h2>留一点喜欢的颜色。</h2><p class="intro">把海的远近、桌边的陪伴，调成自己的节奏。</p><section class="strength"><label for="whale-strength">海景浓度</label><output for="whale-strength"></output><input id="whale-strength" aria-label="海景浓度" type="range" min="0" max="75" step="1"><div class="range-hints"><span>轻一些</span><span>浓一些</span></div></section><section class="options"><label><span>桌边伙伴<small>给忙碌的间隙，留一点陪伴</small></span><input type="checkbox" name="pet" aria-label="显示桌宠"></label><label><span>开屏声音<small>下次开启工作台时生效</small></span><input type="checkbox" name="sound" aria-label="开屏声音"></label></section><footer><button type="button" data-restore>恢复原界面</button><button value="close" class="primary">保存这一片海</button></footer></form>`;
  shadow.append(sheet,dialog);document.body.append(host);
  const range=dialog.querySelector('[type=range]'),output=dialog.querySelector('output');
  function refreshRange(){output.textContent=range.value+'%';range.style.setProperty('--range-progress',Number(range.value)/75*100+'%');}
  range.value=String(preferences.strength??42);refreshRange();
  range.oninput=()=>{preferences.strength=Number(range.value);refreshRange();theme.setStrength(preferences.strength);api.save();};
  for(const [key,fallback]of [['pet',true],['sound',false]]){
    const input=dialog.querySelector(`[name=${key}]`);input.checked=preferences[key]??fallback;
    input.onchange=()=>{preferences[key]=input.checked;api.save();if(key==='pet')setPet(input.checked);};
  }
  dialog.querySelector('[data-restore]').onclick=()=>api.restore();
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  return {open(){if(!host.isConnected)document.body.append(host);if(!dialog.open)dialog.showModal();},close(){if(dialog.open)dialog.close();},dispose(){dialog.close();host.remove();}};
}
