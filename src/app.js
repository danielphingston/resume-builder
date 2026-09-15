import {initial,validateResume,validateLibrary,validatePhoto,createBlock,createSection,duplicateBlock,moveBlock,moveSection,quickStyles} from './model.mjs';
import {contentPanel,designPanel,checkPanel,resumeHtml,libraryHtml,esc} from './view.mjs';
import {paginate} from './paginate.mjs';
import {blankResume,loadResumes,saveActiveResume,addResume,switchResume,renameResume,linkDriveFile} from './resume-store.mjs';
import {DRIVE_SCOPE,listDriveResumes,readDriveResume,saveDriveResume} from './drive.mjs';
import {GOOGLE_CLIENT_ID} from './config.mjs';

const $=s=>document.querySelector(s);
const clone=o=>structuredClone(o);
const LIBRARY='folio-block-library-v1';
let state=clone(initial),library=[],tab='content',selectedSection='personal',selectedBlock=null,pdfPreview=false,job='',history=[],future=[],toastTimer,panelAnimation;
let editPath='',editTime=0,dragged=null,pendingInsert=null,pendingSave=null;
let resumes,driveToken='',driveTokenExpires=0,driveTokenClient=null,googleScriptPromise=null,nameMode='new';
const driveClientId=GOOGLE_CLIENT_ID.trim();
try {const loaded=loadResumes(localStorage);resumes=loaded.store;state=loaded.resume;}
catch{const id=crypto.randomUUID();resumes={activeId:id,entries:[{id,title:'My resume',updatedAt:0,driveId:'',driveModifiedTime:''}]};setTimeout(()=>toast('Saved resumes could not be loaded. Import a backup to recover them.'),100);}
try {const saved=localStorage.getItem(LIBRARY);if(saved)library=validateLibrary(JSON.parse(saved));}
catch{setTimeout(()=>toast('The saved block library could not be loaded.'),100);}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
function persist(){try{saveActiveResume(localStorage,resumes,state);$('#save-status').textContent='● Saved on this device';}catch{$('#save-status').textContent='Not saved — download a backup';}}
function persistLibrary(){try{localStorage.setItem(LIBRARY,JSON.stringify(library));return true;}catch{toast('Library could not be saved. Download a backup.');return false;}}
let driveFiles=[];
function driveStatus(message){$('#drive-status').textContent=message;}
function driveErrorMessage(error,fallback){
 if(error?.code==='REMOTE_CHANGED'||error?.message==='Connect Google Drive again to continue.'||error?.message?.startsWith('This resume is too large'))return error.message;
 if(error?.status===401||error?.status===403)return 'Google Drive access needs to be renewed. Connect again and try.';
 return fallback;
}
function driveReady(){return !!driveToken&&Date.now()<driveTokenExpires;}
function updateDriveButtons(){const ready=driveReady();for(const id of ['drive-save','drive-new-copy','drive-browse'])$(`#${id}`).disabled=!ready;$('#drive-disconnect').hidden=!ready;}
function loadGoogleScript(){
 if(window.google?.accounts?.oauth2)return Promise.resolve();
 if(!googleScriptPromise)googleScriptPromise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
   script.onload=resolve;script.onerror=()=>reject(new Error('Google sign-in could not load. Check your connection and try again.'));
   document.head.append(script);
 }).catch(error=>{googleScriptPromise=null;throw error;});
 return googleScriptPromise;
}
function openDriveDialog(){
 $('#drive-connect').disabled=!driveClientId;
 updateDriveButtons();
 driveStatus(driveReady()?'Connected for this session.':driveClientId?'Loading Google sign-in…':'Google Drive is unavailable right now. You can still download a backup.');
 $('#drive-dialog').showModal();
 if(driveClientId)loadGoogleScript().then(()=>{if(!driveReady())driveStatus('Ready to connect Google Drive.');}).catch(error=>driveStatus(error.message));
}
function connectDrive(){
 if(!driveClientId){driveStatus('Google Drive is unavailable right now.');return;}
 if(!window.google?.accounts?.oauth2){driveStatus('Google sign-in is still loading. Try again in a moment.');return;}
 if(!driveTokenClient)driveTokenClient=google.accounts.oauth2.initTokenClient({
   client_id:driveClientId,scope:DRIVE_SCOPE,callback:response=>{
     if(response?.access_token&&google.accounts.oauth2.hasGrantedAllScopes(response,DRIVE_SCOPE)){
       driveToken=response.access_token;driveTokenExpires=Date.now()+Math.max(0,(Number(response.expires_in)||3600)-60)*1000;
       updateDriveButtons();driveStatus('Connected for this session. Choose Save current to Drive or Open from Drive.');
     }else driveStatus(response?.error?'Google sign-in was not completed.':'Drive access was not granted.');
   },
 });
 driveTokenClient.requestAccessToken();
}
function disconnectDrive(){
 if(driveToken&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(driveToken,()=>{});
 driveToken='';driveTokenExpires=0;updateDriveButtons();driveStatus('Disconnected. Local resumes remain in this browser.');
}
function currentDriveToken(){if(!driveReady()){updateDriveButtons();throw new Error('Connect Google Drive again to continue.');}return driveToken;}
async function saveCurrentToDrive(asNew=false){
 const button=$('#drive-save');button.disabled=true;$('#drive-new-copy').disabled=true;
 driveStatus('Saving resume to Google Drive…');
 try{
   const entry=activeResumeEntry();
   const saved=await saveDriveResume(currentDriveToken(),asNew?{...entry,driveId:'',driveModifiedTime:''}:entry,state,library);
   linkDriveFile(localStorage,resumes,entry.id,saved.id,saved.modifiedTime||'');
   renderResumesList();driveStatus(`Saved ${entry.title} to Google Drive.`);
 }catch(error){driveStatus(driveErrorMessage(error,'Could not save to Google Drive. Try again.'));}
 finally{updateDriveButtons();}
}
async function browseDrive(){
 $('#drive-browse').disabled=true;driveStatus('Finding resumes in Google Drive…');
 try{
   driveFiles=await listDriveResumes(currentDriveToken());
   $('#drive-files').innerHTML=driveFiles.length?driveFiles.map(f=>`<div class="drive-file-row"><div><strong>${esc(f.name)}</strong><small>${f.modifiedTime?new Date(f.modifiedTime).toLocaleString():''}</small></div><button type="button" class="button outline" data-open-drive="${esc(f.id)}">Open</button></div>`).join(''):'<p>No resumes saved by this app were found in Drive.</p>';
   driveStatus(`${driveFiles.length} ${driveFiles.length===1?'resume':'resumes'} found in Google Drive.`);
 }catch(error){driveStatus(driveErrorMessage(error,'Could not list Drive resumes. Try again.'));}
 finally{updateDriveButtons();}
}
async function openDriveFile(id){
 const file=driveFiles.find(f=>f.id===id);if(!file)return;
 driveStatus(`Opening ${file.name}…`);
 try{
   const data=await readDriveResume(currentDriveToken(),id),incoming=validateResume(data);
   const existing=resumes.entries.some(e=>e.driveId===id);
   const title=file.name.replace(/\.folio\.json$/i,'')+(existing?' (Drive copy)':'');
   const entry=addResume(localStorage,resumes,incoming,title);
   if(!existing)linkDriveFile(localStorage,resumes,entry.id,id,file.modifiedTime||'');
   if(!library.length&&Array.isArray(data.blockLibrary)){try{library=validateLibrary(data.blockLibrary);persistLibrary();}catch{}}
   activateResume(incoming);$('#drive-dialog').close();toast('Resume opened from Google Drive as a separate local resume.');
 }catch(error){driveStatus(driveErrorMessage(error,'Could not open this Drive resume. Try again.'));}
}
function snapshot(){history.push(clone(state));if(history.length>80)history.shift();future=[];}
function commit(change){snapshot();editPath='';change();persist();render();}
function updateUndo(){$('#undo').disabled=!history.length;$('#redo').disabled=!future.length;}
function undo(){if(!history.length)return;future.push(clone(state));state=history.pop();editPath='';persist();render();}
function redo(){if(!future.length)return;history.push(clone(state));state=future.pop();editPath='';persist();render();}
function getPath(path){return path.split('.').reduce((o,k)=>o?.[k],state);}
function setPath(path,value){const keys=path.split('.'),last=keys.pop();keys.reduce((o,k)=>o[k],state)[last]=value;}
function blockLocation(id){for(const section of state.sections){const index=section.blocks.findIndex(b=>b.id===id);if(index>=0)return {section,index,block:section.blocks[index]};}return null;}
function normalizeSelection(){if(selectedBlock){const found=blockLocation(selectedBlock);if(found)selectedSection=found.section.id;else selectedBlock=null;}if(selectedSection&&selectedSection!=='personal'&&!state.sections.some(s=>s.id===selectedSection))selectedSection=state.sections[0]?.id||'personal';}
function renderEditor(animate=false){
 normalizeSelection();
 const editor=$('#editor-content');
 panelAnimation?.cancel();
 editor.innerHTML=tab==='content'?contentPanel(state,selectedSection,selectedBlock):tab==='design'?designPanel(state):checkPanel(state,job);
 panelAnimation=animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches
   ?editor.animate([{opacity:.55,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'ease-out'})
   :null;
}
function renderPreview(){const d=state.design,p=$('#resume');
 const count=paginate(p,resumeHtml(state,selectedSection,selectedBlock),d,selectedSection,selectedBlock);
 $('#paper-label').textContent=d.paper==='a4'?'A4':'LETTER';$('#page-count').textContent=`${count} ${count===1?'page':'pages'}`;
 let printStyle=$('#print-size');if(!printStyle){printStyle=document.createElement('style');printStyle.id='print-size';document.head.append(printStyle);}printStyle.textContent=`@page {size:${d.paper==='a4'?'A4':'letter'};margin:0;}`;
 $('#paper-wrapper').style.width=`${d.paper==='letter'?816:794}px`;
 scheduleEditingPageExtension();
}
function activeResumeEntry(){return resumes.entries.find(e=>e.id===resumes.activeId);}
function renderResumesList(){
 $('#current-resume-title').textContent=activeResumeEntry()?.title||'My resume';
 $('#resume-list').innerHTML=resumes.entries.map(e=>`<div class="resume-list-row ${e.id===resumes.activeId?'active':''}"><div><strong>${esc(e.title)}</strong><small>${e.driveId?'Saved to Drive · ':''}${e.updatedAt?new Date(e.updatedAt).toLocaleDateString():''}</small></div>${e.id===resumes.activeId?'<span class="current-badge">Current</span>':`<button type="button" class="button outline" data-switch-resume="${esc(e.id)}">Open</button>`}</div>`).join('');
}
function render(){normalizeSelection();renderEditor();renderPreview();renderResumesList();updateUndo();}
function activateResume(resume){state=resume;history=[];future=[];editPath='';selectedSection='personal';selectedBlock=null;job='';tab='content';document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab==='content'));render();$('#save-status').textContent='● Saved on this device';}
function switchTab(next,animate=next!==tab){tab=next;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));renderEditor(animate);}
function syncSelection(){document.querySelectorAll('#resume [data-block]').forEach(el=>el.classList.toggle('selected',el.dataset.block===selectedBlock));document.querySelectorAll('#resume [data-section]').forEach(el=>el.classList.toggle('section-selected',el.dataset.section===selectedSection));$('#resume .resume-header').classList.toggle('section-selected',selectedSection==='personal');}
let editingPageFrame=0;
function scheduleEditingPageExtension(){
 cancelAnimationFrame(editingPageFrame);
 editingPageFrame=requestAnimationFrame(()=>{
   const baseHeight=state.design.paper==='letter'?1056:1123;
   for(const page of document.querySelectorAll('#resume .resume-page')){
     page.style.height=`${baseHeight}px`;
     if(!selectedBlock&&!selectedSection)continue;
     const top=page.getBoundingClientRect().top;
     const contentBottom=Math.max(0,...[...page.querySelectorAll('.resume-header,.section-heading-row,.resume-block')].map(el=>el.getBoundingClientRect().bottom-top));
     page.style.height=`${Math.max(baseHeight,Math.ceil(contentBottom+state.design.margin+18))}px`;
   }
 });
}
function clearSelection(){const changed=!!selectedSection||!!selectedBlock;selectedSection=null;selectedBlock=null;renderEditor(changed);renderPreview();}
function selectBlock(id){const found=blockLocation(id);if(!found)return;const changed=selectedBlock!==id||selectedSection!==found.section.id||tab!=='content';selectedBlock=id;selectedSection=found.section.id;switchTab('content',changed);$('#editor-content').scrollTop=0;syncSelection();scheduleEditingPageExtension();}
function selectSection(id){const changed=selectedSection!==id||!!selectedBlock||tab!=='content';selectedSection=id;selectedBlock=null;switchTab('content',changed);syncSelection();scheduleEditingPageExtension();}
function focusEdit(path,atEnd=false){const el=[...document.querySelectorAll('[data-edit]')].find(e=>e.dataset.edit===path);if(!el)return;el.focus();const range=document.createRange();range.selectNodeContents(el);range.collapse(!atEnd);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);}
function openLibrary(sectionId=null,column='main'){pendingInsert={sectionId,column};$('#section-dialog h2').textContent=sectionId?'Add a block':'Add a section';$('#section-dialog .dialog-description').textContent=sectionId?'Start with a preset. Every part is yours to change.':'Create a group, then add and arrange blocks inside it.';$('#section-options').innerHTML=libraryHtml(library,!sectionId);$('#section-dialog').showModal();}
function insertBlock(block){const section=state.sections.find(s=>s.id===pendingInsert?.sectionId);if(!section)return;commit(()=>{section.blocks.push(block);selectedSection=section.id;selectedBlock=block.id;});$('#section-dialog').close();}
function moveBlockBy(id,delta){const found=blockLocation(id);if(!found)return;const {section,index}=found,target=index+delta;if(target<0||target>=section.blocks.length)return;commit(()=>{[section.blocks[index],section.blocks[target]]=[section.blocks[target],section.blocks[index]];selectedSection=section.id;selectedBlock=id;});}
function moveSectionBy(id,delta){const index=state.sections.findIndex(s=>s.id===id),target=index+delta;if(index<0||target<0||target>=state.sections.length)return;commit(()=>{[state.sections[index],state.sections[target]]=[state.sections[target],state.sections[index]];});}
function addBullet(id,index=null,text=''){const found=blockLocation(id);if(!found)return;const at=index??found.block.bullets.length;commit(()=>{found.block.bullets.splice(at,0,text);selectedBlock=id;selectedSection=found.section.id;});const si=state.sections.indexOf(found.section);focusEdit(`sections.${si}.blocks.${found.index}.bullets.${at}`);}
function removeBullet(id,index){const found=blockLocation(id);if(!found)return;commit(()=>found.block.bullets.splice(index,1));}

let clickAway=false;
document.addEventListener('pointerdown',event=>{
 clickAway=!event.target.closest('#editor-content,#resume [data-block],#resume [data-section],#resume .resume-header,dialog');
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
 if(d.stylePreset){const style=quickStyles.find(s=>s.id===d.stylePreset);if(style&&Object.entries(style.design).some(([key,value])=>state.design[key]!==value))commit(()=>Object.assign(state.design,style.design));}
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
 if(b.id==='resumes'){renderResumesList();$('#resumes-dialog').showModal();}
 if(d.closeDialog)$('#'+d.closeDialog).close();
 if(d.switchResume){
   try{saveActiveResume(localStorage,resumes,state);const incoming=switchResume(localStorage,resumes,d.switchResume);activateResume(incoming);$('#resumes-dialog').close();}
   catch(error){toast(error.message||'Could not switch resumes.');}
 }
 if(b.id==='new-resume'||b.id==='rename-resume'){
   nameMode=b.id==='new-resume'?'new':'rename';
   $('#resume-name-heading').textContent=nameMode==='new'?'New resume':'Rename resume';
   $('#resume-name-input').value=nameMode==='new'?`Resume ${resumes.entries.length+1}`:activeResumeEntry()?.title||'';
   $('#resumes-dialog').close();$('#resume-name-dialog').showModal();$('#resume-name-input').select();
 }
 if(b.id==='duplicate-resume'){
   try{const incoming=clone(state),title=`${activeResumeEntry()?.title||'Resume'} copy`;addResume(localStorage,resumes,incoming,title);activateResume(incoming);$('#resumes-dialog').close();toast('Resume duplicated. Changes to this copy save separately.');}
   catch(error){toast(error.message||'Could not duplicate resume.');}
 }
 if(b.id==='drive')openDriveDialog();
 if(b.id==='drive-connect')connectDrive();
 if(b.id==='drive-disconnect')disconnectDrive();
 if(b.id==='drive-save')saveCurrentToDrive();
 if(b.id==='drive-new-copy')saveCurrentToDrive(true);
 if(b.id==='drive-browse')browseDrive();
 if(d.openDrive)openDriveFile(d.openDrive);
 if(b.id==='backup'){const blob=new Blob([JSON.stringify({...state,blockLibrary:library},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${state.name.trim().replace(/[^a-z0-9]+/gi,'-')||'my'}-resume.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Resume and saved blocks backed up.');}
 if(b.id==='import')$('#import-file').click();
 if(b.id==='choose-photo'||d.uploadPhoto!==undefined)$('#photo-file').click();
 if(b.id==='remove-photo')commit(()=>state.photo='');
 if(b.id==='export'){document.activeElement?.blur();renderPreview();window.print();}
 if(b.id==='toggle-pdf-view'){
   pdfPreview=!pdfPreview;
   $('.preview-workspace').classList.toggle('pdf-preview',pdfPreview);
   $('#preview-mode').textContent=pdfPreview?'PDF PREVIEW':'EDITABLE CANVAS';
   b.textContent=pdfPreview?'Edit view':'PDF view';
   b.setAttribute('aria-pressed',String(pdfPreview));
   $('.preview-footer span:last-child').textContent=pdfPreview?'Page layout as it prints':'Click to edit · drag handles to rearrange';
   clearSelection();
 }
 if(b.id==='match-job'){job=$('#job-description').value;renderEditor(true);}
 if(clickedAway&&b.id!=='toggle-pdf-view')clearSelection();
});
$('#resume-name-form').addEventListener('submit',event=>{
 event.preventDefault();const title=$('#resume-name-input').value.trim();
 try{
   if(nameMode==='new'){const incoming=blankResume();addResume(localStorage,resumes,incoming,title);activateResume(incoming);toast('New resume created.');}
   else{renameResume(localStorage,resumes,resumes.activeId,title);renderResumesList();toast('Resume renamed.');}
   $('#resume-name-dialog').close();
 }catch(error){toast(error.message||'Could not save resume title.');}
});
$('#save-preset-form').addEventListener('submit',e=>{e.preventDefault();const name=$('#preset-name').value.trim();if(!name)return;if(library.length>=50){toast('Your library holds up to 50 presets. Remove one to save another.');return;}library.push({id:crypto.randomUUID(),name,block:pendingSave});const saved=persistLibrary();$('#save-dialog').close();if(saved)toast('Block saved to your library.');});
$('#save-dialog [data-close]').addEventListener('click',()=>$('#save-dialog').close());

function recordEdit(path,value){if(getPath(path)===value)return;if(editPath!==path||Date.now()-editTime>1200)snapshot();editPath=path;editTime=Date.now();setPath(path,value);persist();updateUndo();}
document.addEventListener('focusin',e=>{const el=e.target.closest('[data-edit]');if(!el)return;editPath='';const block=el.closest('[data-block]');if(block){if(selectedBlock!==block.dataset.block)selectBlock(block.dataset.block);}else{const section=el.closest('[data-section]');if(selectedSection!==(section?.dataset.section||'personal')||selectedBlock)selectSection(section?.dataset.section||'personal');}});
document.addEventListener('focusout',e=>{if(e.target.matches('[data-edit]')){editPath='';e.target.classList.toggle('is-empty',!e.target.textContent);scheduleEditingPageExtension();}});
document.addEventListener('input',e=>{
 const el=e.target;if(el.id==='job-description'){job=el.value;return;}
 if(el.dataset.edit){const value=el.innerText.replace(/\r\n/g,'\n');recordEdit(el.dataset.edit,value);document.querySelectorAll('[data-path]').forEach(input=>{if(input.dataset.path===el.dataset.edit)input.value=value;});el.classList.toggle('is-empty',!value);const part=el.closest('.metadata-part,.contact-item');if(part)part.classList.toggle('empty-part',!value);scheduleEditingPageExtension();return;}
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
render();
