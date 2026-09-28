import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,validateResume,createSection} from './model.mjs';

test('section block spacing defaults to the existing 18px layout for older resumes',()=>{
  assert.ok(initial.sections.every(section=>section.blockSpacing===18));
  const older=structuredClone(initial);
  for(const section of older.sections)delete section.blockSpacing;
  assert.ok(validateResume(older).sections.every(section=>section.blockSpacing===18));
  assert.equal(createSection('custom').blockSpacing,18);
});

test('section block spacing is independent, round-trips, and is clamped to 0–48px',()=>{
  const edited=structuredClone(initial);
  edited.sections[0].blockSpacing=0;
  edited.sections[1].blockSpacing=30;
  edited.sections[2].blockSpacing=48;
  const restored=validateResume(JSON.parse(JSON.stringify(edited)));
  assert.equal(restored.sections[0].blockSpacing,0);
  assert.equal(restored.sections[1].blockSpacing,30);
  assert.equal(restored.sections[2].blockSpacing,48);
  assert.equal(restored.sections[3].blockSpacing,18);
  edited.sections[0].blockSpacing=-50;
  edited.sections[1].blockSpacing=1000;
  edited.sections[2].blockSpacing='invalid';
  const bounded=validateResume(edited);
  assert.equal(bounded.sections[0].blockSpacing,0);
  assert.equal(bounded.sections[1].blockSpacing,48);
  assert.equal(bounded.sections[2].blockSpacing,18);
});
