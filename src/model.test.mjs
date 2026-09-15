import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,validateResume,validatePhoto,supportsPhoto,validateLibrary,checkResume,createBlock,createSection,duplicateBlock,moveBlock,moveSection,fonts,bulletStyles} from './model.mjs';
import {legacyInitial} from '../tests/legacy-fixture.mjs';
const fresh=()=>structuredClone(initial);

test('v2 backups round-trip without losing mixed content or styling',()=>{
 const data=fresh(),block=createBlock('project');block.style.titleColor='#990000';block.style.subtitleColor='#ff7700';block.style.bulletStyle='square';data.sections[0].blocks.push(block);
 assert.deepEqual(validateResume(JSON.parse(JSON.stringify(data))),data);
});
test('photo survives backups and older resumes get an empty photo field',()=>{
 const data=fresh();data.photo='data:image/png;base64,iVBORw0KGgo=';data.design.photoShape='circle';data.design.photoPosition='top';data.design.photoSize=118;
 assert.deepEqual(validateResume(JSON.parse(JSON.stringify(data))),data);
 assert.equal(validateResume(legacyInitial).photo,'');
 assert.equal(supportsPhoto('modern'),true);assert.equal(supportsPhoto('editorial'),true);assert.equal(supportsPhoto('classic'),false);
});
test('photo import accepts raster data and rejects remote, vector and oversized images',()=>{
 assert.equal(validatePhoto('data:image/jpeg;base64,AAAA'),'data:image/jpeg;base64,AAAA');
 assert.throws(()=>validatePhoto('https://example.com/photo.jpg'));
 assert.throws(()=>validatePhoto('data:image/svg+xml;base64,PHN2Zz4='));
 assert.throws(()=>validatePhoto('data:image/png;base64,'+'A'.repeat(1_500_000)));
 const bad=fresh();bad.photo='javascript:alert(1)';assert.throws(()=>validateResume(bad));
});
test('photo layout settings are bounded and invalid choices reset',()=>{
 const data=fresh();Object.assign(data.design,{photoShape:'script',photoPosition:'url()',photoSize:900});const d=validateResume(data).design;
 assert.equal(d.photoShape,'auto');assert.equal(d.photoPosition,'center');assert.equal(d.photoSize,128);
});
test('legacy resumes migrate all paragraphs, lists, and experience entries',()=>{
 const data=validateResume(legacyInitial);assert.equal(data.schemaVersion,2);assert.equal(data.sections[0].blocks[0].paragraph,legacyInitial.sections[0].text);
 assert.deepEqual(data.sections[1].blocks[0].bullets,legacyInitial.sections[1].entries[0].bullets);
 assert.equal(data.sections[1].blocks[0].date,'2022 — Present');
 assert.deepEqual(data.sections[3].blocks[0].bullets,legacyInitial.sections[3].items);
 assert.equal(data.sections[3].blocks[0].style.bulletStyle,'none');assert.deepEqual(validateResume(data),data);
});
test('rejects malformed, future version, and duplicate identifiers',()=>{
 assert.throws(()=>validateResume({sections:[]}));
 const duplicate=fresh();duplicate.sections.push(duplicate.sections[0]);assert.throws(()=>validateResume(duplicate));
 const blockDuplicate=fresh();blockDuplicate.sections[1].blocks.push(blockDuplicate.sections[0].blocks[0]);assert.throws(()=>validateResume(blockDuplicate));
 const bad=fresh();bad.sections[1].blocks[0].bullets=[null];assert.throws(()=>validateResume(bad));
 assert.throws(()=>validateResume({...fresh(),schemaVersion:99}));
});
test('rejects invalid legacy bullets instead of silently dropping them',()=>{const data=structuredClone(legacyInitial);data.sections[1].entries[0].bullets=[null];assert.throws(()=>validateResume(data));});
test('sanitizes imported global and block styling',()=>{
 const data=fresh();data.design={margin:999,accent:'red; display:none',columns:99,font:'injected',textColor:'url(x)'};data.sections[0].blocks[0].style={background:'url(https://example.com)',font:'injected',bulletStyle:'bad'};
 const normalized=validateResume(data);assert.equal(normalized.design.margin,64);assert.equal(normalized.design.accent,initial.design.accent);assert.equal(normalized.design.font,'sans');assert.equal(normalized.sections[0].blocks[0].style.background,'');assert.equal(normalized.sections[0].blocks[0].style.bulletStyle,'inherit');
});
test('all advertised fonts and bullet styles survive backups',()=>{for(const [font] of fonts)for(const [bulletStyle] of bulletStyles){const data=fresh();Object.assign(data.design,{font,bulletStyle});Object.assign(data.sections[0].blocks[0].style,{font,bulletStyle});const restored=validateResume(data);assert.equal(restored.design.font,font);assert.equal(restored.sections[0].blocks[0].style.bulletStyle,bulletStyle);}});
test('presets produce independent blocks with unique IDs',()=>{const a=createBlock('custom'),b=createBlock('custom');assert.notEqual(a.id,b.id);assert.ok(a.title&&a.subtitle&&a.paragraph&&a.bullets.length);a.bullets.push('Only A');assert.equal(b.bullets.length,1);assert.throws(()=>createBlock('missing'));});
test('duplicate preserves styles without sharing arrays',()=>{const a=createBlock('project');a.style.font='times';const b=duplicateBlock(a);assert.notEqual(a.id,b.id);b.bullets.push('Extra');b.style.font='arial';assert.equal(a.bullets.length,1);assert.equal(a.style.font,'times');});
test('block reordering and moving across sections preserves the block',()=>{const data=fresh(),source=data.sections[1],target=data.sections[0],block=source.blocks[0],before=target.blocks[0];assert.equal(moveBlock(data,block.id,target.id,before.id),true);assert.equal(target.blocks[0],block);assert.equal(source.blocks.length,2);assert.equal(moveBlock(data,block.id,target.id),true);assert.equal(target.blocks.at(-1),block);});
test('block can move into an empty section',()=>{const data=fresh(),empty={id:'empty',title:'Empty',column:'side',blocks:[]};data.sections.push(empty);const block=data.sections[0].blocks[0];assert.equal(moveBlock(data,block.id,empty.id),true);assert.equal(empty.blocks[0],block);assert.equal(data.sections[0].blocks.length,0);});
test('invalid block move is atomic',()=>{const data=fresh(),before=structuredClone(data),block=data.sections[1].blocks[0];assert.equal(moveBlock(data,block.id,'missing'),false);assert.equal(moveBlock(data,block.id,data.sections[0].id,'missing'),false);assert.equal(moveBlock(data,block.id,data.sections[1].id,block.id),false);assert.deepEqual(data,before);});
test('sections move between columns including empty columns',()=>{const data=fresh(),section=data.sections[0];assert.equal(moveSection(data,section.id,'side',data.sections[3].id),true);assert.equal(section.column,'side');assert.equal(data.sections[2],section);assert.equal(moveSection(data,section.id,'main'),true);assert.equal(data.sections.at(-1),section);});
test('invalid section move preserves content and layout',()=>{const data=fresh(),before=fresh();assert.equal(moveSection(data,data.sections[0].id,'side','missing'),false);assert.equal(moveSection(data,data.sections[0].id,'invalid'),false);assert.deepEqual(data,before);});
test('custom presets validate and retain mixed contents',()=>{const block=createBlock('custom'),saved=[{id:'preset',name:'My custom block',block}];assert.deepEqual(validateLibrary(saved),saved);assert.throws(()=>validateLibrary([{name:'',block}]));assert.throws(()=>validateLibrary([{name:'test',block:{bullets:[{}]}}]));});
test('custom sections are editable groups of blocks',()=>{const section=createSection('custom','side');assert.equal(section.column,'side');assert.equal(section.blocks.length,1);assert.ok(section.blocks[0].paragraph);});
test('scoring stays bounded and conservative formatting improves it',()=>{const data=fresh(),before=checkResume(data);assert.ok(before.score>=0&&before.score<=100);data.design.columns=1;data.design.icons='none';assert.equal(checkResume(data).score,before.score+10);});
test('keyword checks cover custom paragraphs and match full tokens',()=>{const data=fresh();data.sections[0].blocks.push(createBlock('custom'));data.sections[0].blocks.at(-1).paragraph='Rust and Kubernetes';const result=checkResume(data,'Figma Figma Kubernetes JavaScript');assert.equal(result.keywords.filter(k=>k.word==='figma').length,1);assert.equal(result.keywords.find(k=>k.word==='kubernetes').found,true);assert.equal(result.keywords.find(k=>k.word==='javascript').found,false);});
test('empty resumes receive no achievement credit',()=>{const data=fresh();data.sections=[];const result=checkResume(data);assert.equal(result.checks.find(c=>c.label==='Make your impact measurable').pass,false);assert.equal(result.checks.find(c=>c.label==='Start with action').pass,false);});
