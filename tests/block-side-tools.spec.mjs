import {test,expect} from '@playwright/test';

const savedResume=page=>page.evaluate(()=>{
  const {activeId}=JSON.parse(localStorage.getItem('folio-resumes-v1'));
  return JSON.parse(localStorage.getItem(`folio-resume-doc-${activeId}`));
});
const block=(page,id)=>page.locator(`#resume [data-block="${id}"]`).first();
const tools=(page,id)=>block(page,id).locator('.block-canvas-actions');

test.beforeEach(async({page})=>{
  await page.goto('/');
  await expect(page.locator('#resume').getByRole('textbox',{name:'Full name',exact:true})).toHaveText('Jordan Davis');
});

test('block side tools mirror section tools with drag and delete only',async({page})=>{
  const id=(await savedResume(page)).sections[1].blocks[0].id;
  const target=block(page,id),actions=tools(page,id);
  await expect(target.locator('.block-toolbar')).toHaveCount(0);
  await expect(actions).toHaveCount(1);
  await expect(actions.locator('button')).toHaveCount(2);
  const sectionActions=page.locator('.section-canvas-actions').first();
  const geometry=el=>el.evaluate(node=>{const style=getComputedStyle(node),button=getComputedStyle(node.querySelector('button'));return {direction:style.flexDirection,gap:style.gap,button:{minWidth:button.minWidth,height:button.height,padding:button.padding,background:button.backgroundColor,color:button.color,fontSize:button.fontSize,lineHeight:button.lineHeight}};});
  expect(await geometry(actions)).toEqual(await geometry(sectionActions));
  expect((await geometry(actions)).direction).toBe('row-reverse');
  const drag=actions.getByRole('button',{name:/Drag block/});
  await expect(drag).toHaveAttribute('draggable','true');
  await expect(actions.getByRole('button',{name:'Delete block'})).toHaveCount(1);
  await expect(actions.getByRole('button',{name:'Move block up'})).toHaveCount(0);
  await expect(actions.getByRole('button',{name:'Move block down'})).toHaveCount(0);
  await expect(actions.getByRole('button',{name:'Duplicate block'})).toHaveCount(0);
  await expect.poll(()=>actions.evaluate(el=>getComputedStyle(el).opacity)).toBe('0');
  await target.hover();
  await expect.poll(()=>actions.evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
  const placement=await actions.evaluate(el=>{
    const a=el.getBoundingClientRect(),b=el.closest('.resume-block').getBoundingClientRect();
    return {onRight:a.left>=b.left+b.width*.75,beside:a.bottom>b.top};
  });
  expect(placement).toEqual({onRight:true,beside:true});
  await page.mouse.move(0,0);
  await drag.focus();
  await expect.poll(()=>actions.evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
  await target.getByRole('textbox',{name:'Block title',exact:true}).click();
  await expect.poll(()=>actions.evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
});

test('move and duplicate stay in the inspector while side delete is undoable and persists',async({page})=>{
  const original=(await savedResume(page)).sections[1].blocks;
  const first=original[0].id,second=original[1].id;
  await block(page,first).getByRole('textbox',{name:'Block title',exact:true}).click();
  const inspector=page.locator('.inspector');
  await expect(inspector.getByRole('button',{name:'Move block up'})).toBeDisabled();
  await inspector.getByRole('button',{name:'Move block down'}).click();
  expect((await savedResume(page)).sections[1].blocks.slice(0,2).map(item=>item.id)).toEqual([second,first]);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  expect((await savedResume(page)).sections[1].blocks[0].id).toBe(first);
  await block(page,first).getByRole('textbox',{name:'Block title',exact:true}).click();
  await inspector.getByRole('button',{name:'Duplicate',exact:true}).click();
  const copied=(await savedResume(page)).sections[1].blocks;
  expect(copied).toHaveLength(original.length+1);
  expect(copied[1].id).not.toBe(first);
  expect(copied[1].title).toBe(original[0].title);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  expect((await savedResume(page)).sections[1].blocks).toHaveLength(original.length);

  await block(page,first).getByRole('textbox',{name:'Block title',exact:true}).click();
  await tools(page,first).getByRole('button',{name:'Delete block'}).click();
  expect((await savedResume(page)).sections[1].blocks.map(item=>item.id)).not.toContain(first);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  expect((await savedResume(page)).sections[1].blocks[0].id).toBe(first);
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  await page.reload();
  expect((await savedResume(page)).sections[1].blocks.map(item=>item.id)).not.toContain(first);
});

test('side delete stays reachable on mobile and tools hide from PDF and print',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const first=(await savedResume(page)).sections[1].blocks[0].id;
  await block(page,first).getByRole('textbox',{name:'Block title',exact:true}).click();
  const remove=tools(page,first).getByRole('button',{name:'Delete block'});
  await remove.scrollIntoViewIfNeeded();
  await expect(remove).toBeVisible();
  expect(await remove.evaluate(el=>{
    const button=el.getBoundingClientRect(),scroll=el.closest('#preview-scroll').getBoundingClientRect();
    return button.left>=scroll.left&&button.right<=scroll.right&&button.top>=scroll.top&&button.bottom<=scroll.bottom;
  })).toBe(true);
  await remove.click();
  expect((await savedResume(page)).sections[1].blocks.map(item=>item.id)).not.toContain(first);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await page.getByRole('button',{name:'PDF view'}).click();
  await expect(page.locator('#resume .block-canvas-actions').first()).toBeHidden();
  await page.getByRole('button',{name:'Edit view'}).click();
  await page.emulateMedia({media:'print'});
  await expect(page.locator('#resume .block-canvas-actions').first()).toBeHidden();
});
