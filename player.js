/* ==========================================================================
   Hood 2 Hood Rydas | player.js : the "Alien Skin" bar under the header.
   - Scrolls the artist, song, album and streaming links continuously
     (pauses on hover/focus, and with the pause button; still for reduced motion).
   - Plays alien-skin.mp3 ONCE per visit. Browsers block sound until a visitor
     interacts, so if autoplay is blocked it starts on their first tap or key.
     Moving between pages picks the song back up where it left off.
   - The Play/Pause button is always visible (needed for accessibility).
   ========================================================================== */
(function () {
  "use strict";
  var C = window.H2H || {}, S = C.anthem;
  var bar = document.querySelector("[data-anthem]");
  if (!bar || !S) return;
  var $ = function (s) { return bar.querySelector(s); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var KEY = "h2h-anthem";
  function load() { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(st) { try { sessionStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  var st = load();

  /* ---------- the scrolling text ---------- */
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var links = (S.links || []).filter(function (l) { return /^https:\/\/[^\s<>"]+$/.test(l.url || ""); });
  function group(hidden) {
    var t = hidden ? ' tabindex="-1"' : "";
    return '<span class="tk-group"' + (hidden ? ' aria-hidden="true"' : "") + ">" +
      '<span class="tk-item"><b class="tk-label">Now playing</b><span class="tk-artist">' + esc(S.artist) + '</span><span class="tk-sep" aria-hidden="true">—</span>' +
      '<span class="tk-song">“' + esc(S.title) + '”</span><span class="tk-sep" aria-hidden="true">·</span><span class="tk-album">from the album <em>' + esc(S.album) + "</em></span></span>" +
      '<span class="tk-item tk-links"><span class="tk-listen">Listen on</span>' +
      links.map(function (l) {
        var k = l.label.toLowerCase().replace(/[^a-z]/g, "");
        return '<a class="tk-link tk-' + k + '" href="' + esc(l.url) + '" target="_blank" rel="noopener"' + t + ">" + esc(l.label) + '<span class="sr-only"> (opens in a new tab)</span></a>';
      }).join("") + "</span>" +
      '<span class="tk-item tk-ride">The anthem of <strong>MelTee</strong>’s Alien Skin wrap</span></span>';
  }
  var track = $("[data-tk-track]");
  track.innerHTML = group(false) + group(true);
  var cover = $("[data-tk-cover]");
  if (cover && /^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/.test(S.cover || "")) { cover.src = "./" + S.cover; cover.hidden = false; }

  var scrollBtn = $("[data-tk-scroll]");
  function setScroll(on) {
    bar.classList.toggle("tk-paused", !on);
    scrollBtn.setAttribute("aria-pressed", on ? "false" : "true");
    scrollBtn.setAttribute("aria-label", on ? "Pause scrolling text" : "Resume scrolling text");
    scrollBtn.querySelector("svg").innerHTML = on ? '<path d="M9 6v12M15 6v12"/>' : '<path d="M8 5v14l11-7z"/>';
  }
  if (reduce) { bar.classList.add("tk-still"); scrollBtn.hidden = true; }
  else { setScroll(!st.stillText); scrollBtn.addEventListener("click", function () { var on = bar.classList.contains("tk-paused"); setScroll(on); st.stillText = !on; save(st); }); }

  /* ---------- the song ---------- */
  var btn = $("[data-tk-play]"), audio = null, haveFile = false, waiting = false;
  var ICON_PLAY = '<path d="M8 5v14l11-7z"/>', ICON_PAUSE = '<path d="M8 5v14M16 5v14"/>';
  function ui(playing) {
    btn.setAttribute("aria-pressed", playing ? "true" : "false");
    btn.setAttribute("aria-label", (playing ? "Pause " : "Play ") + "“" + S.title + "” by " + S.artist);
    btn.querySelector("svg").innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    bar.classList.toggle("tk-playing", !!playing);
  }
  ui(false);
  var yt = links.filter(function (l) { return /youtu/.test(l.url); })[0];
  var file = /^[A-Za-z0-9._-]+\.(mp3|m4a|ogg|wav)$/i.test(S.file || "") ? "./" + S.file : "";

  function stopWaiting() { waiting = false; ["pointerdown", "keydown"].forEach(function (t) { document.removeEventListener(t, firstTouch, true); }); }
  function firstTouch(e) {
    if (e.target.closest && e.target.closest("[data-anthem]")) return;   // the bar's own buttons handle themselves
    if (e.type === "keydown" && (e.key === "Tab" || e.key === "Shift" || e.key === "Escape")) return;
    stopWaiting(); start();
  }
  function start() {
    if (!audio) return;
    var p = audio.play();
    if (p && p.catch) p.catch(function () {
      if (!waiting) { waiting = true; ["pointerdown", "keydown"].forEach(function (t) { document.addEventListener(t, firstTouch, true); }); }
    });
  }
  function setup() {
    audio = new Audio(file); audio.preload = "auto"; audio.volume = 0.6;
    audio.addEventListener("loadedmetadata", function () { if (st.pos && st.pos < audio.duration - 1) audio.currentTime = st.pos; });
    audio.addEventListener("play", function () { ui(true); stopWaiting(); });
    audio.addEventListener("pause", function () { ui(false); });
    audio.addEventListener("ended", function () { st.done = true; st.pos = 0; save(st); ui(false); });
    addEventListener("pagehide", function () { if (audio && !audio.paused) { st.pos = audio.currentTime; save(st); } });
    if (C.anthem.autoplayOnce !== false && !st.done && !st.userPaused) start();
  }
  btn.addEventListener("click", function () {
    if (!haveFile) { if (yt) window.open(yt.url, "_blank", "noopener"); return; }
    stopWaiting();
    if (audio.paused) {
      if (audio.ended || st.done) { audio.currentTime = 0; }
      st.userPaused = false; save(st); audio.play();
    } else { audio.pause(); st.userPaused = true; st.pos = audio.currentTime; save(st); }
  });
  if (!file) return;
  // Only use the song if it's actually been uploaded; otherwise the button opens YouTube.
  fetch(file, { method: "HEAD", cache: "no-store" }).then(function (r) {
    var type = r.headers.get("content-type") || "";
    if (r.ok && /audio|octet-stream|mpeg/i.test(type)) { haveFile = true; bar.classList.add("tk-has-audio"); setup(); }
  }).catch(function () {});
})();
