import {test,expect} from '@playwright/test';

test('AI helper prompt tells the assistant to preserve each section block spacing setting',async({page})=>{
  await page.goto('/ai-helper.html');
  const prompt=await page.locator('#ai-prompt').inputValue();
  expect(prompt).toMatch(/(?:preserve|keep)[^.]*blockSpacing/i);
});
