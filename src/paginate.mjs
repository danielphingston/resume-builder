// Lay out the actual document in fixed-size sheets before Chrome enters print mode.
// Chrome does not reliably fragment a two-column grid across printed pages.
export function paginate(root, html, design, selectedSection, selectedBlock) {
  const width = design.paper === 'letter' ? 816 : 794;
  const height = design.paper === 'letter' ? 1056 : 1123;
  const template = document.createElement('template');
  template.innerHTML = html;
  const header = template.content.querySelector('.resume-header');
  const sourceColumns = [...template.content.querySelectorAll('.column-drop')];
  const streams = sourceColumns.map(column => ({
    name: column.dataset.column,
    sections: [...column.querySelectorAll(':scope > .resume-section')],
    add: column.querySelector(':scope > .column-add'),
  }));
  root.replaceChildren();
  root.className = 'pagination-measuring';
  const pages = [];
  const pageStyle = `--accent:${design.accent};--subtitle:${design.subtitleColor};--text:${design.textColor};--resume-size:${design.size}pt;--margin:${design.margin}px;--spacing:${design.spacing}px;--leading:${design.lineHeight};--ratio:${design.ratio}%;--photo-size:${design.photoSize}px;--photo-position:center ${design.photoPosition === 'center' ? 'center' : design.photoPosition};width:${width}px;height:${height}px`;
  function pageAt(index) {
    while (pages.length <= index) {
      const page = document.createElement('article');
      page.className = `resume-paper resume-page ${design.template} bg-${design.background} font-${design.font} headings-${design.headingStyle} default-bullets-${design.bulletStyle} icons-${design.icons}`;
      page.style.cssText = pageStyle;
      page.dataset.page = String(pages.length + 1);
      page.setAttribute('aria-label', `Resume page ${pages.length + 1}`);
      if (!pages.length) page.append(header);
      const columns = document.createElement('div');
      columns.className = `resume-columns ${design.columns === 1 ? 'single' : ''}`;
      for (const name of design.columns === 1 ? ['main'] : ['main', 'side']) {
        const column = document.createElement(name === 'side' ? 'aside' : 'div');
        column.className = `${name}-column column-drop`;
        column.dataset.column = name;
        columns.append(column);
      }
      page.append(columns);
      root.append(page);
      pages.push(page);
    }
    return pages[index];
  }
  function columnAt(index, name) { return pageAt(index).querySelector(`[data-column="${name}"]`); }
  function fits(node, page) {
    return node.getBoundingClientRect().bottom <= page.getBoundingClientRect().top + height - design.margin - 18;
  }
  function fragment(section, continued = false) {
    const part = section.cloneNode(false);
    part.classList.toggle('section-selected', section.dataset.section === selectedSection);
    const heading = section.querySelector(':scope > .section-heading-row');
    if (continued) {
      const row = document.createElement('div');
      row.className = 'section-heading-row continued-heading';
      const h = document.createElement('h2');
      h.textContent = `${heading.querySelector('h2').textContent} (continued)`;
      row.append(h);
      part.append(row);
    } else part.append(heading.cloneNode(true));
    const blocks = document.createElement('div');
    blocks.className = 'section-blocks';
    part.append(blocks);
    return part;
  }
  function continuation(block) {
    const next = block.cloneNode(false);
    next.classList.toggle('selected', block.dataset.block === selectedBlock);
    const title = document.createElement('div');
    title.className = 'block-title-row continued-title';
    const label = document.createElement('h3');
    label.className = 'block-title';
    label.textContent = `${block.querySelector('.block-title')?.textContent || 'Block'} (continued)`;
    title.append(label);
    next.append(title);
    const list = document.createElement('ul');
    list.className = 'block-bullets';
    next.append(list);
    return next;
  }
  function readOnlyFragment(el) {
    for (const name of ['contenteditable', 'data-edit', 'role', 'aria-label', 'aria-multiline', 'tabindex']) el.removeAttribute(name);
    el.classList.remove('editable', 'is-empty');
    el.classList.add('readonly-fragment');
  }
  pageAt(0);
  for (const stream of streams) {
    let pageIndex = 0;
    for (const section of stream.sections) {
      const originalBlocks = [...section.querySelectorAll(':scope > .section-blocks > .resume-block')];
      const addBlock = section.querySelector(':scope > .section-blocks > .canvas-add-block');
      let part = fragment(section);
      columnAt(pageIndex, stream.name).append(part);
      if (!fits(part.querySelector('.section-heading-row'), pages[pageIndex])) {
        part.remove();
        part = fragment(section);
        columnAt(++pageIndex, stream.name).append(part);
      }
      for (const block of originalBlocks) {
        let piece = block;
        let attempts = 0;
        while (piece) {
          if (++attempts > 200) throw new Error('Could not paginate an oversized block.');
          part.querySelector('.section-blocks').append(piece);
          if (fits(piece, pages[pageIndex])) break;
          // A whole block can move if other content already occupies this column.
          if (part.querySelector('.section-blocks').children.length > 1 ||
              part.previousElementSibling || pageIndex === 0 && pages[0].querySelector('.resume-header')) {
            piece.remove();
            const hadBlocks = !!part.querySelector('.resume-block');
            if (!hadBlocks) part.remove();
            part = fragment(section, hadBlocks);
            columnAt(++pageIndex, stream.name).append(part);
            part.querySelector('.section-blocks').append(piece);
          }
          if (fits(piece, pages[pageIndex])) break;
          // Move trailing bullets first, then divide an oversized first bullet or paragraph.
          const list = piece.querySelector(':scope > .block-bullets');
          const moved = [];
          while (list?.children.length > 1 && !fits(piece, pages[pageIndex])) {
            const item = list.lastElementChild;
            item.remove();
            moved.unshift(item);
          }
          const loneBullet = list?.children.length === 1 ? list.firstElementChild.querySelector('.bullet-text') : null;
          if (loneBullet && !piece.querySelector(':scope > .block-paragraph')?.textContent) {
            const text = loneBullet.textContent;
            let low = 0, high = text.length;
            while (low < high) {
              const mid = Math.ceil((low + high) / 2);
              loneBullet.textContent = text.slice(0, mid);
              if (fits(piece, pages[pageIndex])) low = mid;
              else high = mid - 1;
            }
            if (low > 0 && low < text.length) {
              const wordEnd = text.lastIndexOf(' ', low);
              const cut = wordEnd > low - 80 ? Math.max(1, wordEnd) : low;
              loneBullet.textContent = text.slice(0, cut);
              readOnlyFragment(loneBullet);
              const next = continuation(piece);
              const li = list.firstElementChild.cloneNode(true);
              const suffix = li.querySelector('.bullet-text');
              suffix.textContent = text.slice(cut);
              readOnlyFragment(suffix);
              next.querySelector('.block-bullets').append(li, ...moved);
              part = fragment(section, true);
              columnAt(++pageIndex, stream.name).append(part);
              piece = next;
              continue;
            }
            loneBullet.textContent = text;
          }
          while (list?.children.length && !fits(piece, pages[pageIndex])) {
            const item = list.lastElementChild;
            item.remove();
            moved.unshift(item);
          }
          const paragraph = piece.querySelector(':scope > .block-paragraph');
          const text = paragraph?.textContent || '';
          let remainder = '';
          if (!fits(piece, pages[pageIndex]) && text.length > 1) {
            let low = 0, high = text.length;
            while (low < high) {
              const mid = Math.ceil((low + high) / 2);
              paragraph.textContent = text.slice(0, mid);
              if (fits(piece, pages[pageIndex])) low = mid;
              else high = mid - 1;
            }
            const wordEnd = text.lastIndexOf(' ', low);
            const cut = wordEnd > low - 80 ? Math.max(1, wordEnd) : Math.max(1, low);
            paragraph.textContent = text.slice(0, cut);
            remainder = text.slice(cut);
            readOnlyFragment(paragraph);
          }
          if (!moved.length && !remainder) break;
          const next = continuation(piece);
          if (remainder) {
            const p = paragraph.cloneNode(false);
            p.textContent = remainder;
            readOnlyFragment(p);
            next.insertBefore(p, next.querySelector('.block-bullets'));
          }
          next.querySelector('.block-bullets').append(...moved);
          part = fragment(section, true);
          columnAt(++pageIndex, stream.name).append(part);
          piece = next;
        }
      }
      if (addBlock) part.querySelector('.section-blocks').append(addBlock);
    }
    if (stream.add) columnAt(pageIndex, stream.name).append(stream.add);
  }
  root.classList.remove('pagination-measuring');
  return pages.length;
}
