// ════════════════════════════════════════════════════════════════
// Project Page — dynamic showcase, lightbox, scroll-reveal
// ════════════════════════════════════════════════════════════════

const TEASER_DRIVE_ID = "1CPJlqXsJ7f2c3dvMR1xy4j9eiNKNZuRY";
const TEASER_KEYFRAMES = [
  "assets/Golden/keyframes/frame_000045.jpg",
  "assets/Golden/keyframes/frame_000105.jpg",
  "assets/Golden/keyframes/frame_000110.jpg",
  "assets/Golden/keyframes/frame_000115.jpg",
  "assets/Golden/keyframes/frame_000125.jpg",
  "assets/Golden/keyframes/frame_000130.jpg",
  "assets/Golden/keyframes/frame_000135.jpg",
  "assets/Golden/keyframes/frame_000245.jpg",
  "assets/Golden/keyframes/frame_000250.jpg"
];
const KEYFRAME_THUMB_LIMIT = 9;          // show first N keyframes per film

document.addEventListener("DOMContentLoaded", async () => {
  setupTeaser();
  setupTeaserKeyframes();
  setupLightbox();
  await loadShowcase();
  setupChartAnimation();
  setupReveal();
});

// ── Teaser ──────────────────────────────────────────────────────
function setupTeaser() {
  const iframe = document.getElementById("teaser-iframe");
  if (iframe) iframe.src = `https://drive.google.com/file/d/${TEASER_DRIVE_ID}/preview`;
}

// ── Teaser Keyframes (Fallback grid) ───────────────────────────
function setupTeaserKeyframes() {
  const grid = document.getElementById("teaser-keyframes");
  if (!grid) return;
  
  // Populate teaser with curated keyframes
  const html = TEASER_KEYFRAMES.map((kf, i) => `
    <img src="${kf}" alt="kf${i+1}" loading="lazy" data-zoom="${kf}" 
         onerror="this.style.display='none'">
  `).join("");
  
  grid.innerHTML = html;
}

// ── Showcase ────────────────────────────────────────────────────
async function loadShowcase() {
  const grid = document.getElementById("showcase-grid");
  if (!grid) return;

  let data;
  try {
    const resp = await fetch("assets/films.json");
    data = await resp.json();
  } catch (e) {
    grid.innerHTML = `<div class="placeholder">Failed to load <code>assets/films.json</code>. Run <code>scripts/build_project_page_assets.py</code> first.</div>`;
    return;
  }

  const films = data.films || [];
  if (!films.length) {
    grid.innerHTML = `<div class="placeholder">No films found.</div>`;
    return;
  }

  // Interactive showcase: a film selector + a single detail panel.
  grid.innerHTML = `
    <div class="showcase-selector" id="showcase-selector" role="tablist"></div>
    <div class="showcase-panel" id="showcase-panel"></div>
  `;
  const selector = document.getElementById("showcase-selector");
  const panel = document.getElementById("showcase-panel");

  let current = -1;
  const selectFilm = (i) => {
    if (i === current) return;
    current = i;
    Array.from(selector.children).forEach((chip, idx) =>
      chip.classList.toggle("active", idx === i));
    panel.innerHTML = "";
    panel.appendChild(renderFilmCard(films[i]));
  };

  films.forEach((f, i) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "sel-chip";
    chip.setAttribute("role", "tab");
    chip.innerHTML = `
      <img class="sel-thumb" src="${f.mask}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <span class="sel-meta">
        <span class="sel-idx">#${String(f.idx).padStart(2, '0')}</span>
        <span class="sel-name">${escapeHtml(niceName(f))}</span>
      </span>`;
    chip.addEventListener("click", () => selectFilm(i));
    selector.appendChild(chip);
  });

  selectFilm(0);
}

function niceName(f) {
  return String(f.name || "").replace(/_/g, " ").trim() || `Film ${f.idx}`;
}

function renderFilmCard(f) {
  const card = document.createElement("article");
  card.className = "film-card";

  // Limit keyframes shown for compact layout (link "+ N more" if extra)
  const allKfs = f.keyframes || [];
  const shownKfs = allKfs.slice(0, KEYFRAME_THUMB_LIMIT);
  const extra = allKfs.length - shownKfs.length;

  const kfHtml = shownKfs.map(
    (kf, i) => `
      <div class="kf-item" style="animation: fadeUp 0.5s ease ${0.05 * i}s both;">
        <span class="kf-no">#${i + 1}</span>
        <img src="${kf}" alt="keyframe ${i + 1}" loading="lazy" data-zoom="${kf}">
      </div>`
  ).join("");

  const extraHtml = extra > 0
    ? `<div class="kf-item kf-more">+${extra}</div>`
    : "";

  card.innerHTML = `
    <div class="film-header">
      <span class="film-idx">#${String(f.idx).padStart(2, '0')}</span>
      <span class="film-title">${escapeHtml(f.title)}</span>
      <span class="film-meta">${f.segment ? `Segment: ${escapeHtml(f.segment)} · ` : ""}${f.n_keyframes} keyframes</span>
    </div>

    <div class="film-grid">
      <!-- ── Input column ─────────────────────────── -->
      <div class="col-input">
        <div class="stage-label"><span class="dot"></span> Input</div>

        <div class="input-block">
          <div class="sub-label">Source video</div>
          <div class="input-video">
            <iframe src="${f.drive_preview}" allow="autoplay" allowfullscreen></iframe>
          </div>
        </div>

        <div class="input-block">
          <div class="sub-label">Target silhouette</div>
          <div class="input-mask">
            <img src="${f.mask}" alt="silhouette" loading="lazy" data-zoom="${f.mask}">
          </div>
        </div>
      </div>

      <!-- ── Keyframes column ─────────────────────── -->
      <div class="col-keyframes">
        <div class="kf-flow">
          <span class="kf-tag">Stage 1 · Keyframe Selection</span>
          <span class="kf-arrow"></span>
          <span class="kf-tag" style="background:rgba(var(--accent-rgb),0.14);color:var(--accent);">→ Layout</span>
        </div>
        <div class="kf-grid">
          ${kfHtml}${extraHtml}
        </div>
        <div class="kf-config">
          <span class="cfg-label">Config</span>
          <span class="cfg-chip">budget_ratio <b>0.2</b></span>
          <span class="cfg-chip">stride <b>5</b></span>
          <span class="cfg-chip">scene_threshold <b>0.9</b> <em>(TransNetv2)</em></span>
        </div>
      </div>

      <!-- ── Collage column ───────────────────────── -->
      <div class="col-collage">
        <div class="stage-label" style="align-self:flex-start;">
          <span class="dot"></span> Stage 2 · Final Collage
        </div>
        <img src="${f.collage}" alt="collage" loading="lazy" data-zoom="${f.collage}">
      </div>
    </div>
  `;
  return card;
}

// ── Scroll reveal (IntersectionObserver) ────────────────────────
function setupReveal() {
  const targets = document.querySelectorAll(
    ".reveal, .step, .film-card, .compare-cell, .metrics-wrap, " +
    ".flagship-figure, .method-figure, .layout-novelty-figure, " +
    ".ablation-figure, .user-study-figure"
  );
  targets.forEach((el) => el.classList.add("reveal"));

  if (!("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });

  targets.forEach((el) => io.observe(el));
}

// ── User study chart animation ──────────────────────────────────
function setupChartAnimation() {
  const figure = document.querySelector(".user-study-figure");
  const bars = Array.from(document.querySelectorAll(".bar"));
  if (!figure || !bars.length) return;

  bars.forEach((bar) => {
    bar.dataset.targetHeight = bar.style.height || "0%";
    bar.style.height = "0%";
  });

  const animate = () => {
    bars.forEach((bar, idx) => {
      setTimeout(() => {
        bar.style.height = bar.dataset.targetHeight || "0%";
      }, idx * 70);
    });
  };

  if (!("IntersectionObserver" in window)) {
    animate();
    return;
  }

  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      animate();
      io.disconnect();
    }
  }, { threshold: 0.25 });

  io.observe(figure);
}

// ── Lightbox ────────────────────────────────────────────────────
function setupLightbox() {
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lightbox-img");
  const closeBtn = document.querySelector(".lightbox-close");
  if (!lb) return;

  document.body.addEventListener("click", (e) => {
    const target = e.target;
    if (target.tagName === "IMG" && target.dataset.zoom) {
      lbImg.src = target.dataset.zoom;
      lb.hidden = false;
    }
  });

  const close = () => { lb.hidden = true; lbImg.src = ""; };
  lb.addEventListener("click", close);
  closeBtn?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
}

// ── Utils ───────────────────────────────────────────────────────
function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
