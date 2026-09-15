import {legacyInitial} from './sample.mjs';

export const fonts = [['sans','System sans'],['arial','Arial'],['verdana','Verdana'],['trebuchet','Trebuchet'],['serif','Georgia'],['times','Times New Roman'],['mono','Courier New']];
export const bulletStyles = [['disc','• Solid dot'],['circle','○ Circle'],['square','▪ Square'],['dash','– Dash'],['arrow','› Arrow'],['check','✓ Checkmark'],['decimal','1. Numbered'],['none','No marker']];
export const blockIcons = [['none','No icon'],['briefcase','Briefcase'],['code','Code'],['book','Education'],['star','Star'],['award','Award'],['heart','Heart'],['globe','Globe']];
export const defaultDesign = {...legacyInitial.design, subtitleColor:'#205c52', textColor:'#404743', bulletStyle:'disc', headingStyle:'plain'};
export const defaultStyle = {font:'inherit',titleColor:'',subtitleColor:'',textColor:'',background:'',bulletStyle:'inherit',border:'none'};
const hex = /^#[0-9a-f]{6}$/i;
const enumValue=(value,options,fallback)=>options.includes(value)?value:fallback;
const bound=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
const id=()=>crypto.randomUUID();
const isObject=value=>!!value && typeof value==='object' && !Array.isArray(value);
const string=(value,fallback='')=>{if(value===undefined)return fallback;if(typeof value!=='string'||value.length>20000)throw new Error('Invalid text in resume.');return value;};
const strings=value=>{if(!Array.isArray(value)||value.length>200||value.some(v=>typeof v!=='string'||v.length>20000))throw new Error('Invalid bullet list.');return [...value];};
export function normalizeStyle(style={}) {
  if(!isObject(style))throw new Error('Invalid block style.');
  return {font:enumValue(style.font,['inherit',...fonts.map(([v])=>v)],'inherit'),
    ...Object.fromEntries(['titleColor','subtitleColor','textColor','background'].map(k=>[k,hex.test(style[k])?style[k]:''])),
    bulletStyle:enumValue(style.bulletStyle,['inherit',...bulletStyles.map(([v])=>v)],'inherit'),border:enumValue(style.border,['none','line','card'],'none')};
}
export function normalizeBlock(b, fallbackId=id()) {
  if(!isObject(b))throw new Error('Invalid block.');
  return {id:string(b.id,fallbackId),title:string(b.title),subtitle:string(b.subtitle),date:string(b.date),location:string(b.location),paragraph:string(b.paragraph),bullets:strings(b.bullets??[]),icon:enumValue(b.icon,blockIcons.map(([v])=>v),'none'),style:normalizeStyle(b.style)};
}
function migrateSection(s,index) {
  if(!isObject(s))throw new Error('Invalid section.');
  if(Array.isArray(s.blocks))return s;
  const base={id:s.id,title:s.title,column:s.column};
  if(s.type==='text')return {...base,blocks:[{id:`legacy-${index}-0`,paragraph:string(s.text)}]};
  if(s.type==='list')return {...base,blocks:[{id:`legacy-${index}-0`,bullets:strings(s.items),style:{bulletStyle:'none'}}]};
  if(s.type==='entries'&&Array.isArray(s.entries))return {...base,blocks:s.entries.map((e,j)=>{if(!isObject(e))throw new Error('Invalid entry.');return {...e,id:`legacy-${index}-${j}`};})};
  throw new Error('Invalid section.');
}
export function validateResume(data) {
  if(!isObject(data)||!Array.isArray(data.sections)||data.sections.length>40)throw new Error('This file is not a supported Folio resume.');
  if(data.schemaVersion!==undefined&&![1,2].includes(data.schemaVersion))throw new Error('Unsupported resume version.');
  const result={schemaVersion:2};
  for(const key of ['name','role','email','phone','location','website']){if(typeof data[key]!=='string')throw new Error('Invalid personal details.');result[key]=string(data[key]);}
  const sectionIds=new Set(),blockIds=new Set();
  result.sections=data.sections.map((raw,index)=>{
    const s=migrateSection(raw,index);
    if(typeof s.id!=='string'||!s.id||sectionIds.has(s.id)||typeof s.title!=='string'||!['main','side'].includes(s.column)||s.blocks.length>100)throw new Error('Invalid or duplicate section.');
    sectionIds.add(s.id);
    return {id:s.id,title:string(s.title),column:s.column,blocks:s.blocks.map((b,j)=>{
      const block=normalizeBlock(b,`block-${index}-${j}`);
      if(!block.id||blockIds.has(block.id))throw new Error('Duplicate block identifier.');blockIds.add(block.id);return block;
    })};
  });
  if(data.design!==undefined&&!isObject(data.design))throw new Error('Invalid resume design.');
  const input={...defaultDesign,...data.design};
  const d={...defaultDesign};
  for(const [key,min,max] of [['size',8,13],['margin',20,64],['spacing',8,36],['lineHeight',1.2,1.9],['ratio',50,75]])d[key]=bound(input[key],min,max,defaultDesign[key]);
  for(const [key,values] of Object.entries({template:['editorial','classic','modern'],font:fonts.map(([v])=>v),background:['clean','tinted','sidebar'],icons:['minimal','none','classic'],paper:['a4','letter'],bulletStyle:bulletStyles.map(([v])=>v),headingStyle:['plain','line','band']}))d[key]=enumValue(input[key],values,defaultDesign[key]);
  for(const key of ['accent','subtitleColor','textColor'])d[key]=hex.test(input[key])?input[key]:defaultDesign[key];
  d.columns=Number(input.columns)===1?1:2;
  result.design=d;
  return result;
}
export const initial=validateResume(legacyInitial);
export const presets = [
  {key:'experience',label:'Experience',description:'Role, organization, dates & achievements',block:{title:'Senior Software Engineer',subtitle:'Company name',date:'08/2022 — Present',location:'City, Country',bullets:['Built a feature that improved the customer experience.','Reduced processing time by 25% through thoughtful improvements.'],icon:'briefcase'}},
  {key:'summary',label:'Summary',description:'A focused introduction in your own words',block:{paragraph:'Describe your background, the problems you enjoy solving, and what you bring to your next team.'}},
  {key:'project',label:'Project',description:'Context and outcomes, together',block:{title:'Project name',subtitle:'Your role · Technologies used',paragraph:'Describe the problem, your approach, and why it mattered.',bullets:['Built and shipped a solution with measurable impact.'],icon:'code'}},
  {key:'education',label:'Education',description:'Qualification, school & dates',block:{title:'Degree or qualification',subtitle:'School or university',date:'2018 — 2022',icon:'book'}},
  {key:'skills',label:'Skills',description:'A compact list of your strengths',block:{bullets:['Technical skill','Collaboration','Problem solving'],style:{bulletStyle:'none'}}},
  {key:'achievement',label:'Achievement',description:'Highlight a milestone or award',block:{title:'Achievement or award',subtitle:'Awarding organization',paragraph:'Explain what you achieved and why it stands out.',icon:'award'}},
  {key:'custom',label:'Custom block',description:'Title, subtitle, paragraph & bullets',block:{title:'Your title',subtitle:'Your subtitle',paragraph:'Tell your story in a paragraph.',bullets:['Add an achievement or detail.']}}
];
export function createBlock(key='custom') {const preset=presets.find(p=>p.key===key);if(!preset)throw new Error('Unknown block preset.');return normalizeBlock({...structuredClone(preset.block),id:id()});}
export function duplicateBlock(block){return normalizeBlock({...structuredClone(block),id:id()});}
export function createSection(key='custom',column='main'){const preset=presets.find(p=>p.key===key);if(!preset)throw new Error('Unknown section preset.');return {id:id(),title:key==='custom'?'Custom section':preset.label,column,blocks:[createBlock(key)]};}
export function moveSection(resume,sectionId,column,beforeId=null){
  if(!['main','side'].includes(column))return false;
  const source=resume.sections.findIndex(s=>s.id===sectionId);
  if(source<0||sectionId===beforeId||(beforeId&&!resume.sections.some(s=>s.id===beforeId)))return false;
  const [section]=resume.sections.splice(source,1);section.column=column;
  const target=beforeId?resume.sections.findIndex(s=>s.id===beforeId):resume.sections.length;
  resume.sections.splice(target,0,section);return true;
}
export function moveBlock(resume,blockId,sectionId,beforeId=null){
  const from=resume.sections.find(s=>s.blocks.some(b=>b.id===blockId)),to=resume.sections.find(s=>s.id===sectionId);
  if(!from||!to||blockId===beforeId||(beforeId&&!to.blocks.some(b=>b.id===beforeId)))return false;
  const [block]=from.blocks.splice(from.blocks.findIndex(b=>b.id===blockId),1);
  to.blocks.splice(beforeId?to.blocks.findIndex(b=>b.id===beforeId):to.blocks.length,0,block);return true;
}
export function validateLibrary(data){
  if(!Array.isArray(data)||data.length>50)throw new Error('Invalid block library.');
  return data.map(p=>{if(!isObject(p)||typeof p.name!=='string'||!p.name.trim())throw new Error('Invalid preset name.');return {id:string(p.id,id()),name:string(p.name),block:normalizeBlock(p.block)};});
}
export function checkResume(data, job='') {
  const blocks=data.sections.flatMap(s=>s.blocks);
  const text=[data.role,...data.sections.map(s=>s.title),...blocks.flatMap(b=>[b.title,b.subtitle,b.paragraph,...b.bullets])].join(' ');
  const bullets=blocks.flatMap(b=>b.bullets).filter(b=>b.trim());
  const words=text.trim()?text.trim().split(/\s+/).length:0;
  const checks=[
    {label:'Make it easy to reach you',pass:!!(data.name.trim()&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)&&(data.phone.trim()||data.website.trim())),detail:'Include your name, a valid email, and a phone number or website.',weight:15},
    {label:'Introduce your direction',pass:!!data.role.trim()&&blocks.some(b=>b.paragraph.trim().split(/\s+/).length>=15),detail:'Add a target role and a profile of at least 15 words.',weight:15},
    {label:'Show relevant experience',pass:blocks.some(b=>b.title.trim()&&b.subtitle.trim()&&b.date.trim()&&b.bullets.some(t=>t.trim())),detail:'Include a role, organization, dates, and achievement bullets.',weight:20},
    {label:'Make your impact measurable',pass:bullets.filter(b=>/\d/.test(b)).length>=Math.max(1,Math.ceil(bullets.length*.3)),detail:'Include meaningful numbers in at least 30% of your bullets.',weight:15},
    {label:'Start with action',pass:bullets.length>0&&bullets.filter(b=>/^(led|built|created|designed|improved|developed|managed|launched|increased|reduced|delivered|collaborated|translated|partnered|implemented|achieved|organized|analyzed|supported|automated|resolved)\b/i.test(b.trim())).length/bullets.length>=.6,detail:'Begin at least 60% of bullets with clear action verbs.',weight:15},
    {label:'Keep your story focused',pass:words>=180&&words<=800,detail:`${words} words. A useful starting range is 180–800 words.`,weight:10},
    {label:'Use a simple reading order',pass:data.design.columns===1&&data.design.icons==='none'&&blocks.every(b=>b.icon==='none'),detail:'One column with no decorative icons is the most conservative parsing choice.',weight:10}
  ];
  const stop=new Set('about above after again against also among and are because been being below between both can could did does doing during each for from further had has have having how into its itself job more most must our out over own same should some such than that the their them themselves then there these they this those through too under until very was were what when where which while who will with would you your yours years experience work team role skills required responsibilities including ability'.split(' '));
  const keywords=[...new Set(job.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g)||[])].filter(w=>!stop.has(w)).slice(0,80);
  const tokens=new Set(text.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g)||[]);
  return {score:checks.reduce((n,c)=>n+(c.pass?c.weight:0),0),checks,words,keywords:keywords.map(word=>({word,found:tokens.has(word)}))};
}
