import {test,expect} from '@playwright/test';
import {legacyInitial} from './legacy-fixture.mjs';
import {initial} from '../src/model.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
const canvas=page=>page.locator('#resume');
const block=page=>canvas(page).locator('[data-block]').nth(1);
const state=page=>page.evaluate(()=>{const list=JSON.parse(localStorage.getItem('folio-resumes-v1'));return JSON.parse(localStorage.getItem(`folio-resume-doc-${list.activeId}`));});
const openDesign=page=>page.locator('.panel-tabs [data-tab="design"]').click();
const openContent=page=>page.locator('.panel-tabs [data-tab="content"]').click();
async function selectBlock(page){await block(page).getByRole('textbox',{name:'Block title',exact:true}).click();}
async function setColor(page,label,value){await page.getByLabel(label,{exact:true}).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},value);}
async function uploadPortrait(page){
 const png=await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=180;c.height=240;const x=c.getContext('2d');
   x.fillStyle='#d3dfd0';x.fillRect(0,0,180,240);x.fillStyle='#273f47';x.fillRect(0,170,180,70);
   x.fillStyle='#ae724d';x.beginPath();x.ellipse(90,98,46,58,0,0,Math.PI*2);x.fill();
   x.fillStyle='#26313b';x.beginPath();x.ellipse(90,57,50,23,0,Math.PI,2*Math.PI);x.fill();
   return c.toDataURL('image/png').split(',')[1];
 });
 await page.locator('#photo-file').setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await expect(canvas(page).locator('.resume-photo')).toHaveCount(1);
}

test.beforeEach(async({page})=>{await page.goto('/');await expect(canvas(page).getByRole('textbox',{name:'Full name',exact:true})).toHaveText('Jordan Davis');});

test('direct editing keeps the caret, syncs sidebar, survives reload, and supports undo/redo',async({page})=>{
 const name=canvas(page).getByRole('textbox',{name:'Full name',exact:true});await name.fill('Alex Rivera');await name.press('End');await page.keyboard.type(' Smith');await expect(name).toHaveText('Alex Rivera Smith');await expect(page.locator('input[data-path="name"]')).toHaveValue('Alex Rivera Smith');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(name).toHaveText('Jordan Davis');await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(name).toHaveText('Alex Rivera Smith');
 await page.reload();await expect(name).toHaveText('Alex Rivera Smith');
 const title=block(page).getByRole('textbox',{name:'Block title',exact:true});await title.fill('Senior Software Engineer');await title.press('Enter');await expect(title).toHaveText('Senior Software Engineer');expect((await state(page)).sections[1].blocks[0].title).toBe('Senior Software Engineer');
});

test('clicking blank preview space clears the selected section and block',async({page})=>{
 await selectBlock(page);
 await expect(block(page)).toHaveClass(/selected/);
 await page.locator('#preview-scroll').click({position:{x:8,y:8}});
 await expect(canvas(page).locator('.resume-block.selected')).toHaveCount(0);
 await expect(canvas(page).locator('.section-selected')).toHaveCount(0);
 await expect(page.locator('.inspector')).toHaveCount(0);
 await selectBlock(page);
 await page.getByRole('button',{name:'Zoom in'}).click();
 await expect(canvas(page).locator('.resume-block.selected')).toHaveCount(0);
});

test('PDF view shows clean sheets and can return to editing',async({page})=>{
 await selectBlock(page);
 const count=await canvas(page).locator('.resume-page').count();
 await page.getByRole('button',{name:'PDF view'}).click();
 await expect(page.locator('#preview-mode')).toHaveText('PDF PREVIEW');
 await expect(page.getByRole('button',{name:'Edit view'})).toHaveAttribute('aria-pressed','true');
 await expect(block(page).locator('.block-toolbar')).toBeHidden();
 await expect(canvas(page).locator('.column-add').first()).toBeHidden();
 await expect(canvas(page).locator('.resume-block.selected')).toHaveCount(0);
 expect(await canvas(page).locator('.resume-page').count()).toBe(count);
 await page.getByRole('button',{name:'Edit view'}).click();
 await expect(page.locator('#preview-mode')).toHaveText('EDITABLE CANVAS');
 await selectBlock(page);
 await expect(block(page).locator('.block-toolbar')).toBeVisible();
});

test('multiple resumes save independently and switch across reloads',async({page})=>{
 await page.getByRole('button',{name:'Manage resumes'}).click();
 await page.getByRole('button',{name:'＋ New resume'}).click();
 await page.getByLabel('Resume title').fill('Engineering version');
 await page.locator('#resume-name-form').getByRole('button',{name:'Save'}).click();
 await expect(page.locator('#current-resume-title')).toHaveText('Engineering version');
 expect((await state(page)).sections).toHaveLength(0);
 await page.locator('input[data-path="name"]').fill('Alex Engineer');
 await page.reload();
 await expect(page.locator('#current-resume-title')).toHaveText('Engineering version');
 expect((await state(page)).name).toBe('Alex Engineer');
 await page.getByRole('button',{name:'Manage resumes'}).click();
 await page.locator('.resume-list-row').filter({hasText:'Jordan Davis'}).getByRole('button',{name:'Open'}).click();
 await expect(canvas(page).getByRole('textbox',{name:'Full name',exact:true})).toHaveText('Jordan Davis');
 await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Manage resumes'}).click();
 await page.locator('.resume-list-row').filter({hasText:'Engineering version'}).getByRole('button',{name:'Open'}).click();
 expect((await state(page)).name).toBe('Alex Engineer');
 await page.getByRole('button',{name:'Manage resumes'}).click();
 await page.getByRole('button',{name:'Duplicate current'}).click();
 await expect(page.locator('#current-resume-title')).toHaveText('Engineering version copy');
 await page.locator('input[data-path="name"]').fill('Copy Engineer');
 await page.getByRole('button',{name:'Manage resumes'}).click();
 await page.locator('.resume-list-row').filter({hasText:'Engineering version'}).filter({hasNotText:'copy'}).getByRole('button',{name:'Open'}).click();
 expect((await state(page)).name).toBe('Alex Engineer');
});

test('unconfigured Google Drive asks no visitor for OAuth credentials',async({page})=>{
 await page.getByRole('button',{name:'Google Drive',exact:true}).click();
 await expect(page.getByRole('button',{name:'Connect Google Drive'})).toBeDisabled();
 await expect(page.locator('#drive-status')).toContainText('not been configured');
 await expect(page.locator('#drive-dialog input')).toHaveCount(0);
});

test('Google sign-in saves and opens a Drive resume as a separate local copy',async({page})=>{
 let uploaded='';
 await page.route('**/src/config.mjs',route=>route.fulfill({contentType:'text/javascript',body:"export const GOOGLE_CLIENT_ID='123-test.apps.googleusercontent.com';"}));
 await page.route('https://accounts.google.com/gsi/client',route=>route.fulfill({contentType:'text/javascript',body:`window.google={accounts:{oauth2:{initTokenClient(config){return {requestAccessToken(){config.callback({access_token:'mock-token',expires_in:3600,scope:config.scope});}}},hasGrantedAllScopes(response,scope){return response.scope===scope},revoke(token,done){done()}}}};`}));
 await page.route('https://www.googleapis.com/**',route=>{
   const request=route.request(),url=request.url();
   if(url.includes('/upload/drive/v3/files')){uploaded=request.postData()||'';return route.fulfill({contentType:'application/json',body:JSON.stringify({id:'drive-one',modifiedTime:'2026-09-15T10:00:00Z'})});}
   if(url.includes('alt=media'))return route.fulfill({contentType:'application/json',body:JSON.stringify({...initial,name:'From Google Drive'})});
   if(url.includes('/drive/v3/files?'))return route.fulfill({contentType:'application/json',body:JSON.stringify({files:[{id:'drive-one',name:'Jordan Davis.folio.json',modifiedTime:'2026-09-15T10:00:00Z'}]})});
   return route.fulfill({status:404,contentType:'application/json',body:'{}'});
 });
 await page.reload();
 await page.getByRole('button',{name:'Google Drive',exact:true}).click();
 await expect(page.locator('#drive-status')).toContainText('Ready to connect');
 await page.getByRole('button',{name:'Connect Google Drive'}).click();
 await expect(page.locator('#drive-status')).toContainText('Connected');
 await page.getByRole('button',{name:'Save current to Drive'}).click();
 await expect(page.locator('#drive-status')).toContainText('Saved Jordan Davis');
 expect(uploaded).toContain('"name":"Jordan Davis"');
 expect((await page.evaluate(()=>JSON.parse(localStorage.getItem('folio-resumes-v1')))).entries[0].driveId).toBe('drive-one');
 await page.getByRole('button',{name:'Open from Drive'}).click();
 await page.locator('[data-open-drive="drive-one"]').click();
 await expect(page.locator('#current-resume-title')).toHaveText('Jordan Davis (Drive copy)');
 expect((await state(page)).name).toBe('From Google Drive');
 expect((await page.evaluate(()=>JSON.parse(localStorage.getItem('folio-resumes-v1')))).entries).toHaveLength(2);
});

test('bullet Enter splits at the caret and Backspace removes an empty bullet',async({page})=>{
 await selectBlock(page);let first=block(page).getByRole('textbox',{name:'Bullet 1',exact:true});await first.fill('Built great products');await first.press('Home');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
 await expect(block(page).getByRole('textbox',{name:'Bullet 1',exact:true})).toHaveText('Built');await expect(block(page).getByRole('textbox',{name:'Bullet 2',exact:true})).toHaveText(' great products');
 const second=block(page).getByRole('textbox',{name:'Bullet 2',exact:true});await second.fill('');await second.press('Backspace');await expect(block(page).locator('.block-bullets li')).toHaveCount(3);
 await block(page).getByRole('button',{name:'＋ Bullet',exact:true}).click();await page.keyboard.type('A new achievement');await expect(block(page).getByRole('textbox',{name:'Bullet 4',exact:true})).toHaveText('A new achievement');
 await page.reload();await expect(block(page).getByRole('textbox',{name:'Bullet 4',exact:true})).toHaveText('A new achievement');
});

test('plain-text paste cannot inject HTML and editing does not lose paragraphs',async({page})=>{
 await selectBlock(page);await block(page).getByRole('button',{name:'＋ Paragraph',exact:true}).click();const paragraph=block(page).getByRole('textbox',{name:'Write a paragraph…',exact:true});
 await paragraph.evaluate(el=>{const clipboardData=new DataTransfer();clipboardData.setData('text/plain','<img src=x onerror=alert(1)>\nSecond paragraph');clipboardData.setData('text/html','<img src=x onerror=alert(1)>');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData,bubbles:true,cancelable:true}));});
 await expect(paragraph).toHaveText('<img src=x onerror=alert(1)>\nSecond paragraph');await expect(block(page).locator('img')).toHaveCount(0);await page.reload();await expect(paragraph).toHaveText('<img src=x onerror=alert(1)>\nSecond paragraph');
});

test('preset and custom blocks combine title, subtitle, paragraphs, bullets and icons',async({page})=>{
 await canvas(page).locator('[data-section="summary"]').getByRole('button',{name:'＋ Add block',exact:true}).click();await page.locator('[data-insert-preset="custom"]').click();
 let custom=canvas(page).locator('[data-section="summary"] [data-block]').last();await expect(custom.getByRole('textbox',{name:'Block title',exact:true})).toHaveText('Your title');await expect(custom.locator('.block-paragraph')).toHaveText('Tell your story in a paragraph.');await expect(custom.locator('.block-bullets li')).toHaveCount(1);
 await custom.getByRole('textbox',{name:'Block title',exact:true}).fill('Engineering impact');await page.getByLabel('Block icon',{exact:true}).selectOption('code');await expect(custom.locator('.block-icon')).toHaveText('⌘');
 await page.getByLabel('Bullet style',{exact:true}).selectOption('square');await page.getByLabel('Block font',{exact:true}).selectOption('times');await page.getByLabel('Block frame',{exact:true}).selectOption('card');
 await setColor(page,'Title color','#990000');await setColor(page,'Subtitle color','#ff7700');
 await expect(custom).toHaveClass(/bullets-square/);await expect(custom).toHaveClass(/font-times/);await expect(custom).toHaveClass(/frame-card/);await expect(custom.locator('.block-title')).toHaveCSS('color','rgb(153, 0, 0)');await expect(custom.locator('.entry-subtitle')).toHaveCSS('color','rgb(255, 119, 0)');
 await custom.getByRole('button',{name:'✦ Save block',exact:true}).click();await page.getByLabel('Block name',{exact:true}).fill('My engineering block');await page.getByRole('button',{name:'Save to block library'}).click();
 await canvas(page).locator('[data-section="summary"]').getByRole('button',{name:'＋ Add block',exact:true}).click();await page.locator('[data-insert-saved]').click();await expect(canvas(page).locator('[data-section="summary"] [data-block]')).toHaveCount(3);
 await page.reload();expect((await state(page)).sections[0].blocks[2].style.subtitleColor).toBe('#ff7700');
 await canvas(page).locator('[data-section="summary"]').getByRole('button',{name:'＋ Add block',exact:true}).click();await expect(page.locator('[data-insert-saved]')).toHaveText('✦My engineering block');
});

test('blocks drag between sections and reorder within a section',async({page})=>{
 const source=block(page),id=await source.getAttribute('data-block');await source.hover();
 const target=canvas(page).locator('[data-section="summary"] .canvas-add-block');await source.locator('[data-drag-block]').dragTo(target);
 await expect(canvas(page).locator(`[data-section="summary"] [data-block="${id}"]`)).toHaveCount(1);expect((await state(page)).sections[1].blocks).toHaveLength(2);
 const moved=canvas(page).locator(`[data-block="${id}"]`);await moved.hover();const first=canvas(page).locator('[data-section="summary"] [data-block]').first();
 await moved.locator('[data-drag-block]').dragTo(first,{targetPosition:{x:20,y:3}});
 expect(await canvas(page).locator('[data-section="summary"] [data-block]').first().getAttribute('data-block')).toBe(id);
 await page.reload();expect((await state(page)).sections[0].blocks[0].id).toBe(id);
});

test('sections drag across columns and keyboard controls reorder blocks',async({page})=>{
 const section=canvas(page).locator('[data-section="summary"]');await section.hover();await section.locator('[data-drag-section]').dragTo(canvas(page).locator('[data-column="side"] [data-section]').first(),{targetPosition:{x:30,y:5}});
 await expect(canvas(page).locator('[data-column="side"] [data-section="summary"]')).toHaveCount(1);
 const experience=canvas(page).locator('[data-section="experience"]'),firstId=await experience.locator('[data-block]').first().getAttribute('data-block');await experience.locator('[data-block]').first().getByRole('textbox',{name:'Block title',exact:true}).click();
 await page.locator('.inspector').getByRole('button',{name:'Move block down',exact:true}).click();expect(await experience.locator('[data-block]').nth(1).getAttribute('data-block')).toBe(firstId);
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await experience.locator('[data-block]').first().getAttribute('data-block')).toBe(firstId);
});

test('empty sections accept blocks through the accessible move control',async({page})=>{
 await page.locator('#add-section').click();await page.locator('[data-insert-preset="custom"]').click();const id=(await state(page)).sections.at(-1).id;
 await page.locator('.inspector').getByRole('button',{name:'Delete',exact:true}).click();await expect(canvas(page).locator(`[data-section="${id}"] [data-block]`)).toHaveCount(0);
 await selectBlock(page);await page.getByLabel('Move to section',{exact:true}).selectOption(id);await expect(canvas(page).locator(`[data-section="${id}"] [data-block]`)).toHaveCount(1);
});

test('global styles inherit, individual overrides win, and reset restores inheritance',async({page})=>{
 await openDesign(page);await page.getByRole('button',{name:/Engineering style/}).click();await page.getByLabel('Typography',{exact:true}).selectOption('verdana');await page.getByLabel('Bullet style',{exact:true}).selectOption('decimal');
 await expect(canvas(page).locator('.resume-page').first()).toHaveClass(/headings-line/);await expect(canvas(page).locator('.resume-page').first()).toHaveClass(/font-verdana/);await expect(block(page).locator('.block-bullets')).toHaveCSS('list-style-type','decimal');await expect(block(page).locator('.entry-subtitle')).toHaveCSS('color','rgb(255, 119, 0)');
 await selectBlock(page);await page.getByLabel('Bullet style',{exact:true}).selectOption('check');await expect(block(page).locator('.block-bullets li').first()).toHaveCSS('--bullet-custom','\'✓  \'');
 await setColor(page,'Title color','#263d66');await expect(block(page).locator('.block-title')).toHaveCSS('color','rgb(38, 61, 102)');await page.locator('[data-reset$=".titleColor"]').click();await expect(block(page).locator('.block-title')).toHaveCSS('color','rgb(153, 0, 0)');
});

test('legacy storage is migrated in place without losing resume content',async({page})=>{
 await page.evaluate(data=>{localStorage.removeItem('folio-resumes-v1');localStorage.removeItem('folio-resume-v2');localStorage.setItem('folio-resume-v1',JSON.stringify(data));},legacyInitial);await page.reload();await expect(block(page).getByRole('textbox',{name:'Block title',exact:true})).toHaveText('Senior Product Designer');
 await canvas(page).getByRole('textbox',{name:'Full name',exact:true}).fill('Migrated name');const saved=await state(page);expect(saved.schemaVersion).toBe(2);expect(saved.sections[1].blocks[0].bullets).toEqual(legacyInitial.sections[1].entries[0].bullets);expect(saved.sections[3].blocks[0].style.bulletStyle).toBe('none');
});

test('backup exports blocks and library, import rejects invalid data and restores valid backups',async({page})=>{
 await selectBlock(page);await block(page).getByRole('textbox',{name:'Block title',exact:true}).fill('Backed up title');const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:/Backup/}).click();const download=await downloadPromise;const stream=await download.createReadStream();let text='';for await(const chunk of stream)text+=chunk;const backup=JSON.parse(text);expect(backup.schemaVersion).toBe(2);expect(backup.sections[1].blocks[0].title).toBe('Backed up title');expect(backup.blockLibrary).toEqual([]);
 await page.locator('#import-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"sections":[]}')});await expect(page.locator('#toast')).toContainText('Invalid');await expect(block(page).locator('.block-title')).toHaveText('Backed up title');
 backup.name='Restored name';await page.locator('#import-file').setInputFiles({name:'resume.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await expect(canvas(page).getByRole('textbox',{name:'Full name',exact:true})).toHaveText('Restored name');
});

test('print hides editing controls, outlines and empty placeholders',async({page})=>{
 await selectBlock(page);await expect(block(page).locator('.block-toolbar')).toBeVisible();await page.emulateMedia({media:'print'});await expect(block(page).locator('.block-toolbar')).toBeHidden();await expect(canvas(page).locator('.column-add').first()).toBeHidden();await expect(block(page).locator('.block-paragraph')).toBeHidden();await expect(block(page)).toHaveCSS('outline-style','none');
 const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});expect(pdf.byteLength).toBeGreaterThan(10000);
});

test('long resumes show separate printable pages with all bullet content',async({page})=>{
 const fixture=process.env.RESUME_FIXTURE;
 const resume=fixture?JSON.parse(readFileSync(fixture,'utf8')):structuredClone(initial);
 if(!fixture){resume.sections[1].blocks[0].bullets=Array.from({length:90},(_,i)=>`Achievement ${i+1}: designed and delivered reliable software for teams and customers across multiple products.`);}
 await page.evaluate(data=>{localStorage.removeItem('folio-resumes-v1');localStorage.setItem('folio-resume-v2',JSON.stringify(data));},resume);
 await page.reload();
 const pages=canvas(page).locator('.resume-page');
 const count=await pages.count();
 expect(count).toBeGreaterThan(1);
 await expect(page.locator('#page-count')).toHaveText(`${count} pages`);
 const actual=await canvas(page).locator('.bullet-text').allTextContents();
 const expected=resume.sections.flatMap(s=>s.blocks.flatMap(b=>b.bullets));
 expect(actual.filter(Boolean).sort()).toEqual(expected.filter(Boolean).sort());
 const overflows=await pages.evaluateAll(list=>list.flatMap((sheet,index)=>{
   const bottom=sheet.getBoundingClientRect().bottom;
   return [...sheet.querySelectorAll('.resume-block,.section-heading-row')]
     .filter(el=>el.getBoundingClientRect().bottom>bottom-10)
     .map(el=>({page:index+1,text:el.textContent.slice(0,70),by:Math.round(el.getBoundingClientRect().bottom-bottom)}));
 }));
 expect(overflows).toEqual([]);
 await page.emulateMedia({media:'print'});
 const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});
 const pdfPages=[...pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;
 expect(pdfPages).toBe(count);
 if(process.env.PDF_OUTPUT)writeFileSync(process.env.PDF_OUTPUT,pdf);
 if(fixture)console.log(`Fixture preview/PDF pages: ${count}/${pdfPages}`);
});

test('an oversized paragraph continues on later sheets without losing text',async({page})=>{
 const resume=structuredClone(initial),target=resume.sections[1].blocks[0];
 target.bullets=[];
 target.paragraph=Array.from({length:110},(_,i)=>`Paragraph ${i+1} explains how a product improved reliability for its customers and made work easier for the engineering team. `).join('');
 await page.evaluate(data=>{localStorage.removeItem('folio-resumes-v1');localStorage.setItem('folio-resume-v2',JSON.stringify(data));},resume);
 await page.reload();
 const fragments=canvas(page).locator(`[data-block="${target.id}"] .block-paragraph`);
 expect(await fragments.count()).toBeGreaterThan(1);
 expect((await fragments.allTextContents()).join('')).toBe(target.paragraph);
 const overflows=await canvas(page).locator('.resume-page').evaluateAll(list=>list.flatMap((sheet,index)=>[...sheet.querySelectorAll('.resume-block')].filter(el=>el.getBoundingClientRect().bottom>sheet.getBoundingClientRect().bottom-10).map(()=>index+1)));
 expect(overflows).toEqual([]);
 await fragments.last().click();
 await expect(page.locator('.inspector textarea[data-path$=".paragraph"]')).toHaveValue(target.paragraph);
});

test('one oversized bullet continues without clipping or losing text',async({page})=>{
 const resume=structuredClone(initial),target=resume.sections[1].blocks[0];
 target.paragraph='';
 target.bullets=[Array.from({length:100},(_,i)=>`Impact ${i+1} improved reliability and delivery for the product team and its customers. `).join('')];
 await page.evaluate(data=>{localStorage.removeItem('folio-resumes-v1');localStorage.setItem('folio-resume-v2',JSON.stringify(data));},resume);
 await page.reload();
 const fragments=canvas(page).locator(`[data-block="${target.id}"] .bullet-text`);
 expect(await fragments.count()).toBeGreaterThan(1);
 expect((await fragments.allTextContents()).join('')).toBe(target.bullets[0]);
 const overflows=await canvas(page).locator('.resume-page').evaluateAll(list=>list.flatMap((sheet,index)=>[...sheet.querySelectorAll('.resume-block')].filter(el=>el.getBoundingClientRect().bottom>sheet.getBoundingClientRect().bottom-10).map(()=>index+1)));
 expect(overflows).toEqual([]);
});

test('desktop canvas visual regression',async({page})=>{await page.mouse.move(0,0);await expect(page).toHaveScreenshot('desktop-canvas.png');});
test('selected engineering block visual regression',async({page})=>{await openDesign(page);await page.getByRole('button',{name:/Engineering style/}).click();await selectBlock(page);await page.mouse.move(0,0);await expect(page).toHaveScreenshot('engineering-block.png');});
test('mobile editor has no horizontal page overflow and matches its baseline',async({page})=>{await page.setViewportSize({width:390,height:844});await page.mouse.move(0,0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await expect(page).toHaveScreenshot('mobile-editor.png',{fullPage:true});});

test('design controls visual regression',async({page})=>{await openDesign(page);await page.mouse.move(0,0);await expect(page).toHaveScreenshot('design-controls.png');});
test('block library visual regression',async({page})=>{await canvas(page).locator('[data-section="summary"]').getByRole('button',{name:'＋ Add block',exact:true}).click();await page.mouse.move(0,0);await expect(page.getByRole('dialog')).toHaveScreenshot('block-library.png');});
test('printed resume visual regression',async({page})=>{await page.setViewportSize({width:794,height:1123});await page.emulateMedia({media:'print'});await page.mouse.move(0,0);await expect(canvas(page)).toHaveScreenshot('printed-resume.png');});

test('portrait upload is local, survives reload and backup, and stays available across layouts',async({page})=>{
 await uploadPortrait(page);
 const photo=canvas(page).locator('.resume-photo');await expect(photo).toHaveAttribute('src',/^data:image\/jpeg;base64,/);
 expect((await state(page)).photo).toMatch(/^data:image\/jpeg;base64,/);
 await page.reload();await expect(photo).toBeVisible();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:/Backup/}).click();
 const download=await downloadPromise,stream=await download.createReadStream();let text='';for await(const chunk of stream)text+=chunk;
 expect(JSON.parse(text).photo).toBe((await state(page)).photo);
 await openDesign(page);await page.locator('[data-template="classic"]').click();await expect(photo).toHaveCount(0);expect((await state(page)).photo).toMatch(/^data:image\/jpeg;base64,/);
 await page.locator('[data-template="modern"]').click();await expect(photo).toBeVisible();await expect(photo).toHaveCSS('border-radius','50%');
 await page.locator('.panel-tabs [data-tab="content"]').click();await page.locator('[data-select-section="personal"]').click();await expect(page.getByLabel('Photo framing',{exact:true})).toBeVisible();await page.getByLabel('Photo shape',{exact:true}).selectOption('square');await page.getByLabel('Photo framing',{exact:true}).selectOption('top');
 await expect(photo).toHaveCSS('border-radius','0px');expect((await state(page)).design.photoPosition).toBe('top');
});

test('photo removal and undo update the resume without clearing other content',async({page})=>{
 await uploadPortrait(page);const name=await canvas(page).getByRole('textbox',{name:'Full name',exact:true}).textContent();
 await page.locator('#remove-photo').click();await expect(canvas(page).locator('.resume-photo')).toHaveCount(0);expect((await state(page)).photo).toBe('');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(canvas(page).locator('.resume-photo')).toBeVisible();
 expect(await canvas(page).getByRole('textbox',{name:'Full name',exact:true}).textContent()).toBe(name);
});

test('unsupported photo files leave the saved resume intact',async({page})=>{
 await page.locator('#photo-file').setInputFiles({name:'vector.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')});
 await expect(page.locator('#toast')).toContainText('JPG, PNG, or WebP');
 expect((await state(page))?.photo||'').toBe('');await expect(canvas(page).locator('.resume-photo')).toHaveCount(0);
});

test('portrait is included in the printed resume and photo controls are hidden',async({page})=>{
 await uploadPortrait(page);await page.emulateMedia({media:'print'});
 await expect(canvas(page).locator('.resume-photo')).toBeVisible();await expect(canvas(page).locator('.photo-change')).toBeHidden();
 const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});expect(pdf.byteLength).toBeGreaterThan(12000);
});

test('modern portrait visual regression',async({page})=>{
 await page.locator('.panel-tabs [data-tab="design"]').click();await page.locator('[data-template="modern"]').click();await uploadPortrait(page);
 await page.mouse.move(0,0);await expect(canvas(page)).toHaveScreenshot('modern-portrait.png');
});
