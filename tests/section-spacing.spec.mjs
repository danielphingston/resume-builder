import {test,expect} from '@playwright/test';

const resume=page=>page.evaluate(()=>{
  const {activeId}=JSON.parse(localStorage.getItem('folio-resumes-v1'));
  return JSON.parse(localStorage.getItem(`folio-resume-doc-${activeId}`));
});
const selectSection=(page,id)=>page.locator(`.section-card[data-section="${id}"] [data-select-section="${id}"]`).click();
const spacing=page=>page.getByRole('slider',{name:/Block spacing/i});
async function setSpacing(page,value){
  await spacing(page).evaluate((input,next)=>{
    input.value=String(next);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  },value);
}
const block=page=>page.locator('#resume [data-section="experience"] [data-block]').first();

test.beforeEach(async({page})=>{
  await page.goto('/');
  await expect(page.locator('#resume').getByRole('textbox',{name:'Full name',exact:true})).toHaveText('Jordan Davis');
});

test('section settings have an accessible independent block spacing control with undo and reload',async({page})=>{
  await selectSection(page,'experience');
  await expect(spacing(page)).toHaveCount(1);
  await expect(spacing(page)).toHaveAttribute('type','range');
  await expect(spacing(page)).toHaveAttribute('min','0');
  await expect(spacing(page)).toHaveAttribute('max','48');
  await expect(spacing(page)).toHaveAttribute('step','2');
  await expect(spacing(page)).toHaveValue('18');
  await setSpacing(page,28);
  await expect(block(page)).toHaveCSS('margin-bottom','28px');
  expect((await resume(page)).sections.find(section=>section.id==='experience').blockSpacing).toBe(28);

  await selectSection(page,'summary');
  await expect(spacing(page)).toHaveValue('18');
  await setSpacing(page,6);
  let saved=await resume(page);
  expect(saved.sections.find(section=>section.id==='summary').blockSpacing).toBe(6);
  expect(saved.sections.find(section=>section.id==='experience').blockSpacing).toBe(28);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  saved=await resume(page);
  expect(saved.sections.find(section=>section.id==='summary').blockSpacing).toBe(18);
  expect(saved.sections.find(section=>section.id==='experience').blockSpacing).toBe(28);
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  expect((await resume(page)).sections.find(section=>section.id==='summary').blockSpacing).toBe(6);
  await page.reload();
  await selectSection(page,'experience');
  await expect(spacing(page)).toHaveValue('28');
  await selectSection(page,'summary');
  await expect(spacing(page)).toHaveValue('6');
});

test('section block spacing is preserved in PDF view and print layout',async({page})=>{
  await selectSection(page,'experience');
  await setSpacing(page,30);
  const lastBlock=page.locator('#resume [data-section="experience"] [data-block]').last();
  await expect(block(page)).toHaveCSS('margin-bottom','30px');
  await expect(lastBlock).toHaveCSS('margin-bottom','0px');
  await page.getByRole('button',{name:'PDF view'}).click();
  await expect(block(page)).toHaveCSS('margin-bottom','30px');
  await expect(lastBlock).toHaveCSS('margin-bottom','0px');
  await page.emulateMedia({media:'print'});
  await expect(block(page)).toHaveCSS('margin-bottom','30px');
  await expect(lastBlock).toHaveCSS('margin-bottom','0px');
});

test('backup exports section spacing and import restores it or defaults older data',async({page})=>{
  await selectSection(page,'experience');
  await setSpacing(page,30);
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:/Backup/}).click();
  const stream=await (await downloadPromise).createReadStream();
  let text='';for await(const chunk of stream)text+=chunk;
  const backup=JSON.parse(text);
  expect(backup.sections.find(section=>section.id==='experience').blockSpacing).toBe(30);

  await setSpacing(page,8);
  await page.locator('#import-file').setInputFiles({name:'spaced-resume.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await expect(block(page)).toHaveCSS('margin-bottom','30px');
  expect((await resume(page)).sections.find(section=>section.id==='experience').blockSpacing).toBe(30);

  for(const section of backup.sections)delete section.blockSpacing;
  await page.locator('#import-file').setInputFiles({name:'older-resume.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  expect((await resume(page)).sections.every(section=>section.blockSpacing===18)).toBe(true);
  await expect(block(page)).toHaveCSS('margin-bottom','18px');
});

test('AI helper JSON Schema describes section block spacing',async({page})=>{
  await page.goto('/ai-helper.html');
  const schema=JSON.parse(await page.locator('#resume-json-schema').textContent());
  const node=schema.properties.sections.items;
  const section=node.$ref?node.$ref.split('/').slice(1).reduce((value,key)=>value[key],schema):node;
  expect(section.properties.blockSpacing).toMatchObject({type:'number',minimum:0,maximum:48});
  expect(section.required).toContain('blockSpacing');
});
