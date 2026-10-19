// Replace only SVG children. The native SVG's size, class, viewBox, paint,
// accessibility, button and events remain owned by the application.
export function installIcons(metadata) {
  const changes=new Map(),ns='http://www.w3.org/2000/svg';
  const labels={'首页':'home','Home':'home','新聊天':'whale','新建聊天':'whale','New chat':'whale','新对话':'whale','图像':'images','Images':'images','资料库':'library','Library':'library','设置':'settings','Settings':'settings','外观':'theme','发送':'send','Send':'send','停止':'stop','Stop':'stop','搜索':'search','Search':'search','搜索聊天':'search','定时任务':'history','Tasks':'history','复制':'copy','Copy':'copy','添加文件':'attachment','Attach files':'attachment','听写':'mic','Dictate':'mic','打开项目':'folder','Open project':'folder','插件':'plugins','Plugins':'plugins','代码审查':'review','Code review':'review','站点':'sites','Sites':'sites'};
  function identify(svg,source){
    const control=svg.closest('button,a,[role=button],[role=tab],[role^=menuitem]');
    const label=control?.getAttribute('aria-label')||control?.getAttribute('title')||control?.textContent.trim();if(labels[label])return labels[label];
    const shape=source.find(n=>n.nodeType===1&&['path','rect','circle','polyline','line'].includes(n.localName))||source.find(n=>n.nodeType===1)?.querySelector('path,rect,circle,polyline,line');if(!shape)return null;
    const input=(svg.getAttribute('viewBox')||'')+'|'+shape.localName+'|'+(shape.getAttribute('d')||shape.getAttribute('points')||['x','y','width','height','cx','cy','r'].map(k=>shape.getAttribute(k)||'').join(','));let hash=2166136261;for(let i=0;i<input.length;i++){hash^=input.charCodeAt(i);hash=Math.imul(hash,16777619);}const id=metadata.uiContract?.geometry?.[(hash>>>0).toString(16)];return {newChat:'whale',attach:'attachment'}[id]||id;
  }
  function scan(){
    for(const [svg,entry]of changes){if(!svg.isConnected){changes.delete(svg);continue;}if(svg.contains(entry.g)){if(identify(svg,entry.source)===entry.id)continue;svg.replaceChildren(...entry.source);changes.delete(svg);}else changes.delete(svg);}
    for(const svg of document.querySelectorAll('button svg,a svg,[role=button] svg,[role=tab] svg,[role^=menuitem] svg')){
      if(changes.has(svg)||svg.closest('[data-whale-owned],[data-whale-auth-surface],.ProseMirror,[data-message-author-role],pre'))continue;
      const source=[...svg.childNodes],id=identify(svg,source);if(!metadata.icons[id])continue;
      const outer=getComputedStyle(svg),visiblePaint=value=>value&&value!=='none'&&value!=='transparent'&&!/rgba\(.*[,]\s*0\s*\)$/.test(value);
      let paint=outer.color;
      for(const node of svg.querySelectorAll('path,circle,rect,line,polygon,polyline')){if(node.closest('defs'))continue;const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)continue;if(visiblePaint(style.stroke)&&parseFloat(style.strokeWidth)>0&&Number(style.strokeOpacity)>0){paint=style.stroke;break;}if(visiblePaint(style.fill)&&Number(style.fillOpacity)>0){paint=style.fill;break;}}
      if(paint===outer.color)paint='currentColor';
      const template=document.createElement('template');template.innerHTML=metadata.icons[id];const graphic=template.content.firstElementChild,g=document.createElementNS(ns,'g');
      const box=svg.hasAttribute('viewBox')?svg.getAttribute('viewBox').split(/[ ,]+/).map(Number):[0,0,Number(svg.getAttribute('width'))||svg.clientWidth||24,Number(svg.getAttribute('height'))||svg.clientHeight||24],scale=Math.min(box[2]/24,box[3]/24);
      g.setAttribute('transform',`translate(${box[0]+(box[2]-24*scale)/2} ${box[1]+(box[3]-24*scale)/2}) scale(${scale})`);g.setAttribute('fill','none');g.setAttribute('stroke',paint);g.setAttribute('stroke-width',graphic.getAttribute('stroke-width')||'1.7');g.setAttribute('stroke-linecap','round');g.setAttribute('stroke-linejoin','round');g.dataset.whaleGlyph=id;
      g.append(...graphic.childNodes);if(paint!=='currentColor')for(const node of g.querySelectorAll('[fill="currentColor"]'))node.setAttribute('fill',paint);const descriptors=source.filter(n=>n.nodeType===1&&['title','desc','defs','style'].includes(n.localName));svg.replaceChildren(...descriptors,g);changes.set(svg,{source,g,id});
    }
  }
  return {scan,dispose(){for(const [svg,e]of changes)if(svg.contains(e.g))svg.replaceChildren(...e.source);changes.clear();}};
}
