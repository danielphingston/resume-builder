import {test,expect} from '@playwright/test';

const links=page=>page.evaluate(()=>{
  const {activeId}=JSON.parse(localStorage.getItem('folio-resumes-v1'));
  return JSON.parse(localStorage.getItem(`folio-resume-doc-${activeId}`)).links;
});

test('extra links are limited to ten rows in the editor and imported backups',async({page})=>{
  await page.goto('/');
  const add=page.getByRole('button',{name:'Add link'});
  for(let count=1;count<=10;count++){
    await add.click();
    expect(await links(page)).toHaveLength(count);
  }
  if(await add.isVisible()&&await add.isEnabled())await add.click();
  expect(await links(page)).toHaveLength(10);
  const saved=await page.evaluate(()=>{
    const {activeId}=JSON.parse(localStorage.getItem('folio-resumes-v1'));
    return JSON.parse(localStorage.getItem(`folio-resume-doc-${activeId}`));
  });
  const tooMany=structuredClone(saved);
  tooMany.links.push({label:'Eleventh',url:'https://example.com/eleventh'});
  await page.locator('#import-file').setInputFiles({name:'too-many-links.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(tooMany))});
  expect((await links(page)).length).toBeLessThanOrEqual(10);
});
