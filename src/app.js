import {initial,validateResume,validateLibrary,validatePhoto,createBlock,createSection,duplicateBlock,moveBlock,moveSection} from './model.mjs';
import {contentPanel,designPanel,checkPanel,resumeHtml,libraryHtml} from './view.mjs';
import {paginate} from './paginate.mjs';

const $=s=>document.querySelector(s);
const clone=o=>structuredClone(o);
const STORAGE='folio-resume-v2',LIBRARY='folio-block-library-v1';
let state=clone(initial),library=[],tab='content',selectedSection='personal',selectedBlock=null,zoom=.75,pdfPreview=false,job='',history=[],future=[],toastTimer;
let editPath='',editTime=0,dragged=null,pendingInsert=null,pendingSave=null;
try {const saved=localStorage.getItem(STORAGE)||localStorage.getItem('folio-resume-v1');if(saved)state=validateResume(JSON.parse(saved));}
catch{setTimeout(()=>toast('Saved resume could not be loaded. Import a backup to recover it.'),100);}
try {const saved=localStorage.getItem(LIBRARY);if(saved)library=validateLibrary(JSON.parse(saved));}
catch{setTimeout(()=>toast('The saved block library could not be loaded.'),100);}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state));$('#save-status').textContent='● Saved on this device';}catch{$('#save-status').textContent='Not saved — download a backup';}}
function persistLibrary(){try{localStorage.setItem(LIBRARY,JSON.stringify(library));return true;}catch{toast('Library could not be saved. Download a backup.');return false;}}
function snapshot(){history.push(clone(state));if(history.length>80)history.shift();future=[];}
function commit(change){snapshot();editPath='';change();persist();render();}
function updateUndo(){$('#undo').disabled=!history.length;$('#redo').disabled=!future.length;}
function undo(){if(!history.length)return;future.push(clone(state));state=history.pop();editPath='';persist();render();}
function redo(){if(!future.length)return;history.push(clone(state));state=future.pop();editPath='';persist();render();}
function getPath(path){return path.split('.').reduce((o,k)=>o?.[k],state);}
function setPath(path,value){const keys=path.split('.'),last=keys.pop();keys.reduce((o,k)=>o[k],state)[last]=value;}
function blockLocation(id){for(const section of state.sections){const index=section.blocks.findIndex(b=>b.id===id);if(index>=0)return {section,index,block:section.blocks[index]};}return null;}
function normalizeSelection(){if(selectedBlock){const found=blockLocation(selectedBlock);if(found)selectedSection=found.section.id;else selectedBlock=null;}if(selectedSection&&selectedSection!=='personal'&&!state.sections.some(s=>s.id===selectedSection))selectedSection=state.sections[0]?.id||'personal';}
function renderEditor(){normalizeSelection();$('#editor-content').innerHTML=tab==='content'?contentPanel(state,selectedSection,selectedBlock):tab==='design'?designPanel(state):checkPanel(state,job);}
function renderPreview(){const d=state.design,p=$('#resume');
 const count=paginate(p,resumeHtml(state,selectedSection,selectedBlock),d,selectedSection,selectedBlock);
 $('#paper-label').textContent=d.paper==='a4'?'A4':'LETTER';$('#page-count').textContent=`${count} ${count===1?'page':'pages'}`;
 let printStyle=$('#print-size');if(!printStyle){printStyle=document.createElement('style');printStyle.id='print-size';document.head.append(printStyle);}printStyle.textContent=`@page {size:${d.paper==='a4'?'A4':'letter'};margin:0;}`;
 applyZoom();
}
function render(){normalizeSelection();renderEditor();renderPreview();updateUndo();}
function applyZoom(){const p=$('#resume');p.style.transform=`scale(${zoom})`;$('#paper-wrapper').style.width=`${(state.design.paper==='letter'?816:794)*zoom}px`;$('#paper-wrapper').style.height=`${p.offsetHeight*zoom}px`;$('#zoom-value').textContent=`${Math.round(zoom*100)}%`;}
function fit(){zoom=Math.min(.95,Math.max(.25,($('#preview-scroll').clientWidth-64)/(state.design.paper==='letter'?816:794)));applyZoom();}
function switchTab(next){tab=next;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));renderEditor();}
function syncSelection(){document.querySelectorAll('#resume [data-block]').forEach(el=>el.classList.toggle('selected',el.dataset.block===selectedBlock));document.querySelectorAll('#resume [data-section]').forEach(el=>el.classList.toggle('section-selected',el.dataset.section===selectedSection));$('#resume .resume-header').classList.toggle('section-selected',selectedSection==='personal');}
function clearSelection(){selectedSection=null;selectedBlock=null;renderEditor();syncSelection();}
function selectBlock(id){const found=blockLocation(id);if(!found)return;selectedBlock=id;selectedSection=found.section.id;switchTab('content');$('#editor-content').scrollTop=0;syncSelection();}
function selectSection(id){selectedSection=id;selectedBlock=null;switchTab('content');syncSelection();}
function focusEdit(path,atEnd=false){const el=[...document.querySelectorAll('[data-edit]')].find(e=>e.dataset.edit===path);if(!el)return;el.focus();const range=document.createRange();range.selectNodeContents(el);range.collapse(!atEnd);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);}
function openLibrary(sectionId=null,column='main'){pendingInsert={sectionId,column};$('#section-dialog h2').textContent=sectionId?'Add a block':'Add a section';$('#section-dialog .dialog-description').textContent=sectionId?'Start with a preset. Every part is yours to change.':'Create a group, then add and arrange blocks inside it.';$('#section-options').innerHTML=libraryHtml(library,!sectionId);$('#section-dialog').showModal();}
function insertBlock(block){const section=state.sections.find(s=>s.id===pendingInsert?.sectionId);if(!section)return;commit(()=>{section.blocks.push(block);selectedSection=section.id;selectedBlock=block.id;});$('#section-dialog').close();}
function moveBlockBy(id,delta){const found=blockLocation(id);if(!found)return;const {section,index}=found,target=index+delta;if(target<0||target>=section.blocks.length)return;commit(()=>{[section.blocks[index],section.blocks[target]]=[section.blocks[target],section.blocks[index]];selectedSection=section.id;selectedBlock=id;});}
function moveSectionBy(id,delta){const index=state.sections.findIndex(s=>s.id===id),target=index+delta;if(index<0||target<0||target>=state.sections.length)return;commit(()=>{[state.sections[index],state.sections[target]]=[state.sections[target],state.sections[index]];});}
function addBullet(id,index=null,text=''){const found=blockLocation(id);if(!found)return;const at=index??found.block.bullets.length;commit(()=>{found.block.bullets.splice(at,0,text);selectedBlock=id;selectedSection=found.section.id;});const si=state.sections.indexOf(found.section);focusEdit(`sections.${si}.blocks.${found.index}.bullets.${at}`);}
function removeBullet(id,index){const found=blockLocation(id);if(!found)return;commit(()=>found.block.bullets.splice(index,1));}

let clickAway=false;
document.addEventListener('pointerdown',event=>{
 clickAway=!event.target.closest('#resume [data-block],#resume [data-section],#resume .resume-header,.inspector,.section-card,[data-select-section],[data-select-block],dialog');
});

document.addEventListener('click',event=>{
 const clickedAway=clickAway;clickAway=false;
 const b=event.target.closest('button');
 if(!b){
   const block=event.target.closest('#resume [data-block]');
   if(block){if(selectedBlock!==block.dataset.block)selectBlock(block.dataset.block);return;}
   const section=event.target.closest('#resume [data-section]');
   if(section){if(selectedSection!==section.dataset.section||selectedBlock)selectSection(section.dataset.section);return;}
   if(event.target.closest('#resume .resume-header')){if(selectedSection!=='personal'||selectedBlock)selectSection('personal');return;}
   if(clickedAway)clearSelection();
   return;
 }
 const d=b.dataset;
 if(d.tab)switchTab(d.tab);
 if(d.selectSection)selectSection(d.selectSection);
 if(d.selectBlock)selectBlock(d.selectBlock);
 if(d.template)commit(()=>{state.design.template=d.template;state.design.columns=d.template==='classic'?1:2;state.design.font=d.template==='classic'?'serif':'sans';});
 if(d.color)commit(()=>state.design.accent=d.color);
 if(d.columns)commit(()=>state.design.columns=+d.columns);
 if(d.reset)commit(()=>setPath(d.reset,''));
 if(b.id==='reference-style')commit(()=>Object.assign(state.design,{accent:'#990000',subtitleColor:'#ff7700',textColor:'#35454f',font:'arial',headingStyle:'line',bulletStyle:'disc',icons:'classic'}));
 if(b.id==='add-section')openLibrary();
 if(d.addSectionColumn)openLibrary(null,d.addSectionColumn);
 if(d.addBlock)openLibrary(d.addBlock);
 if(d.insertPreset){if(pendingInsert.sectionId)insertBlock(createBlock(d.insertPreset));else{commit(()=>{const section=createSection(d.insertPreset,pendingInsert.column);state.sections.push(section);selectedSection=section.id;selectedBlock=section.blocks[0].id;});$('#section-dialog').close();}}
 if(d.insertSaved){const saved=library.find(p=>p.id===d.insertSaved);if(saved)insertBlock(duplicateBlock(saved.block));}
 if(d.deletePreset){library=library.filter(p=>p.id!==d.deletePreset);persistLibrary();$('#section-options').innerHTML=libraryHtml(library,false);}
 if(d.savePreset){const found=blockLocation(d.savePreset);if(found){pendingSave=clone(found.block);$('#preset-name').value=found.block.title||found.section.title;$('#save-dialog').showModal();$('#preset-name').select();}}
 if(d.duplicateBlock){const found=blockLocation(d.duplicateBlock);if(found)commit(()=>{const block=duplicateBlock(found.block);found.section.blocks.splice(found.index+1,0,block);selectedBlock=block.id;selectedSection=found.section.id;});}
 if(d.deleteBlock){const found=blockLocation(d.deleteBlock);if(found)commit(()=>{found.section.blocks.splice(found.index,1);selectedBlock=null;});}
 if(d.deleteSection)commit(()=>{state.sections=state.sections.filter(s=>s.id!==d.deleteSection);selectedBlock=null;});
 if(d.blockUp)moveBlockBy(d.blockUp,-1);
 if(d.blockDown)moveBlockBy(d.blockDown,1);
 if(d.sectionUp)moveSectionBy(d.sectionUp,-1);
 if(d.sectionDown)moveSectionBy(d.sectionDown,1);
 if(d.addBullet)addBullet(d.addBullet);
 if(d.removeBullet)removeBullet(d.removeBullet,+d.bulletIndex);
 if(d.addParagraph){selectBlock(d.addParagraph);const found=blockLocation(d.addParagraph);focusEdit(`sections.${state.sections.indexOf(found.section)}.blocks.${found.index}.paragraph`,true);}
 if(b.id==='undo')undo();
 if(b.id==='redo')redo();
 if(b.id==='backup'){const blob=new Blob([JSON.stringify({...state,blockLibrary:library},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${state.name.trim().replace(/[^a-z0-9]+/gi,'-')||'my'}-resume.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Resume and saved blocks backed up.');}
 if(b.id==='import')$('#import-file').click();
 if(b.id==='choose-photo'||d.uploadPhoto!==undefined)$('#photo-file').click();
 if(b.id==='remove-photo')commit(()=>state.photo='');
 if(b.id==='export'){document.activeElement?.blur();renderPreview();window.print();}
 if(b.id==='zoom-in'){zoom=Math.min(1.25,zoom+.1);applyZoom();}
 if(b.id==='zoom-out'){zoom=Math.max(.25,zoom-.1);applyZoom();}
 if(b.id==='fit')fit();
 if(b.id==='toggle-pdf-view'){
   pdfPreview=!pdfPreview;
   $('.preview-workspace').classList.toggle('pdf-preview',pdfPreview);
   $('#preview-mode').textContent=pdfPreview?'PDF PREVIEW':'EDITABLE CANVAS';
   b.textContent=pdfPreview?'Edit view':'PDF view';
   b.setAttribute('aria-pressed',String(pdfPreview));
   $('.preview-footer span:last-child').textContent=pdfPreview?'Page layout as it prints':'Click to edit · drag handles to rearrange';
   clearSelection();
 }
 if(b.id==='match-job'){job=$('#job-description').value;renderEditor();}
 if(clickedAway&&b.id!=='toggle-pdf-view')clearSelection();
});
$('#save-preset-form').addEventListener('submit',e=>{e.preventDefault();const name=$('#preset-name').value.trim();if(!name)return;if(library.length>=50){toast('Your library holds up to 50 presets. Remove one to save another.');return;}library.push({id:crypto.randomUUID(),name,block:pendingSave});const saved=persistLibrary();$('#save-dialog').close();if(saved)toast('Block saved to your library.');});
$('#save-dialog [data-close]').addEventListener('click',()=>$('#save-dialog').close());

function recordEdit(path,value){if(getPath(path)===value)return;if(editPath!==path||Date.now()-editTime>1200)snapshot();editPath=path;editTime=Date.now();setPath(path,value);persist();updateUndo();}
document.addEventListener('focusin',e=>{const el=e.target.closest('[data-edit]');if(!el)return;editPath='';const block=el.closest('[data-block]');if(block){if(selectedBlock!==block.dataset.block)selectBlock(block.dataset.block);}else{const section=el.closest('[data-section]');if(selectedSection!==(section?.dataset.section||'personal')||selectedBlock)selectSection(section?.dataset.section||'personal');}});
document.addEventListener('focusout',e=>{if(e.target.matches('[data-edit]')){editPath='';e.target.classList.toggle('is-empty',!e.target.textContent);requestAnimationFrame(()=>{if(!document.activeElement?.closest('#resume [data-edit]'))renderPreview();});}});
document.addEventListener('input',e=>{
 const el=e.target;if(el.id==='job-description'){job=el.value;return;}
 if(el.dataset.edit){const value=el.innerText.replace(/\r\n/g,'\n');recordEdit(el.dataset.edit,value);document.querySelectorAll('[data-path]').forEach(input=>{if(input.dataset.path===el.dataset.edit)input.value=value;});el.classList.toggle('is-empty',!value);const part=el.closest('.metadata-part,.contact-item');if(part)part.classList.toggle('empty-part',!value);return;}
 if(!el.dataset.path||el.tagName==='SELECT')return;
 const path=el.dataset.path;let value=el.type==='range'?+el.value:el.value;
 if(path.endsWith('.bullets'))value=value?value.split('\n'):[];
 recordEdit(path,value);renderPreview();
 if(el.type==='range')$(`#output-${path.split('.').pop()}`).textContent=value+el.dataset.suffix;
});
document.addEventListener('change',e=>{const el=e.target;if(el.tagName!=='SELECT'||!el.dataset.path)return;const path=el.dataset.path;if(path.startsWith('move-block:')){const id=path.slice(11);commit(()=>{moveBlock(state,id,el.value);selectedBlock=id;selectedSection=el.value;});}else commit(()=>setPath(path,el.value));});
// Plain-text paste keeps imported markup, links and scripts out of the document.
document.addEventListener('paste',e=>{const el=e.target.closest('[data-edit]');if(!el)return;e.preventDefault();const text=e.clipboardData.getData('text/plain');const selection=window.getSelection();if(!selection.rangeCount)return;const range=selection.getRangeAt(0);if(!el.contains(range.commonAncestorContainer))return;range.deleteContents();const node=document.createTextNode(el.getAttribute('aria-multiline')==='true'?text:text.replace(/\r?\n/g,' '));range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste'}));});
document.addEventListener('keydown',e=>{
 if((e.ctrlKey||e.metaKey)&&!e.altKey&&['z','y'].includes(e.key.toLowerCase())&&!e.target.closest('dialog')){e.preventDefault();if(e.key.toLowerCase()==='y'||e.shiftKey)redo();else undo();return;}
 const el=e.target.closest('[data-edit]');if(!el||e.isComposing)return;
 if(e.key==='Escape'){el.blur();return;}
 if(e.key==='Enter'&&el.getAttribute('aria-multiline')!=='true'){
   e.preventDefault();const match=el.dataset.edit.match(/^sections\.(\d+)\.blocks\.(\d+)\.bullets\.(\d+)$/);
   if(match){const [,si,bi,li]=match.map(Number),block=state.sections[si].blocks[bi],selection=window.getSelection();let offset=el.textContent.length,end=offset;if(selection.rangeCount){const r=selection.getRangeAt(0),prefix=r.cloneRange();prefix.selectNodeContents(el);prefix.setEnd(r.startContainer,r.startOffset);offset=prefix.toString().length;prefix.setEnd(r.endContainer,r.endOffset);end=prefix.toString().length;}
     const text=el.textContent;commit(()=>{block.bullets[li]=text.slice(0,offset);block.bullets.splice(li+1,0,text.slice(end));});focusEdit(`sections.${si}.blocks.${bi}.bullets.${li+1}`);
   }else el.blur();
 }
 if(e.key==='Backspace'&&!el.textContent&&el.dataset.edit.includes('.bullets.')){e.preventDefault();const [,si,bi,li]=el.dataset.edit.match(/^sections\.(\d+)\.blocks\.(\d+)\.bullets\.(\d+)$/).map(Number);const block=state.sections[si].blocks[bi];removeBullet(block.id,li);focusEdit(`sections.${si}.blocks.${bi}.${li>0?`bullets.${li-1}`:'paragraph'}`,true);}
});
$('#import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2e6)throw new Error('Please use a backup smaller than 2 MB.');const data=JSON.parse(await file.text()),incoming=validateResume(data),incomingLibrary=data.blockLibrary===undefined?null:validateLibrary(data.blockLibrary);commit(()=>{state=incoming;selectedBlock=null;});if(incomingLibrary){library=incomingLibrary;persistLibrary();}toast('Resume imported. Undo is available for resume changes.');}catch(err){toast(err.message||'Could not import this file.');}e.target.value='';});
$('#photo-file').addEventListener('change',async e=>{
 const file=e.target.files[0];if(!file)return;
 try{
   if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPG, PNG, or WebP photo.');
   if(file.size>10_000_000)throw new Error('Choose a photo smaller than 10 MB.');
   const bitmap=await createImageBitmap(file);
   try{
     if(bitmap.width*bitmap.height>80_000_000)throw new Error('This photo is too large to process.');
     const scale=Math.min(1,720/Math.max(bitmap.width,bitmap.height));
     const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
     const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Could not process this photo.');
     ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
     const photo=validatePhoto(canvas.toDataURL('image/jpeg',.82));
     commit(()=>{state.photo=photo;selectedSection='personal';selectedBlock=null;});
     toast('Photo added to Editorial and Modern layouts.');
   }finally{bitmap.close();}
 }catch(err){toast(err.message==='The source image could not be decoded.'?'This image could not be opened.':err.message||'Could not add this photo.');}
 e.target.value='';
});

function clearDrag(){dragged=null;document.querySelectorAll('.drop-before,.drop-after,.drop-inside,.dragging').forEach(el=>el.classList.remove('drop-before','drop-after','drop-inside','dragging'));document.body.classList.remove('is-dragging');}
function startDrag(handle){dragged=handle.dataset.dragBlock?{type:'block',id:handle.dataset.dragBlock}:{type:'section',id:handle.dataset.dragSection};handle.closest(dragged.type==='block'?'[data-block]':'[data-section]')?.classList.add('dragging');document.body.classList.add('is-dragging');}
function dropTarget(target,y){if(!dragged)return null;const sectionEl=target.closest('[data-section]'),columnEl=target.closest('[data-column]');
 if(dragged.type==='block'){
   const blockEl=target.closest('[data-block]'),section=state.sections.find(s=>s.id===sectionEl?.dataset.section);
   if(!section)return null;
   const block=section.blocks.find(b=>b.id===blockEl?.dataset.block),after=blockEl&&y>blockEl.getBoundingClientRect().top+blockEl.getBoundingClientRect().height/2;
   const beforeId=block?(after?section.blocks[section.blocks.indexOf(block)+1]?.id||null:block.id):null;
   return {element:blockEl||sectionEl,kind:blockEl?(after?'after':'before'):'inside',sectionId:section.id,beforeId};
 }
 const section=state.sections.find(s=>s.id===sectionEl?.dataset.section);if(!section&&!columnEl)return null;
 const after=sectionEl&&y>sectionEl.getBoundingClientRect().top+sectionEl.getBoundingClientRect().height/2;
 const beforeId=section?(after?state.sections[state.sections.indexOf(section)+1]?.id||null:section.id):null;
 return {element:sectionEl||columnEl,kind:sectionEl?(after?'after':'before'):'inside',column:columnEl?.dataset.column||section.column,beforeId};
}
function showDrop(target,y){document.querySelectorAll('.drop-before,.drop-after,.drop-inside').forEach(el=>el.classList.remove('drop-before','drop-after','drop-inside'));const drop=dropTarget(target,y);if(drop)drop.element.classList.add(`drop-${drop.kind}`);return drop;}
function performDrop(target,y){const drop=dropTarget(target,y);if(drop){const drag=dragged;commit(()=>{if(drag.type==='block'){moveBlock(state,drag.id,drop.sectionId,drop.beforeId);selectedBlock=drag.id;}else{moveSection(state,drag.id,drop.column,drop.beforeId);selectedSection=drag.id;selectedBlock=null;}});toast(drag.type==='block'?'Block moved.':'Section moved.');}clearDrag();}
document.addEventListener('dragstart',e=>{const handle=e.target.closest('[data-drag-block],[data-drag-section]');if(!handle)return;startDrag(handle);e.dataTransfer.setData('text/plain',dragged.id);e.dataTransfer.effectAllowed='move';});
document.addEventListener('dragover',e=>{if(dragged&&showDrop(e.target,e.clientY)){e.preventDefault();e.dataTransfer.dropEffect='move';}});
document.addEventListener('drop',e=>{if(!dragged)return;e.preventDefault();performDrop(e.target,e.clientY);});
document.addEventListener('dragend',clearDrag);
// Touch handles use the same drop rules as native desktop drag and drop.
let touchHandle=null;
document.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-drag-block],[data-drag-section]');if(e.pointerType!=='touch'||!handle)return;e.preventDefault();touchHandle=handle;handle.setPointerCapture(e.pointerId);startDrag(handle);});
document.addEventListener('pointermove',e=>{if(!touchHandle)return;const target=document.elementFromPoint(e.clientX,e.clientY);if(target)showDrop(target,e.clientY);});
document.addEventListener('pointerup',e=>{if(!touchHandle)return;const target=document.elementFromPoint(e.clientX,e.clientY);if(target)performDrop(target,e.clientY);else clearDrag();touchHandle=null;});
document.addEventListener('pointercancel',()=>{if(touchHandle){touchHandle=null;clearDrag();}});
window.addEventListener('resize',fit);new ResizeObserver(applyZoom).observe($('#resume'));
render();requestAnimationFrame(fit);
