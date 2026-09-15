export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
const API='https://www.googleapis.com/drive/v3/files';
const UPLOAD='https://www.googleapis.com/upload/drive/v3/files';

async function request(token,url,options={},fetchImpl=fetch){
 const response=await fetchImpl(url,{...options,headers:{Authorization:`Bearer ${token}`,...options.headers}});
 if(!response.ok){
   let message=`Google Drive request failed (${response.status}).`;
   try{const details=await response.json();if(details?.error?.message)message=details.error.message;}catch{}
   const error=new Error(message);error.status=response.status;throw error;
 }
 return response;
}
const fileName=title=>`${String(title).replace(/[\\/\x00-\x1f]/g,' ').trim()||'Untitled resume'}.folio.json`;

export async function listDriveResumes(token,fetchImpl=fetch){
 const files=[];let pageToken='';
 do{
   const params=new URLSearchParams({q:"trashed = false and mimeType = 'application/json' and appProperties has { key='folioResume' and value='1' }",fields:'nextPageToken,files(id,name,modifiedTime,appProperties)',pageSize:'100',spaces:'drive'});
   if(pageToken)params.set('pageToken',pageToken);
   const response=await request(token,`${API}?${params}`,{},fetchImpl);
   const body=await response.json();files.push(...(body.files||[]));pageToken=body.nextPageToken||'';
 }while(pageToken&&files.length<500);
 return files.sort((a,b)=>String(b.modifiedTime||'').localeCompare(String(a.modifiedTime||'')));
}

export async function readDriveResume(token,id,fetchImpl=fetch){
 const response=await request(token,`${API}/${encodeURIComponent(id)}?alt=media`,{},fetchImpl);
 return JSON.parse(await response.text());
}

function multipart(metadata,content){
 const boundary=`folio-${crypto.randomUUID()}`;
 const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(content)}\r\n--${boundary}--`;
 return {body,contentType:`multipart/related; boundary=${boundary}`};
}

export async function saveDriveResume(token,entry,resume,blockLibrary=[],fetchImpl=fetch){
 const metadata={name:fileName(entry.title),mimeType:'application/json',appProperties:{folioResume:'1',folioResumeId:entry.id}};
 const content={...resume,blockLibrary};
 if(new Blob([JSON.stringify(content)]).size>5_000_000)throw new Error('This resume is too large for a single Drive save. Download a backup first.');
 if(entry.driveId&&entry.driveModifiedTime){
   const response=await request(token,`${API}/${encodeURIComponent(entry.driveId)}?fields=id,modifiedTime`,{},fetchImpl);
   const current=await response.json();
   if(current.modifiedTime&&current.modifiedTime!==entry.driveModifiedTime){
     const error=new Error('The Drive copy changed since your last save. Open it from Drive or save this resume as a new copy.');
     error.code='REMOTE_CHANGED';throw error;
   }
 }
 const {body,contentType}=multipart(metadata,content);
 const id=entry.driveId;
 const url=id?`${UPLOAD}/${encodeURIComponent(id)}?uploadType=multipart&fields=id,name,modifiedTime`:`${UPLOAD}?uploadType=multipart&fields=id,name,modifiedTime`;
 const response=await request(token,url,{method:id?'PATCH':'POST',headers:{'Content-Type':contentType},body},fetchImpl);
 return response.json();
}
