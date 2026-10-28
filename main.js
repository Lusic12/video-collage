'use strict';

const VIEW_NAMES = { collage: 'Story', comparison: 'Compare methods' };
const PAPER_TITLE = 'A2V-Collage: Chronology-Preserving Anime Video-to-Collage Generation';
// Links already printed in the paper use this view name.
const VIEW_ALIASES = { keyframes: 'collage' };
let results = [];
const METHOD_LABELS = { ours: 'A2V-Collage (ours)', iscp: 'ISCP', colla: 'Colla', sc: 'SC + Mask' };
let current = { id: 'your-name', view: 'collage' };
let toastTimer;
let imageOpener;
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');

function parseRoute(hash, items = results) {
  const fallback = { id: items[0]?.id || 'your-name', view: 'collage', invalid: false };
  if (hash === '#comparison') return { ...fallback, view: 'comparison' };
  if (!hash.startsWith('#results/')) return fallback;
  const parts = hash.slice(1).split('/');
  const id = parts[1];
  const view = VIEW_ALIASES[parts[2]] || parts[2] || 'collage';
  return {
    id: items.some((item) => item.id === id) ? id : fallback.id,
    view: Object.hasOwn(VIEW_NAMES, view) ? view : 'collage',
    invalid: !items.some((item) => item.id === id) || !Object.hasOwn(VIEW_NAMES, view) || parts.length > 3,
  };
}

function resultHash(id, view) { return `#results/${id}/${view}`; }
function withRefs(text) {
  return escapeHtml(text).replace(/\((\d{2}(?:[–,] ?\d{2})*)\)/g, '<span class="ref">$1</span>');
}
function wordCount(text) { return text.replace(/\s*\([\d–, ]+\)/g, '').trim().split(/\s+/).length; }

function imageButton(src, caption, attrs = '') {
  return `<button class="image-button" type="button" data-zoom="${escapeHtml(src)}" data-caption="${escapeHtml(caption)}" aria-label="Enlarge ${escapeHtml(caption)}"><img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}" ${attrs}></button>`;
}

function frameGrid(item, frames) {
  return `<div class="frame-grid">${frames.map((frame) => `<figure class="frame-item">
    ${imageButton(frame.src, `${item.title} — keyframe ${frame.order}, source frame ${frame.frame}`, 'loading="lazy" decoding="async"')}
    <figcaption><b>${pad(frame.order)}</b><span class="frame-id">f. ${String(frame.frame).padStart(6, '0')}</span></figcaption>
  </figure>`).join('')}</div>`;
}

function inputVideoPanel(item) {
  if (!item.inputVideo) return '';
  const url = `https://drive.google.com/file/d/${encodeURIComponent(item.inputVideo)}/view`;
  return `<section class="input-video-panel" aria-label="${escapeHtml(item.title)} input video">
    <div class="panel-label"><span>Input video</span><a href="${url}" target="_blank" rel="noopener noreferrer">Open on Google Drive ↗</a></div>
    <div class="video-stage"><button class="video-poster" type="button" data-video-case="${escapeHtml(item.id)}" aria-label="Play ${escapeHtml(item.title)} input video"><img src="${escapeHtml(item.keyframes[0].src)}" alt="" loading="lazy" decoding="async"><span>▶ Play input video</span></button>
    <iframe class="input-video-frame" title="${escapeHtml(item.title)} — input video" allow="autoplay; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" hidden></iframe></div>
    <button class="close-input-video" type="button" data-close-video hidden>Close video ×</button>
  </section>`;
}

function collageFigure(item, method = 'ours') {
  const ours = method === 'ours';
  const name = ours ? 'A2V-Collage' : 'SC + Mask';
  return `<figure class="collage-figure">
    <div class="panel-label"><span class="${current.view === 'comparison' ? 'method-name' : ''}">${ours ? (current.view === 'comparison' ? 'A2V-Collage · Ours' : 'The story collage') : name}</span><span>${ours ? 'Final output' : 'Baseline output'}</span></div>
    <div class="collage-stage">${imageButton(item.outputs[method], `${item.title} — ${name} output`, 'decoding="async" fetchpriority="high"')}<span class="expand-hint">View full size ↗</span></div>
    <figcaption>${ours ? 'Selected moments, composed in one image.' : 'Same keyframes and target silhouette.'}</figcaption>
  </figure>`;
}

function storyView(item) {
  return `<div class="story-layout"><div class="story-source">
    ${inputVideoPanel(item)}
    <div class="panel-label"><span>The moments</span><span>${item.keyframes.length} keyframes, in source order</span></div>
    ${frameGrid(item, item.keyframes)}<div class="frame-endpoints"><span>Earlier</span><span>Later →</span></div>
    <div class="story-words"><div class="panel-label"><span>In words</span><span>${wordCount(item.story)} words</span></div><p>${withRefs(item.story)}</p></div>
    <p class="story-look"><b>Look for</b>${withRefs(item.look)}</p>
  </div>${collageFigure(item)}</div>`;
}

function comparisonView(item) {
  const availableMethods = item.comparison ? ['ours','iscp','colla','sc'] : ['ours','sc'];
  const compareImages = availableMethods.map((method) => comparisonFigure(item, method)).join('');
  return `${inputVideoPanel(item)}<p class="comparison-note">${item.comparison ? 'Four methods, on the same keyframes and target shape.' : 'The current paper result for this example includes two methods.'}</p>
    <div class="comparison-grid ${item.comparison ? 'has-four' : 'has-two'}">${compareImages}</div>
    <div class="comparison-frames"><div class="panel-label"><span>Keyframes for reference</span><span>${item.keyframes.length} keyframes, in source order</span></div>${frameGrid(item, item.keyframes)}
    <button class="inline-action" type="button" data-view="collage">Read the story of this result ↗</button></div>`;
}

function comparisonFigure(item, method) {
  const labels = METHOD_LABELS;
  const src = method === 'ours' || method === 'sc' ? item.outputs[method] : item.comparison[method];
  return `<figure class="collage-figure comparison-method">
    <div class="panel-label"><span class="method-name">${labels[method]}</span></div>
    <div class="collage-stage">${imageButton(src, `${item.title} — ${labels[method]}`, 'loading="lazy" decoding="async"')}<span class="expand-hint">View full size ↗</span></div>
    <figcaption><span>${labels[method]}</span><a href="${escapeHtml(src)}" target="_blank" rel="noopener noreferrer">Original ↗</a></figcaption>
  </figure>`;
}

function moreExample(item) {
  const frames = item.keyframes.length ? `<div class="more-frames"><div class="panel-label"><span>Selected keyframes</span><span>${item.keyframes.length} keyframes, in source order</span></div>
    <ol>${item.keyframes.map((frame) => `<li><button class="image-button" type="button" data-zoom="${escapeHtml(frame.src)}" data-caption="${escapeHtml(item.title)} — keyframe ${frame.order}" aria-label="Enlarge keyframe ${frame.order}"><img src="${escapeHtml(frame.thumb)}" alt="" loading="lazy" decoding="async"></button><span>${pad(frame.order)}</span></li>`).join('')}</ol></div>` : '';
  return `<article class="more-item" id="more-${escapeHtml(item.id)}"><h3>${escapeHtml(item.title)}</h3>${frames}
    <div class="more-methods">${Object.keys(METHOD_LABELS).map((method) => `<figure>
      <button class="image-button" type="button" data-zoom="${escapeHtml(item.outputs[method].src)}" data-caption="${escapeHtml(item.title)} — ${METHOD_LABELS[method]}" aria-label="Enlarge ${escapeHtml(item.title)}, ${METHOD_LABELS[method]}"><img src="${escapeHtml(item.outputs[method].view)}" alt="${escapeHtml(item.title)} — ${METHOD_LABELS[method]} output" loading="lazy" decoding="async"></button>
      <figcaption class="${method === 'ours' ? 'method-name' : ''}">${METHOD_LABELS[method]}</figcaption></figure>`).join('')}</div></article>`;
}

function render() {
  const item = results.find((r) => r.id === current.id);
  if (!item) return;
  const index = results.indexOf(item);
  document.querySelectorAll('[data-case]').forEach((button) => {
    const active = button.dataset.case === item.id;
    button.setAttribute('aria-pressed', String(active));
    if (active) {
      const strip = $('example-strip');
      strip.scrollLeft = button.offsetLeft - (strip.clientWidth - button.offsetWidth) / 2;
    }
  });
  document.querySelectorAll('[data-tab]').forEach((tab) => {
    const active = tab.dataset.tab === current.view;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  $('result-panel').setAttribute('aria-labelledby', `tab-${current.view}`);
  $('result-panel').innerHTML = `<div class="case-header"><div class="case-title"><span class="case-index" aria-label="Example ${index + 1} of ${results.length}"><b>${pad(index + 1)}</b><i>of ${pad(results.length)}</i></span><div><h3>${escapeHtml(item.title)}</h3><p class="case-meta">${escapeHtml(item.category)} &nbsp; · &nbsp; ${item.keyframes.length} keyframes</p></div></div><div class="case-tools"><a class="original-link result-action" href="${escapeHtml(item.outputs.ours)}" target="_blank" rel="noopener noreferrer">Open original <span aria-hidden="true">↗</span></a></div></div>
    ${{ collage: storyView, comparison: comparisonView }[current.view](item)}`;
  $('result-position').textContent = `${pad(index + 1)} / ${pad(results.length)} examples`;
  $('route-notice').hidden = !current.invalid;
  $('route-notice').textContent = current.invalid ? 'This result link could not be matched exactly. Choose an example or a view below.' : '';
  document.title = `${item.title} · ${VIEW_NAMES[current.view]} | ${PAPER_TITLE}`;
}

function navigate(id, view, scroll = false) {
  current = { id, view, invalid: false };
  const hash = resultHash(id, view);
  if (location.hash !== hash) history.pushState(null, '', hash);
  render();
  if (scroll) scrollToResults();
}

function scrollToResults(instant = false) {
  $('results').scrollIntoView({ behavior: instant || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}

function onLocationChange() {
  if (!results.length) return;
  if (location.hash.startsWith('#results/') || ['#comparison', '#gallery', '#results', ''].includes(location.hash)) {
    current = parseRoute(location.hash);
    render();
    if (location.hash) scrollToResults();
  }
}

async function loadResults() {
  $('result-panel').setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('assets/results.json?v=20261028-hide-umaru');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.results) || !data.results.length) throw new Error('Empty result collection');
    results = data.results;
    $('copy-result-link').disabled = false;
    $('example-strip').innerHTML = results.map((item) => `<button type="button" class="example-thumb" data-case="${escapeHtml(item.id)}" aria-pressed="false"><img src="${escapeHtml(item.thumb)}" alt="" loading="lazy" decoding="async"><span>${escapeHtml(item.title)}</span></button>`).join('');
    $('more-list').innerHTML = (data.more || []).map(moreExample).join('');
    current = parseRoute(location.hash);
    render();
    // A link from the paper lands here: jump straight to the result it names.
    if (location.hash.startsWith('#results/') || location.hash === '#comparison' || location.hash === '#gallery') scrollToResults(true);
  } catch (error) {
    $('result-panel').innerHTML = '<div class="load-error"><p>The visual results could not be loaded. Please try again.</p><button class="button" type="button" id="retry-results">Reload results</button></div>';
    $('retry-results').addEventListener('click', loadResults);
  } finally {
    $('result-panel').setAttribute('aria-busy', 'false');
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2400);
}

async function copyText(text, title) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${title} copied`);
  } catch (_) {
    $('copy-title').textContent = `Copy ${title.toLowerCase()}`;
    $('copy-text').value = text;
    $('copy-dialog').showModal();
    $('copy-text').focus();
    $('copy-text').select();
  }
}

function openImage(button) {
  imageOpener = button;
  $('dialog-image').src = button.dataset.zoom;
  $('dialog-image').alt = button.dataset.caption;
  $('image-caption').textContent = button.dataset.caption;
  $('original-image').href = button.dataset.zoom;
  $('image-viewport').classList.remove('actual-size');
  $('zoom-size').textContent = 'Actual size';
  $('image-dialog').showModal();
  $('close-dialog').focus();
}

function openVideo(button) {
  const item = results.find((result) => result.id === button.dataset.videoCase);
  if (!item?.inputVideo) return;
  const panel = button.closest('.input-video-panel');
  const frame = panel.querySelector('.input-video-frame');
  frame.src = `https://drive.google.com/file/d/${encodeURIComponent(item.inputVideo)}/preview`;
  frame.hidden = false;
  button.hidden = true;
  panel.querySelector('.close-input-video').hidden = false;
}

function closeVideo(button) {
  const panel = button.closest('.input-video-panel');
  const frame = panel.querySelector('.input-video-frame');
  frame.removeAttribute('src');
  frame.hidden = true;
  panel.querySelector('.video-poster').hidden = false;
  button.hidden = true;
  panel.querySelector('.video-poster').focus();
}

function init() {
  document.querySelector('.tabs').addEventListener('keydown', (event) => {
    const tabs = [...document.querySelectorAll('[data-tab]')];
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    tabs[next].focus();
    if (results.length) navigate(current.id, tabs[next].dataset.tab);
  });
  document.addEventListener('click', (event) => {
    const image = event.target.closest('[data-zoom]');
    if (image) { openImage(image); return; }
    const video = event.target.closest('[data-video-case]');
    if (video) { openVideo(video); return; }
    const close = event.target.closest('[data-close-video]');
    if (close) { closeVideo(close); return; }
    const tab = event.target.closest('[data-tab], [data-view]');
    if (tab && results.length) { navigate(current.id, tab.dataset.tab || tab.dataset.view); return; }
    const example = event.target.closest('[data-case]');
    if (example) { navigate(example.dataset.case, current.view); return; }
    const deepLink = event.target.closest('a[href^="#results/"]');
    if (deepLink && results.length) {
      event.preventDefault();
      const route = parseRoute(deepLink.hash);
      navigate(route.id, route.view, true);
    }
  });
  $('copy-result-link').addEventListener('click', () => {
    const url = new URL(location.href);
    url.hash = resultHash(current.id, current.view);
    copyText(url.href, 'Result link');
  });
  $('close-dialog').addEventListener('click', () => $('image-dialog').close());
  $('zoom-size').addEventListener('click', () => {
    const actual = $('image-viewport').classList.toggle('actual-size');
    $('zoom-size').textContent = actual ? 'Fit to screen' : 'Actual size';
  });
  $('image-dialog').addEventListener('click', (event) => {
    if (event.target !== $('image-dialog')) return;
    const rect = $('image-dialog').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('image-dialog').close();
  });
  $('image-dialog').addEventListener('close', () => {
    $('dialog-image').removeAttribute('src');
    if (imageOpener?.isConnected) imageOpener.focus({ preventScroll: true });
  });
  window.addEventListener('hashchange', onLocationChange);
  window.addEventListener('popstate', onLocationChange);
  loadResults();
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
if (typeof module !== 'undefined') module.exports = { parseRoute, resultHash, withRefs, wordCount, inputVideoPanel };
