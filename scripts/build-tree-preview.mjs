/** Standalone visual prototype; uses canonical data and never reads account state. */
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const json=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const [config,catalog,branding]=await Promise.all([json('data/research-tree-preview.json'),json('data/generated/catalog.json'),json('data/branding.json')]);
const source=resolve(root,'previews/research-tree'),output=resolve(root,'artifacts/tree-design-preview/site');
await mkdir(output,{recursive:true});
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digest=b=>createHash('sha256').update(b).digest('hex');
const L=config.layout,tree=catalog.trees[config.category][config.country];
const owned=new Set(config.ownedExamples),market=new Set(config.marketIconExamples),icons=config.icons;
const priceDates=new Set(),imageURLs=new Set();let cardCount=0;
const role=unit=>/spaa|anti_air|aa_/.test(unit.role||'')?'aa':/destroyer|spg/.test(unit.role||'')?'td':/heavy/.test(unit.role||'')?'heavy':/medium/.test(unit.role||'')?'medium':'light';
function icon(name,alt=''){imageURLs.add(icons[name]);return `<img class="wt-currency wt-currency-${name}" src="${escape(icons[name])}" alt="${escape(alt)}" width="20" height="20">`;}
function cost(unit){
 if(unit.side==='research'||unit.kind==='squadron')return {html:unit.rp===0?'<span class="wt-label">初始</span>':`${unit.rp===undefined?'—':unit.rp}${icon('rp','研发点')}`,text:unit.rp===undefined?'研发点暂缺':`${unit.rp} RP`};
 if(unit.kind==='gold')return {html:`${unit.price===null?'—':unit.price}${icon('ge','金鹰')}`,text:unit.price===null?'金鹰价格暂缺':`${unit.price} GE`};
 if(unit.kind==='pack')return {html:'<span class="wt-label">礼包</span>',text:'官方整包价格'};
 if(unit.market||market.has(unit.id))return {html:icon('gjn','Gaijin Coin'),text:'Gaijin 市场 · 未展示实时 GJN 报价'};
 return {html:'<span class="wt-label">特殊</span>',text:'特殊载具'};
}
function card(unit,{members=null}={}){
 cardCount++;const price=cost(unit);const premium=unit.premium||['gold','pack'].includes(unit.kind);const isOwned=owned.has(unit.id);let name=members?.map(u=>u.name).join(' / ')||unit.name;name=name.replace(/[\u200B\uFEFF]/g,'');
 const title=unit.name+' · '+price.text+' · 点击切换拥有预览状态';const br=Number.isInteger(unit.br[config.mode])?(unit.br[config.mode]/3+1).toFixed(1):'—';
 const classes=['wt-unit-card',premium?'is-premium':'',unit.kind==='squadron'?'is-squadron':'',isOwned?'is-owned':''].filter(Boolean).join(' ');
 let pack='';if(unit.kind==='pack'){
   const q=unit.packPrice;let amount='价格待核对';
   if(q?.currency==='CNY'&&Number.isSafeInteger(q.amountCents)){amount='¥'+((BigInt(q.amountCents)+50n)/100n).toString();priceDates.add(q.checkedAt.slice(0,10));}
   pack=`<span class="wt-pack-price" title="${escape(q?.title||unit.name)} · 整包报价${q?.checkedAt?' · '+q.checkedAt.slice(0,10):''}"><small>整包</small>${amount}</span>`;
 }
 const thumb=unit.thumbnailUrl;imageURLs.add(thumb);
 let extra='';if(members?.length>1){imageURLs.add(members[1].thumbnailUrl);extra=`<span class="wt-group-tab" aria-hidden="true"></span><img class="wt-unit-art secondary" src="${escape(members[1].thumbnailUrl)}" alt="" width="116" height="68" loading="lazy">`;}
 if(premium)imageURLs.add(icons.talisman);
 const type=role(unit);
 return `<button type="button" class="${classes}" data-unit="${escape(unit.id)}" data-name="${escape(unit.name)}" data-cost="${escape(price.text)}" aria-pressed="${isOwned}" aria-label="${escape(title)}" title="${escape(title)}"><span class="wt-owned-watermark" aria-hidden="true"></span>${extra}<img class="wt-unit-art${members?' primary':''}" src="${escape(thumb)}" alt="" width="116" height="68" loading="lazy"><span class="wt-unit-name${name.length>17?' is-long':''}">${escape(name)}</span><span class="wt-unit-bottom"><span class="wt-unit-cost">${price.html}</span><span class="wt-unit-br">${br}</span><span class="wt-role-icon ${type}" aria-label="${escape(catalog.roles[unit.role]||'载具')}" title="${escape(catalog.roles[unit.role]||'载具')}"></span></span>${premium?`<img class="wt-talisman" src="${escape(icons.talisman)}" alt="护身符" width="26" height="26">`:''}${pack}</button>`;
}
function nodesFor(rank,side){
 const override=config.referenceLayout[rank.rank];
 if(override?.[side]){
  const byID=new Map(rank[side].map(n=>[n.id,n]));return override[side].flatMap((row,y)=>row.map((id,x)=>{if(!byID.has(id))throw Error('Unknown preview node '+id);return {...byID.get(id),row:y,column:x};}));
 }
 return rank[side].filter(n=>side!=='special'||override?.maximumSpecialRow===undefined||n.row<=override.maximumSpecialRow);
}
let trees='';
for(const view of config.views){let y=0;const positions=new Map(),pending=[];let sections='';
 for(const rankName of view.ranks){const rank=tree.ranks.find(r=>r.rank===rankName);if(!rank)throw Error('Unknown rank');const main=nodesFor(rank,'research'),special=nodesFor(rank,'special');const rows=Math.max(...[...main,...special].map(n=>n.row+1));const height=L.rankHeader+rows*L.rowStep+L.rankBottom;
  let nodes='';
  for(const [side,list] of [['research',main],['special',special]])for(const node of list){
   const x=(side==='research'?L.mainX:L.specialX)+node.column*L.columnStep,top=L.rankHeader+node.row*L.rowStep;
   const members=node.members.map(u=>({...u,side})),unit=members[0];
   positions.set(node.id,{x,top:y+top,unit:unit.id});if(side==='research'&&node.req)pending.push({from:node.req,to:node.id});
   const group=node.group&&members.length>1;const groupID=`${view.id}-${node.id}`;
   nodes+=`<div class="wt-card-wrap" style="left:${x}px;top:${top}px">${card(unit,{members:group?members:null})}${side==='research'&&!group?'<span class="wt-card-under" aria-hidden="true"></span>':''}${group?`<button type="button" class="wt-group-toggle" aria-label="展开 ${escape(unit.name)} 载具组" aria-expanded="false" aria-controls="${groupID}">≡</button><div class="wt-group-list" id="${groupID}" hidden>${members.map(u=>card(u)).join('')}</div>`:''}</div>`;
  }
  sections+=`<section class="wt-tree-rank" style="height:${height}px" aria-label="${rank.rank} 级载具"><div class="wt-rank-label" aria-hidden="true">${rank.rank}</div><span class="wt-rank-caption">${rank.rank} 级 · 常规研发</span><span class="wt-rank-caption wt-rank-caption-special">${rank.rank} 级 · 特殊载具</span>${nodes}</section>`;y+=height;
 }
 let arrows='';for(const line of pending){const from=positions.get(line.from),to=positions.get(line.to);if(!from||!to||from.x!==to.x)continue;const top=from.top+L.cardHeight+8,height=to.top-top-9;if(height<14)continue;arrows+=`<span class="wt-arrow${owned.has(from.unit)?' is-owned':''}" data-from="${from.unit}" style="left:${from.x+L.cardWidth/2-7.5}px;top:${top}px;height:${height}px" aria-hidden="true"></span>`;}
 trees+=`<div class="wt-tree-view" data-tree-view="${view.id}" data-height="${y}"${view.id==='early'?'':' hidden'}>${sections}${arrows}</div>`;
}
const symbols=await readFile(resolve(root,'src/assets/WTSymbols.ttf')),font=await readFile(resolve(root,'src/assets/RobotoCondensed-Bold.ttf'));
const symbolName=`symbols.${digest(symbols).slice(0,12)}.ttf`,fontName=`condensed.${digest(font).slice(0,12)}.ttf`;
await writeFile(resolve(output,symbolName),symbols);await writeFile(resolve(output,fontName),font);
const bg=branding.assets.find(x=>x.id==='background').source;imageURLs.add(bg);imageURLs.add(icons.owned);
let css=(await readFile(resolve(source,'preview.css'),'utf8')).replaceAll('{{SYMBOL_FONT}}',symbolName).replaceAll('{{TEXT_FONT}}',fontName).replaceAll('{{BACKGROUND}}',bg).replaceAll('{{OWNED_ICON}}',icons.owned);
const js=await readFile(resolve(source,'preview.js'),'utf8');const cssName=`preview.${digest(css).slice(0,12)}.css`,jsName=`preview.${digest(js).slice(0,12)}.js`;
await writeFile(resolve(output,cssName),css);await writeFile(resolve(output,jsName),js);
const html=(await readFile(resolve(source,'index.html'),'utf8')).replace('{{STYLE}}',cssName).replace('{{SCRIPT}}',jsName).replace('{{TREES}}',trees).replace('{{PRICE_DATE}}',[...priceDates].sort().join(' / '));
if(/{{[A-Z_]+}}/.test(html+css))throw Error('Unresolved template token');
await writeFile(resolve(output,'index.html'),html);
await writeFile(resolve(root,'artifacts/tree-design-preview/build.json'),JSON.stringify({source:'previews/research-tree',output,cardCount,views:config.views.map(v=>v.id),images:[...imageURLs],files:['index.html',cssName,jsName,symbolName,fontName],sha256:digest(html)},null,2)+'\n');
await chmod(output,0o755);
for(const file of ['index.html',cssName,jsName,symbolName,fontName])await chmod(resolve(output,file),0o644);
console.log(JSON.stringify({output,cardCount,views:config.views.map(v=>v.id),htmlBytes:Buffer.byteLength(html),cssBytes:Buffer.byteLength(css),jsBytes:Buffer.byteLength(js)}));
