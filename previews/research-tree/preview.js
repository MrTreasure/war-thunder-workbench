(() => {
  const viewport = document.getElementById('tree-viewport');
  const canvas = document.getElementById('tree-canvas');
  const frame = document.getElementById('scale-frame');
  const output = document.getElementById('zoom-value');
  const note = document.getElementById('selection-note');
  let view = 'early', scale = 1, fit = true;
  const current = () => document.querySelector(`[data-tree-view="${view}"]`);
  function resize() {
    if (fit) scale = Math.min(1.22, Math.max(.58, (viewport.clientWidth - 12) / 2048));
    canvas.style.transform = `scale(${scale})`;
    frame.style.width = `${2048 * scale}px`;
    frame.style.height = `${Number(current().dataset.height) * scale}px`;
    output.value = `${Math.round(scale * 100)}%`;
    document.querySelector('[data-zoom="out"]').disabled = scale <= .58;
    document.querySelector('[data-zoom="in"]').disabled = scale >= 1.4;
  }
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    view = button.dataset.view;
    document.querySelectorAll('[data-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    document.querySelectorAll('[data-tree-view]').forEach(item => item.hidden = item.dataset.treeView !== view);
    document.querySelectorAll('.wt-group-list').forEach(item => item.hidden = true);
    document.querySelectorAll('.wt-group-toggle').forEach(item => item.setAttribute('aria-expanded', 'false'));
    viewport.scrollTo({top:0,left:0});resize();
  }));
  document.querySelectorAll('[data-zoom]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.zoom === 'fit') fit = true;
    else {fit = false;scale = Math.min(1.4, Math.max(.58, scale + (button.dataset.zoom === 'in' ? .1 : -.1)));}
    resize();
  }));
  document.querySelectorAll('.wt-unit-card').forEach(button => button.addEventListener('click', () => {
    const owned = !button.classList.contains('is-owned');
    document.querySelectorAll('.wt-unit-card').forEach(item => {
      if(item.dataset.unit !== button.dataset.unit)return;
      item.classList.toggle('is-owned',owned);item.setAttribute('aria-pressed',String(owned));
    });
    document.querySelectorAll('.wt-arrow').forEach(item => {if(item.dataset.from===button.dataset.unit)item.classList.toggle('is-owned',owned);});
    note.textContent = `${button.dataset.name} · ${owned?'已拥有':'未拥有'}（预览状态） · ${button.dataset.cost}`;
  }));
  document.querySelectorAll('.wt-group-toggle').forEach(button => button.addEventListener('click', () => {
    const list = document.getElementById(button.getAttribute('aria-controls'));
    list.hidden = !list.hidden;button.setAttribute('aria-expanded',String(!list.hidden));
  }));
  document.addEventListener('keydown',event => {
    if(event.key!=='Escape')return;
    document.querySelectorAll('.wt-group-list').forEach(item=>item.hidden=true);
    document.querySelectorAll('.wt-group-toggle').forEach(item=>item.setAttribute('aria-expanded','false'));
  });
  new ResizeObserver(resize).observe(viewport);resize();
})();
