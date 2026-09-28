import {test,expect} from '@playwright/test';

const savedResume=page=>page.evaluate(()=>{
  const {activeId}=JSON.parse(localStorage.getItem('folio-resumes-v1'));
  return JSON.parse(localStorage.getItem(`folio-resume-doc-${activeId}`));
});
const rows=page=>page.locator('.extra-link-row');
const header=page=>page.locator('#resume .resume-header').first();
const upload=(page,data,name='links.json')=>page.locator('#import-file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});

test.beforeEach(async({page})=>{
  await page.goto('/');
  await expect(header(page).getByRole('textbox',{name:'Full name',exact:true})).toHaveText('Jordan Davis');
});

test('personal details can add, edit, reorder, and remove independent links by keyboard',async({page})=>{
  const website=(await savedResume(page)).website;
  const add=page.getByRole('button',{name:'Add link'});
  await expect(add).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await expect(header(page).getByRole('link')).toHaveCount(0);
  await add.focus();
  await add.press('Enter');
  await expect(rows(page)).toHaveCount(1);
  expect((await savedResume(page)).links).toEqual([{label:'',url:''}]);
  await expect(header(page).getByRole('link')).toHaveCount(0);
  await page.reload();
  await expect(rows(page)).toHaveCount(1);

  const first=rows(page).nth(0);
  const label=first.getByRole('textbox',{name:'Label'});
  const url=first.getByRole('textbox',{name:'URL'});
  await expect(label).toBeVisible();
  await expect(url).toBeVisible();
  await label.fill('GitHub');
  await expect(header(page).getByRole('link',{name:'GitHub'})).toHaveCount(0);
  await label.focus();
  await label.press('Tab');
  await expect(url).toBeFocused();
  await url.fill('javascript:alert(1)');
  await expect(header(page).getByRole('link',{name:'GitHub'})).toHaveCount(0);
  await page.reload();
  expect((await savedResume(page)).links[0].url).toBe('javascript:alert(1)');
  await expect(header(page).getByRole('link',{name:'GitHub'})).toHaveCount(0);
  await rows(page).nth(0).getByRole('textbox',{name:'URL'}).fill('https://github.com/jordan');
  await expect(header(page).getByRole('link',{name:'GitHub'})).toHaveAttribute('href','https://github.com/jordan');
  await rows(page).nth(0).getByRole('textbox',{name:'Label'}).fill('GitHub profile');
  await expect(header(page).getByRole('link',{name:'GitHub profile'})).toBeVisible();
  await rows(page).nth(0).getByRole('textbox',{name:'Label'}).fill('GitHub');

  await add.click();
  await rows(page).nth(1).getByRole('textbox',{name:'Label'}).fill('LinkedIn');
  await rows(page).nth(1).getByRole('textbox',{name:'URL'}).fill('https://linkedin.com/in/jordan');
  expect((await savedResume(page)).links.map(link=>link.label)).toEqual(['GitHub','LinkedIn']);
  await rows(page).nth(1).getByRole('button',{name:'Move link up'}).click();
  expect((await savedResume(page)).links.map(link=>link.label)).toEqual(['LinkedIn','GitHub']);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  expect((await savedResume(page)).links.map(link=>link.label)).toEqual(['GitHub','LinkedIn']);
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  expect((await savedResume(page)).links.map(link=>link.label)).toEqual(['LinkedIn','GitHub']);
  await page.locator('[data-select-section="personal"]').click();
  await rows(page).nth(0).getByRole('button',{name:'Remove link'}).click();
  expect((await savedResume(page)).links.map(link=>link.label)).toEqual(['GitHub']);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  expect((await savedResume(page)).links.map(link=>link.label)).toEqual(['LinkedIn','GitHub']);
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  expect((await savedResume(page)).links.map(link=>link.label)).toEqual(['GitHub']);
  expect((await savedResume(page)).website).toBe(website);
  await page.reload();
  expect((await savedResume(page)).links).toEqual([{label:'GitHub',url:'https://github.com/jordan'}]);
});

test('only complete credential-free HTTP links render; unsafe drafts stay inert after reload',async({page})=>{
  const original=await savedResume(page);
  const safe=structuredClone(original);
  safe.links=[{label:'<img src=x onerror=alert(1)>Work',url:'https://example.com/profile?q=1&x=2'},{label:'GitLab',url:'http://gitlab.example/me'}];
  await upload(page,safe);
  const anchor=header(page).getByRole('link',{name:safe.links[0].label});
  await expect(anchor).toBeVisible();
  expect(await anchor.evaluate(el=>el.querySelector('img,svg'))).toBeNull();
  expect(await anchor.getAttribute('href')).toBe(safe.links[0].url);
  for(const link of safe.links){
    const rendered=header(page).getByRole('link',{name:link.label});
    expect(new URL(await rendered.getAttribute('href')).protocol).toMatch(/^https?:$/);
    if(await rendered.getAttribute('target')==='_blank')expect(await rendered.getAttribute('rel')).toMatch(/noopener/);
  }

  for(const draft of [
    {label:'Missing URL',url:''},
    {label:'Incomplete',url:'example.com/profile'},
    {label:'Script',url:'javascript:alert(1)'},
    {label:'Data',url:'data:text/html,<script>'},
    {label:'File',url:'file:///etc/passwd'},
    {label:'Relative',url:'//example.com/path'},
    {label:'Credentials',url:'https://user:pass@example.com/private'},
    {label:'',url:'https://example.com'}
  ]){
    const edited=structuredClone(original);
    edited.links=[draft];
    await upload(page,edited);
    expect((await savedResume(page)).links).toEqual([draft]);
    await expect(header(page).getByRole('link')).toHaveCount(0);
    await page.reload();
    expect((await savedResume(page)).links).toEqual([draft]);
    await expect(header(page).getByRole('link')).toHaveCount(0);
  }
});

test('links survive backup/import, older files default empty, and resumes stay independent',async({page})=>{
  const edited=await savedResume(page);
  edited.links=[{label:'GitHub',url:'https://github.com/jordan'},{label:'Portfolio',url:'https://portfolio.example'}];
  await upload(page,edited);
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:/Backup/}).click();
  const stream=await (await downloadPromise).createReadStream();
  let text='';for await(const chunk of stream)text+=chunk;
  const backup=JSON.parse(text);
  expect(backup.links).toEqual(edited.links);
  const older=structuredClone(backup);
  delete older.links;
  await upload(page,older,'older-resume.json');
  expect((await savedResume(page)).links).toEqual([]);
  await expect(header(page).getByRole('link',{name:'GitHub'})).toHaveCount(0);
  await upload(page,backup,'linked-resume.json');
  expect((await savedResume(page)).links).toEqual(edited.links);

  await page.getByRole('button',{name:'Manage resumes'}).click();
  await page.getByRole('button',{name:'＋ New resume'}).click();
  await page.getByLabel('Resume title').fill('Other resume');
  await page.locator('#resume-name-form').getByRole('button',{name:'Save'}).click();
  expect((await savedResume(page)).links).toEqual([]);
  await page.getByRole('button',{name:'Manage resumes'}).click();
  await page.locator('.resume-list-row').filter({hasText:'Jordan Davis'}).getByRole('button',{name:'Open'}).click();
  expect((await savedResume(page)).links).toEqual(edited.links);
});

test('multiple header links wrap and remain visible on mobile, PDF view, and print',async({page})=>{
  const edited=await savedResume(page);
  edited.links=Array.from({length:6},(_,index)=>({label:`Project ${index+1} detailed portfolio and publication archive`,url:`https://example.com/project-${index+1}`}));
  await upload(page,edited);
  await page.setViewportSize({width:390,height:844});
  const anchors=header(page).getByRole('link');
  await expect(anchors).toHaveCount(6);
  const layout=await anchors.evaluateAll(list=>{
    const parent=list[0].closest('.resume-header').getBoundingClientRect();
    const rects=list.map(link=>link.getBoundingClientRect());
    return {rows:new Set(rects.map(rect=>Math.round(rect.top))).size,inside:rects.every(rect=>rect.left>=parent.left-1&&rect.right<=parent.right+1)};
  });
  expect(layout.rows).toBeGreaterThan(1);
  expect(layout.inside).toBe(true);
  await page.getByRole('button',{name:'PDF view'}).click();
  await expect(header(page).getByRole('link')).toHaveCount(6);
  await page.emulateMedia({media:'print'});
  await expect(header(page).getByRole('link')).toHaveCount(6);
  await expect(page.getByRole('button',{name:'Add link'})).toBeHidden();
});

test('AI helper schema and prompt preserve repeatable header links and safe URL guidance',async({page})=>{
  await page.goto('/ai-helper.html');
  const prompt=await page.locator('#ai-prompt').inputValue();
  expect(prompt).toMatch(/(?:preserve|keep)[^.]*links/i);
  expect(prompt).toMatch(/https:\/\//i);
  const schema=JSON.parse(await page.locator('#resume-json-schema').textContent());
  expect(schema.required).toContain('links');
  expect(schema.properties.links.type).toBe('array');
  expect(schema.properties.links.maxItems).toBe(10);
  const item=schema.properties.links.items;
  const link=item.$ref?item.$ref.split('/').slice(1).reduce((value,key)=>value[key],schema):item;
  expect(link.required).toEqual(expect.arrayContaining(['label','url']));
  expect(link.properties.label.type).toBe('string');
  expect(link.properties.url.type).toBe('string');
  expect(link.properties.url.description).toMatch(/https?/i);
  expect(link.properties.url.description).toMatch(/credential/i);
});
