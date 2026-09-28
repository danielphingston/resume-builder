import {test,expect} from '@playwright/test';

const resume=page=>page.evaluate(()=>{
  const {activeId}=JSON.parse(localStorage.getItem('folio-resumes-v1'));
  return JSON.parse(localStorage.getItem(`folio-resume-doc-${activeId}`));
});
const selectedDelete=page=>page.locator('.inspector').getByRole('button',{name:'Delete block',exact:true});

test.beforeEach(async({page})=>{
  await page.goto('/');
  await expect(page.locator('#resume').getByRole('textbox',{name:'Full name',exact:true})).toHaveText('Jordan Davis');
});

test('AI helper follows Check in the primary left rail',async({page})=>{
  const link=page.locator('aside.rail > [data-tab="check"] + a').filter({hasText:'AI helper'});
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href','./ai-helper.html');
  await expect(page.locator('.rail-bottom').getByRole('link',{name:'AI helper'})).toHaveCount(0);
  await link.click();
  await expect(page).toHaveURL(/\/ai-helper\.html$/);
  await expect(page.getByRole('heading',{name:'AI resume helper'})).toBeVisible();
});

test('deleting a selected block updates the resume and supports undo and redo',async({page})=>{
  const before=await resume(page),target=before.sections[1].blocks[0];
  await page.locator(`#resume [data-block="${target.id}"]`).getByRole('textbox',{name:'Block title',exact:true}).click();
  await expect(selectedDelete(page)).toBeVisible();
  let dialogs=0;
  page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
  await selectedDelete(page).click();
  await expect(page.locator(`#resume [data-block="${target.id}"]`)).toHaveCount(0);
  expect(dialogs).toBe(0);
  expect((await resume(page)).sections[1].blocks.map(block=>block.id)).not.toContain(target.id);
  await expect(page.locator('.inspector')).toContainText('SECTION SETTINGS');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(page.locator(`#resume [data-block="${target.id}"]`)).toBeVisible();
  expect((await resume(page)).sections[1].blocks[0]).toEqual(target);
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  await expect(page.locator(`#resume [data-block="${target.id}"]`)).toHaveCount(0);
  await page.reload();
  expect((await resume(page)).sections[1].blocks.map(block=>block.id)).not.toContain(target.id);
});

test('deleting the last block leaves its section usable and can be undone',async({page})=>{
  const before=await resume(page),section=before.sections[0],target=section.blocks[0];
  expect(section.blocks).toHaveLength(1);
  await page.locator(`#resume [data-block="${target.id}"]`).getByRole('textbox',{name:'Write a paragraph…'}).click();
  await selectedDelete(page).click();
  const after=await resume(page);
  expect(after.sections[0].id).toBe(section.id);
  expect(after.sections[0].blocks).toEqual([]);
  await expect(page.locator(`#resume [data-section="${section.id}"]`)).toBeVisible();
  await expect(page.locator(`#resume [data-section="${section.id}"] [data-add-block]`).first()).toBeVisible();
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  expect((await resume(page)).sections[0].blocks[0]).toEqual(target);
});
