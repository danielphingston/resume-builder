import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {initial} from './model.mjs';
import {listDriveResumes,readDriveResume,saveDriveResume} from './drive.mjs';

const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});

test('Drive save creates a labeled JSON file with the complete resume',async()=>{
 const calls=[],fetchImpl=async(url,options)=>{calls.push({url,options});return json({id:'drive-file-1',modifiedTime:'2026-09-15T10:00:00Z'});};
 const entry={id:'local-one',title:'Engineering resume',driveId:'',driveModifiedTime:''};
 const result=await saveDriveResume('access-token',entry,initial,[],fetchImpl);
 assert.equal(result.id,'drive-file-1');
 assert.match(calls[0].url,/\/upload\/drive\/v3\/files\?uploadType=multipart/);
 assert.equal(calls[0].options.method,'POST');
 assert.equal(calls[0].options.headers.Authorization,'Bearer access-token');
 assert.match(calls[0].options.body,/Engineering resume\.folio\.json/);
 assert.match(calls[0].options.body,/"folioResume":"1"/);
 assert.match(calls[0].options.body,/"name":"Jordan Davis"/);
});

test('a changed Drive version stops an overwrite before uploading',async()=>{
 const calls=[],fetchImpl=async(url,options)=>{calls.push({url,options});return json({id:'drive-file-1',modifiedTime:'new-version'});};
 const entry={id:'local-one',title:'Engineering',driveId:'drive-file-1',driveModifiedTime:'old-version'};
 await assert.rejects(saveDriveResume('token',entry,initial,[],fetchImpl),error=>error.code==='REMOTE_CHANGED');
 assert.equal(calls.length,1);
 assert.match(calls[0].url,/fields=id,modifiedTime/);
});

test('Drive listing finds app-created resumes and opening reads their JSON content',async()=>{
 let listed=false;
 const fetchImpl=async(url)=>{
   if(url.includes('alt=media'))return json(initial);
   listed=true;return json({files:[{id:'drive-file-1',name:'Resume.folio.json',modifiedTime:'2026-09-15T10:00:00Z'}]});
 };
 const files=await listDriveResumes('token',fetchImpl);
 assert.equal(listed,true);assert.equal(files[0].id,'drive-file-1');
 const resume=await readDriveResume('token','drive-file-1',fetchImpl);
 assert.equal(resume.name,'Jordan Davis');
});
