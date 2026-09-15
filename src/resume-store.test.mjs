import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {initial} from './model.mjs';
import {RESUME_INDEX_KEY,documentKey,loadResumes,saveActiveResume,addResume,switchResume,blankResume,renameResume} from './resume-store.mjs';

function storage(){const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem(key,value){values.set(key,value);},removeItem:key=>values.delete(key)};}

test('the existing single resume migrates into a separate document without losing its content',()=>{
 const local=storage(),old=structuredClone(initial);old.name='Existing resume';
 local.setItem('folio-resume-v2',JSON.stringify(old));
 const loaded=loadResumes(local,()=> 'resume-one');
 assert.equal(loaded.resume.name,'Existing resume');
 assert.equal(loaded.store.activeId,'resume-one');
 assert.equal(JSON.parse(local.getItem(documentKey('resume-one'))).name,'Existing resume');
 assert.equal(JSON.parse(local.getItem(RESUME_INDEX_KEY)).entries.length,1);
});

test('new, renamed, and duplicated resumes persist independently when switching',()=>{
 const local=storage(),{store}=loadResumes(local,()=> 'resume-one');
 const next=blankResume();next.name='Second person';
 addResume(local,store,next,'Engineering',()=> 'resume-two');
 renameResume(local,store,'resume-two','Engineering v2');
 next.name='Edited second';saveActiveResume(local,store,next);
 assert.equal(switchResume(local,store,'resume-one').name,'Jordan Davis');
 assert.equal(switchResume(local,store,'resume-two').name,'Edited second');
 assert.equal(store.entries[1].title,'Engineering v2');
});

test('a failed index write does not change the active resume',()=>{
 const local=storage(),{store}=loadResumes(local,()=> 'resume-one');
 const original=local.setItem;
 local.setItem=(key,value)=>{if(key===RESUME_INDEX_KEY)throw new Error('Storage full');original(key,value);};
 assert.throws(()=>addResume(local,store,blankResume(),'New',()=> 'resume-two'),/Storage full/);
 assert.equal(store.activeId,'resume-one');
 assert.equal(store.entries.length,1);
 assert.equal(local.getItem(documentKey('resume-two')),null);
});
