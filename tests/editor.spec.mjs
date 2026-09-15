import {test,expect} from '@playwright/test';
import {legacyInitial} from './legacy-fixture.mjs';
const canvas=page=>page.locator('#resume');
const block=page=>canvas(page).locator('[data-block]').nth(1);
const state=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('folio-resume-v2')));
const openDesign=page=>page.locator('.panel-tabs [data-tab="design"]').click();
const openContent=page=>page.locator('.panel-tabs [data-tab="content"]').click();
async function selectBlock(page){await block(page).getByRole('textbox',{name:'Block title',exact:true}).click();}
async function setColor(page,label,value){await page.getByLabel(label,{exact:true}).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},value);}

test.beforeEach(async({page})=>{await page.goto('/');await expect(canvas(page).getByRole('textbox',{name:'Full name',exact:true})).toHaveText('Jordan Davis');});

test('direct editing keeps the caret, syncs sidebar, survives reload, and supports undo/redo',async({page})=>{
 const name=canvas(page).getByRole('textbox',{name:'Full name',exact:true});await name.fill('Alex Rivera');await name.press('End');await page.keyboard.type(' Smith');await expect(name).toHaveText('Alex Rivera Smith');await expect(page.locator('input[data-path="name"]')).toHaveValue('Alex Rivera Smith');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(name).toHaveText('Jordan Davis');await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(name).toHaveText('Alex Rivera Smith');
 await page.reload();await expect(name).toHaveText('Alex Rivera Smith');
 const title=block(page).getByRole('textbox',{name:'Block title',exact:true});await title.fill('Senior Software Engineer');await title.press('Enter');await expect(title).toHaveText('Senior Software Engineer');expect((await state(page)).sections[1].blocks[0].title).toBe('Senior Software Engineer');
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
 await expect(canvas(page)).toHaveClass(/headings-line/);await expect(canvas(page)).toHaveClass(/font-verdana/);await expect(block(page).locator('.block-bullets')).toHaveCSS('list-style-type','decimal');await expect(block(page).locator('.entry-subtitle')).toHaveCSS('color','rgb(255, 119, 0)');
 await selectBlock(page);await page.getByLabel('Bullet style',{exact:true}).selectOption('check');await expect(block(page).locator('.block-bullets li').first()).toHaveCSS('--bullet-custom','\'✓  \'');
 await setColor(page,'Title color','#263d66');await expect(block(page).locator('.block-title')).toHaveCSS('color','rgb(38, 61, 102)');await page.locator('[data-reset$=".titleColor"]').click();await expect(block(page).locator('.block-title')).toHaveCSS('color','rgb(153, 0, 0)');
});

test('legacy storage is migrated in place without losing resume content',async({page})=>{
 await page.evaluate(data=>{localStorage.removeItem('folio-resume-v2');localStorage.setItem('folio-resume-v1',JSON.stringify(data));},legacyInitial);await page.reload();await expect(block(page).getByRole('textbox',{name:'Block title',exact:true})).toHaveText('Senior Product Designer');
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

test('desktop canvas visual regression',async({page})=>{await page.mouse.move(0,0);await expect(page).toHaveScreenshot('desktop-canvas.png');});
test('selected engineering block visual regression',async({page})=>{await openDesign(page);await page.getByRole('button',{name:/Engineering style/}).click();await selectBlock(page);await page.mouse.move(0,0);await expect(page).toHaveScreenshot('engineering-block.png');});
test('mobile editor has no horizontal page overflow and matches its baseline',async({page})=>{await page.setViewportSize({width:390,height:844});await page.mouse.move(0,0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await expect(page).toHaveScreenshot('mobile-editor.png',{fullPage:true});});

test('design controls visual regression',async({page})=>{await openDesign(page);await page.mouse.move(0,0);await expect(page).toHaveScreenshot('design-controls.png');});
test('block library visual regression',async({page})=>{await canvas(page).locator('[data-section="summary"]').getByRole('button',{name:'＋ Add block',exact:true}).click();await page.mouse.move(0,0);await expect(page.getByRole('dialog')).toHaveScreenshot('block-library.png');});
test('printed resume visual regression',async({page})=>{await page.setViewportSize({width:794,height:1123});await page.emulateMedia({media:'print'});await page.mouse.move(0,0);await expect(canvas(page)).toHaveScreenshot('printed-resume.png');});
