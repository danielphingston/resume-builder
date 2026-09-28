import {test,expect} from '@playwright/test';
import {initial} from '../src/model.mjs';

async function loadLongResume(page){
  const resume=structuredClone(initial);
  const example=resume.sections.find(section=>section.id==='experience').blocks[0];
  for(let index=0;index<12;index++){
    resume.sections.push({
      id:`scroll-section-${index}`,
      title:`Additional experience ${index+1}`,
      column:'main',
      blockSpacing:18,
      blocks:[{...structuredClone(example),id:`scroll-block-${index}`,title:`Additional role ${index+1}`}]
    });
  }
  await page.goto('/');
  await page.evaluate(data=>{
    localStorage.removeItem('folio-resumes-v1');
    localStorage.setItem('folio-resume-v2',JSON.stringify(data));
  },resume);
  await page.reload();
  await expect(page.locator('#resume .resume-page').first()).toBeVisible();
}

async function scrollPosition(page){
  return page.evaluate(()=>{
    const preview=document.querySelector('#preview-scroll');
    const editor=document.querySelector('#editor-content');
    return {
      preview:preview.scrollTop,
      previewMax:preview.scrollHeight-preview.clientHeight,
      editor:editor.scrollTop,
      editorMax:editor.scrollHeight-editor.clientHeight,
      window:window.scrollY
    };
  });
}

async function settleScroll(page){
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}

function expectStable(before,after,keys){
  for(const key of keys){
    expect(Math.abs(after[key]-before[key]),`${key} moved on click-away: ${JSON.stringify({before,after})}`).toBeLessThanOrEqual(3);
  }
}

test('repeated click-away preserves desktop preview and editor scroll',async({page})=>{
  await loadLongResume(page);
  const title=page.locator('#resume [data-block="legacy-1-0"]').first().getByRole('textbox',{name:'Block title',exact:true});
  for(const previewTop of [320,800]){
    await title.click();
    await expect(page.locator('#resume .resume-block.selected').first()).toBeVisible();
    await page.evaluate(top=>{
      document.querySelector('#preview-scroll').scrollTop=top;
      document.querySelector('#editor-content').scrollTop=180;
    },previewTop);
    await page.waitForTimeout(80);
    const before=await scrollPosition(page);
    expect(before.previewMax).toBeGreaterThan(before.preview+100);
    expect(before.editorMax).toBeGreaterThan(before.editor+100);
    await page.locator('#preview-scroll').click({position:{x:8,y:8}});
    await expect(page.locator('#resume .resume-block.selected')).toHaveCount(0);
    await settleScroll(page);
    expectStable(before,await scrollPosition(page),['preview','editor','window']);
  }
});

test('clicking outside the selected section preserves mobile page and editor scroll',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await loadLongResume(page);
  await page.locator('#resume [data-section="experience"] .section-heading-row').first().getByRole('textbox',{name:'Section heading',exact:true}).click();
  await expect(page.locator('#resume .section-selected').first()).toBeVisible();
  await page.evaluate(()=>{
    const preview=document.querySelector('#preview-scroll');
    document.querySelector('#editor-content').scrollTop=120;
    window.scrollTo(0,window.scrollY+preview.getBoundingClientRect().top+180);
  });
  await settleScroll(page);
  const before=await scrollPosition(page);
  expect(before.editorMax).toBeGreaterThan(before.editor+100);
  expect(before.window).toBeGreaterThan(50);
  await page.mouse.click(30,400);
  await expect(page.locator('#resume .section-selected')).toHaveCount(0);
  await settleScroll(page);
  expectStable(before,await scrollPosition(page),['preview','editor','window']);
});
