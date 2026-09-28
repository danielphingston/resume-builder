import {test,expect} from '@playwright/test';

const resume=page=>page.evaluate(()=>{
  const {activeId}=JSON.parse(localStorage.getItem('folio-resumes-v1'));
  return JSON.parse(localStorage.getItem(`folio-resume-doc-${activeId}`));
});
async function expectInsidePreview(control){
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeVisible();
  expect(await control.evaluate(el=>{
    const button=el.getBoundingClientRect();
    const scroll=el.closest('#preview-scroll').getBoundingClientRect();
    return button.width>0&&button.height>0&&button.left>=scroll.left&&button.right<=scroll.right&&button.top>=scroll.top&&button.bottom<=scroll.bottom;
  })).toBe(true);
}

test.beforeEach(async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.locator('#resume').getByRole('textbox',{name:'Full name',exact:true})).toHaveText('Jordan Davis');
});

test('selected block can be deleted directly from the mobile canvas',async({page})=>{
  const before=await resume(page),section=before.sections[1],target=section.blocks[0];
  const block=page.locator(`#resume [data-block="${target.id}"]`).first();
  await block.getByRole('textbox',{name:'Block title',exact:true}).click();
  const remove=block.locator('.block-canvas-actions').getByRole('button',{name:'Delete block'});
  await expectInsidePreview(remove);
  await remove.click();
  await expect(page.locator(`#resume [data-block="${target.id}"]`)).toHaveCount(0);
  expect((await resume(page)).sections[1].blocks.map(item=>item.id)).not.toContain(target.id);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  expect((await resume(page)).sections[1].blocks[0]).toEqual(target);
});

test('selected section can be deleted from its mobile canvas heading and undone',async({page})=>{
  const before=await resume(page),target=before.sections[1],other=before.sections[0];
  const section=page.locator(`#resume [data-section="${target.id}"]`).first();
  await section.locator('.section-heading-row').getByRole('textbox',{name:'Section heading'}).click();
  const remove=section.locator('.section-heading-row').getByRole('button',{name:'Delete section'});
  await expectInsidePreview(remove);
  expect(await remove.evaluate(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return hit===el||el.contains(hit)})).toBe(true);
  await remove.click();
  await expect(page.locator(`#resume [data-section="${target.id}"]`)).toHaveCount(0);
  const after=await resume(page);
  expect(after.sections.map(item=>item.id)).not.toContain(target.id);
  expect(after.sections.find(item=>item.id===other.id)).toEqual(other);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  expect((await resume(page)).sections[1]).toEqual(target);
  await page.emulateMedia({media:'print'});
  await expect(section.locator('.section-heading-row').getByRole('button',{name:/Delete section/})).toBeHidden();
});
