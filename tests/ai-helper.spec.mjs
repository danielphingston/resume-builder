import {test,expect} from '@playwright/test';

const activeResume=page=>page.evaluate(()=>{
  const index=JSON.parse(localStorage.getItem('folio-resumes-v1'));
  return JSON.parse(localStorage.getItem(`folio-resume-doc-${index.activeId}`));
});
const upload=(page,name,data)=>page.locator('#import-file').setInputFiles({
  name,mimeType:'application/json',buffer:Buffer.from(typeof data==='string'?data:JSON.stringify(data))
});

test.beforeEach(async({page})=>{
  await page.goto('/');
  await expect(page.locator('#resume').getByRole('textbox',{name:'Full name',exact:true})).toHaveText('Jordan Davis');
});

test('AI helper page offers a copyable prompt and the complete version 2 backup schema',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.getByRole('link',{name:'AI helper'}).click();
  await expect(page).toHaveURL(/\/ai-helper\.html$/);
  await expect(page.getByRole('heading',{name:'AI resume helper'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Resume editor'})).toBeVisible();
  await expect(page.getByText(/backup/i).first()).toBeVisible();
  await expect(page.getByText(/import/i).first()).toBeVisible();

  await page.getByRole('button',{name:'Copy prompt'}).click();
  const copied=await page.evaluate(()=>navigator.clipboard.readText());
  const schemaText=await page.locator('#resume-json-schema').textContent();
  expect(copied).toContain(schemaText.trim());
  expect(copied).toMatch(/resume/i);
  expect(copied).toMatch(/json/i);
  expect(copied).toMatch(/schema/i);
  expect(copied).toMatch(/do not (invent|fabricate)|only use (the )?facts/i);
  expect(copied).toMatch(/section ids unique/i);
  await expect(page.locator('.schema-heading p')).toContainText(/editor validation is authoritative/i);

  const copyButton=page.getByRole('button',{name:'Copy prompt'});
  await expect(copyButton).toHaveCSS('background-color','rgb(32, 92, 82)');
  await expect(copyButton).toHaveCSS('cursor','pointer');
  await copyButton.hover();
  await expect(copyButton).toHaveCSS('filter','brightness(0.96)');
  await expect(page.getByRole('link',{name:'Resume editor'})).toHaveCSS('cursor','pointer');

  const schema=JSON.parse(schemaText);
  const deref=node=>node?.$ref?node.$ref.split('/').slice(1).reduce((value,key)=>value[key],schema):node;
  expect(schema.$schema).toMatch(/json-schema\.org/);
  expect(schema.type).toBe('object');
  expect(schema.properties.schemaVersion.const).toBe(2);
  for(const key of ['schemaVersion','photo','design','blockLibrary'])expect(schema.required).toContain(key);
  expect(schema).not.toHaveProperty('additionalProperties');
  expect(new RegExp(schema.properties.photo.pattern).test('data:image/JPEG;base64,AAAA')).toBe(true);
  for(const key of ['name','role','email','phone','location','website','sections']){
    expect(schema.required).toContain(key);
    expect(schema.properties).toHaveProperty(key);
  }
  expect(schema.properties.photo).toBeDefined();
  expect(schema.properties.design).toBeDefined();
  expect(schema.properties.blockLibrary).toBeDefined();
  expect(schema.properties.sections['x-uniqueBy']).toBe('id');
  const section=deref(schema.properties.sections.items);
  const block=deref(section.properties.blocks.items);
  expect(section.properties.blocks['x-uniqueBy']).toBe('id');
  expect(section.properties.blocks.description).toMatch(/across the full resume/i);
  expect(section).not.toHaveProperty('additionalProperties');
  expect(block).not.toHaveProperty('additionalProperties');
  expect(schema.properties.sections.maxItems).toBe(40);
  expect(section.properties.blocks.maxItems).toBe(100);
  expect(section.properties.column.enum).toEqual(expect.arrayContaining(['main','side']));
  expect(block.properties.bullets.maxItems).toBe(200);
  expect(block.properties.bullets.items.maxLength).toBe(20000);
  for(const key of ['id','title','subtitle','date','location','paragraph','bullets','icon','style'])expect(block.properties).toHaveProperty(key);
  expect(schema.properties.blockLibrary.maxItems).toBe(50);
});

test('AI-edited JSON imports through the editor, persists changes, and supports undo',async({page})=>{
  const before=await activeResume(page);
  const edited=structuredClone(before);
  edited.name='Alex Rivera';
  edited.sections[1].blocks[0].title='Staff Engineer';
  await page.getByRole('link',{name:'AI helper'}).click();
  await page.getByRole('link',{name:'Resume editor'}).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button',{name:'Import backup'})).toBeVisible();
  await upload(page,'alex-resume.json',edited);
  await expect(page.locator('#resume').getByRole('textbox',{name:'Full name',exact:true})).toHaveText('Alex Rivera');
  expect((await activeResume(page)).sections[1].blocks[0].title).toBe('Staff Engineer');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  expect((await activeResume(page)).name).toBe('Jordan Davis');
  await upload(page,'alex-resume.json',edited);
  await expect(page.locator('#resume').getByRole('textbox',{name:'Full name',exact:true})).toHaveText('Alex Rivera');
  await page.reload();
  expect((await activeResume(page)).name).toBe('Alex Rivera');
});

test('invalid AI-edited JSON stays in the editor and leaves the active resume intact',async({page})=>{
  const before=await activeResume(page);
  await page.getByRole('link',{name:'AI helper'}).click();
  await page.getByRole('link',{name:'Resume editor'}).click();
  await upload(page,'invalid.json','{"sections":[]}');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#toast')).toContainText(/invalid|supported/i);
  expect(await activeResume(page)).toEqual(before);

  const unsafe=structuredClone(before);
  unsafe.photo='https://example.com/portrait.svg';
  await upload(page,'unsafe.json',unsafe);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#toast')).toContainText(/photo|invalid/i);
  expect(await activeResume(page)).toEqual(before);
});
