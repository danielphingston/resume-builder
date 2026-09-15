import {initial,validateResume} from './model.mjs';

export const RESUME_INDEX_KEY='folio-resumes-v1';
const LEGACY_KEYS=['folio-resume-v2','folio-resume-v1'];
const DOC_PREFIX='folio-resume-doc-';
const validId=id=>typeof id==='string'&&/^[a-z0-9-]{1,80}$/i.test(id);
export const documentKey=id=>`${DOC_PREFIX}${id}`;
export const resumeTitle=resume=>resume.name.trim()||'Untitled resume';
export function blankResume(){return validateResume({...structuredClone(initial),name:'',role:'',email:'',phone:'',location:'',website:'',photo:'',sections:[]});}

function validEntry(entry){
 if(!entry||!validId(entry.id)||typeof entry.title!=='string'||entry.title.length>120)throw new Error('Invalid resume list.');
 return {id:entry.id,title:entry.title||'Untitled resume',updatedAt:Number(entry.updatedAt)||0,driveId:typeof entry.driveId==='string'?entry.driveId:'',driveModifiedTime:typeof entry.driveModifiedTime==='string'?entry.driveModifiedTime:''};
}
function writeIndex(storage,store){storage.setItem(RESUME_INDEX_KEY,JSON.stringify({activeId:store.activeId,entries:store.entries}));}
function readDocument(storage,id){const raw=storage.getItem(documentKey(id));return raw?validateResume(JSON.parse(raw)):null;}

export function loadResumes(storage,newId=()=>crypto.randomUUID()){
 const rawIndex=storage.getItem(RESUME_INDEX_KEY);
 if(rawIndex){
   try{
     const parsed=JSON.parse(rawIndex);
     if(!Array.isArray(parsed.entries)||parsed.entries.length<1||parsed.entries.length>100)throw new Error('Invalid resume list.');
     const entries=parsed.entries.map(validEntry),ids=new Set(entries.map(e=>e.id));
     if(ids.size!==entries.length)throw new Error('Duplicate resume.');
     for(const id of [parsed.activeId,...entries.map(e=>e.id)]){
       if(!ids.has(id))continue;
       try{const resume=readDocument(storage,id);if(resume)return {store:{activeId:id,entries},resume,recovered:false};}catch{}
     }
   }catch{}
 }
 let resume=structuredClone(initial),recovered=false;
 for(const key of LEGACY_KEYS){
   try{const raw=storage.getItem(key);if(raw){resume=validateResume(JSON.parse(raw));recovered=true;break;}}catch{}
 }
 const id=newId(),store={activeId:id,entries:[{id,title:resumeTitle(resume),updatedAt:Date.now(),driveId:'',driveModifiedTime:''}]};
 try{storage.setItem(documentKey(id),JSON.stringify(resume));writeIndex(storage,store);}catch{}
 return {store,resume,recovered};
}

export function saveActiveResume(storage,store,resume){
 const entry=store.entries.find(e=>e.id===store.activeId);
 if(!entry)throw new Error('Active resume is missing.');
 const updatedAt=Date.now();
 storage.setItem(documentKey(entry.id),JSON.stringify(resume));
 entry.updatedAt=updatedAt;
 writeIndex(storage,store);
}

export function addResume(storage,store,resume,title,newId=()=>crypto.randomUUID()){
 if(store.entries.length>=100)throw new Error('Your browser can hold up to 100 resumes.');
 const id=newId();
 if(!validId(id)||store.entries.some(e=>e.id===id))throw new Error('Could not create a unique resume.');
 const entry={id,title:String(title||'Untitled resume').trim().slice(0,120)||'Untitled resume',updatedAt:Date.now(),driveId:'',driveModifiedTime:''};
 storage.setItem(documentKey(id),JSON.stringify(validateResume(resume)));
 const previous=store.activeId;
 store.entries.push(entry);
 store.activeId=id;
 try{writeIndex(storage,store);}catch(error){store.entries.pop();store.activeId=previous;storage.removeItem(documentKey(id));throw error;}
 return entry;
}

export function switchResume(storage,store,id){
 const entry=store.entries.find(e=>e.id===id);
 if(!entry)throw new Error('Resume not found.');
 const resume=readDocument(storage,id);
 if(!resume)throw new Error('This resume could not be loaded.');
 const previous=store.activeId;store.activeId=id;
 try{writeIndex(storage,store);}catch(error){store.activeId=previous;throw error;}
 return resume;
}

export function renameResume(storage,store,id,title){
 const entry=store.entries.find(e=>e.id===id);
 if(!entry)throw new Error('Resume not found.');
 const trimmed=String(title).trim();
 if(!trimmed||trimmed.length>120)throw new Error('Use a title between 1 and 120 characters.');
 const previous=entry.title;entry.title=trimmed;
 try{writeIndex(storage,store);}catch(error){entry.title=previous;throw error;}
}

export function linkDriveFile(storage,store,id,driveId,modifiedTime){
 const entry=store.entries.find(e=>e.id===id);
 if(!entry)throw new Error('Resume not found.');
 const previous=[entry.driveId,entry.driveModifiedTime];entry.driveId=driveId;entry.driveModifiedTime=modifiedTime;
 try{writeIndex(storage,store);}catch(error){[entry.driveId,entry.driveModifiedTime]=previous;throw error;}
}
