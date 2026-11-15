/* ==========================================================================
   Hood 2 Hood Rydas | showroom.js : the Showroom page.
   1) Glass doors open onto the showroom floor.
   2) Cars sit in lit bays you can swipe through (arrows, dots, keys, swipe).
   3) "Open the build" turns the car's photos into a 3D ring (or a film
      slideshow) with a spec sheet, the car's anthem and its clip.
   Cars come from the database (Admin > Showroom) plus any built into data.js.
   ========================================================================== */
(function () {
  "use strict";
  var A = window.HAPI, C = window.H2H || {};
  if (!A) return;
  var esc = A.esc, $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var room = $("[data-showroom]"); if (!room) return;
  var ICON_L = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 6l-6 6 6 6"/></svg>';
  var PLAY = '<path d="M8 5v14l11-7z"/>', PAUSE = '<path d="M8 5v14M16 5v14"/>';

  /* ---------------- data ---------------- */
  function hex(c) { return /^#[0-9a-f]{6}$/i.test(c || "") ? c : "#39f3ff"; }
  function norm(c, builtIn) {
    var photos = (c.photos || []).map(function (p) {
      return { url: A.imgSrc(p), small: builtIn ? A.imgSrc(p, true) : A.imgSrc(p), caption: p.caption || "", path: p.path || "" };
    }).filter(function (p) { return p.url; });
    if (c.cover && !builtIn) {   // cover first
      var i = photos.map(function (p) { return p.path; }).indexOf(c.cover);
      if (i > 0) photos.unshift(photos.splice(i, 1)[0]);
    }
    var specs = Array.isArray(c.specs) ? c.specs.filter(function (s) { return s && s.label && s.value; }) : [];
    return {
      name: String(c.name || "").trim(), year: c.year || "", make: c.make || "", model: c.model || "", wrap: c.wrap_name || "",
      owner: c.owner_name || "", tagline: c.tagline || "", story: c.story || "", specs: specs,
      anthem: A.youtubeId(c.anthem_url), accent: hex(c.accent), mode: c.mode === "film" ? "film" : "ring",
      speed: Math.min(15, Math.max(2, +c.speed || 5)), photos: photos,
      clip: builtIn && c.clip && /^[A-Za-z0-9._-]+\.mp4$/.test(c.clip.src || "") ? c.clip : null
    };
  }
  var BUILT = (C.builtInCars || []).map(function (c) { return norm(c, true); }).filter(function (c) { return c.name && c.photos.length; });
  var CARS = BUILT.slice(), cur = 0;
  function merge(db) {
    var list = (db || []).map(function (c) { return norm(c, false); }).filter(function (c) { return c.name; });
    var names = list.map(function (c) { return c.name.toLowerCase(); });
    return list.concat(BUILT.filter(function (b) { return names.indexOf(b.name.toLowerCase()) < 0; }));
  }
  function metaLine(c) { return [c.year, [c.make, c.model].filter(Boolean).join(" "), c.wrap].filter(Boolean).join(" · "); }

  /* ---------------- doors ---------------- */
  var stage = $("[data-stage]");
  function enter(instant) {
    room.classList.add("open");
    try { sessionStorage.setItem("h2h-entered", "1"); } catch (e) {}
    setTimeout(function () { room.classList.add("gone"); }, instant || reduce ? 0 : 1500);
    if (!instant) setTimeout(function () { var b = $("[data-open-build]"); if (b) b.focus({ preventScroll: true }); }, reduce ? 0 : 900);
  }
  $("[data-enter]").addEventListener("click", function () { enter(false); });
  var seen = false; try { seen = sessionStorage.getItem("h2h-entered") === "1"; } catch (e) {}
  var deep = (/[?&]car=([^&#]+)/.exec(location.search) || [])[1];
  if (seen || deep) enter(true);

  /* ---------------- floor ---------------- */
  var bays = $("[data-bays]"), dots = $("[data-dots]");
  function drawFloor() {
    var html = CARS.map(function (c, i) {
      var cov = c.photos[0];
      return '<button type="button" class="bay" data-bay="' + i + '" aria-label="' + esc("Bay " + ("0" + (i + 1)).slice(-2) + ": " + c.name + (metaLine(c) ? ", " + metaLine(c) : "")) + '">' +
        '<span class="bay-label">Bay ' + ("0" + (i + 1)).slice(-2) + '</span><span class="turntable"></span><span class="ring"></span>' +
        '<span class="car"><img src="' + esc(cov.small) + '" ' + (cov.small !== cov.url ? 'srcset="' + esc(cov.small) + " 720w, " + esc(cov.url) + ' 1600w" sizes="(max-width: 760px) 84vw, 66vw" ' : "") +
        'alt="" decoding="async"></span></button>';
    }).join("");
    html += '<a class="bay reserved" data-bay="' + CARS.length + '" href="./contact.html" aria-label="' + "Bay " + ("0" + (CARS.length + 1)).slice(-2) + ' reserved for the next Ryda. Contact the club.">' +
      '<span class="bay-label">Bay ' + ("0" + (CARS.length + 1)).slice(-2) + '</span><span class="car"><span>RESERVED FOR<br>THE NEXT RYDA</span></span></a>';
    bays.innerHTML = html;
    dots.innerHTML = CARS.concat([null]).map(function (c, i) {
      return '<button type="button" data-dot="' + i + '" aria-label="' + esc(c ? c.name : "Open bay") + '"></button>';
    }).join("");
    if (cur > CARS.length) cur = 0;
    place();
  }
  function total() { return CARS.length + 1; }
  function place() {
    var list = $$(".bay", bays), mobile = innerWidth < 760;
    list.forEach(function (b, i) {
      var d = i - cur, ad = Math.abs(d);
      b.style.transform = "translate(-50%, -50%) translateX(" + d * (mobile ? 78 : 64) + "%) translateZ(" + (-ad * (mobile ? 260 : 420)) + "px) rotateY(" + (-d * (mobile ? 22 : 30)) + "deg)";
      b.style.opacity = ad > 2 ? 0 : 1 - ad * 0.38;
      b.style.filter = ad ? "brightness(.45) saturate(.8)" : "";
      b.style.zIndex = 10 - ad;
      b.style.pointerEvents = ad > 2 ? "none" : "";
      b.classList.toggle("active", !d);
      b.tabIndex = d ? -1 : 0;
      b.setAttribute("aria-hidden", ad > 1 ? "true" : "false");
    });
    $$("[data-dot]", dots).forEach(function (b, i) { b.setAttribute("aria-current", i === cur ? "true" : "false"); });
    var c = CARS[cur], open = $("[data-open-build]");
    room.style.setProperty("--accent", c ? c.accent : "#8b6cff");
    $("[data-meta]").textContent = c ? metaLine(c) : "Open bay";
    $("[data-name]").textContent = c ? c.name : "Your ride?";
    $("[data-tag]").textContent = c ? (c.tagline || c.story.slice(0, 140)) : "Club members can put their car on this floor. Reach out to roll with Hood 2 Hood.";
    open.innerHTML = c ? 'Open the build <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>' : "Contact the club";
    $("[data-count]").innerHTML = "Bay <b>" + ("0" + (cur + 1)).slice(-2) + "</b> / " + ("0" + total()).slice(-2);
    $("[data-prev]").disabled = cur === 0; $("[data-next]").disabled = cur === total() - 1;
  }
  function go(i) { cur = Math.max(0, Math.min(total() - 1, i)); place(); }
  $("[data-prev]").addEventListener("click", function () { go(cur - 1); });
  $("[data-next]").addEventListener("click", function () { go(cur + 1); });
  dots.addEventListener("click", function (e) { var b = e.target.closest("[data-dot]"); if (b) go(+b.getAttribute("data-dot")); });
  bays.addEventListener("click", function (e) {
    var b = e.target.closest("[data-bay]"); if (!b) return;
    var i = +b.getAttribute("data-bay");
    if (i !== cur) { e.preventDefault(); go(i); return; }
    if (CARS[i]) openBuild(i);
  });
  $("[data-open-build]").addEventListener("click", function () { if (CARS[cur]) openBuild(cur); else location.href = "./contact.html"; });
  stage.addEventListener("keydown", function (e) {
    if (e.target.closest("input, textarea")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(cur + 1); var b = $(".bay.active", bays); if (document.activeElement && document.activeElement.closest(".bay")) b.focus(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(cur - 1); var a = $(".bay.active", bays); if (document.activeElement && document.activeElement.closest(".bay")) a.focus(); }
  });
  // swipe the floor
  var sx = null;
  bays.addEventListener("pointerdown", function (e) { sx = e.clientX; });
  bays.addEventListener("pointerup", function (e) { if (sx == null) return; var dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) { go(cur + (dx < 0 ? 1 : -1)); bays.addEventListener("click", stop, { capture: true, once: true }); } });
  function stop(e) { e.stopPropagation(); e.preventDefault(); }
  // gentle tilt of the car under the pointer
  if (!reduce) bays.addEventListener("pointermove", function (e) {
    var b = $(".bay.active .car", bays); if (!b || e.pointerType !== "mouse") return;
    var r = bays.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    b.style.transform = "rotateY(" + x * 8 + "deg) rotateX(" + -y * 6 + "deg)";
  });
  bays.addEventListener("pointerleave", function () { var b = $(".bay.active .car", bays); if (b) b.style.transform = ""; });
  addEventListener("resize", function () { place(); if (!build.hidden) layoutRing(true); });

  /* ---------------- the build ---------------- */
  var build = $("[data-build]"), spin = $("[data-spin]"), film = $("[data-film]"), vp = $("[data-viewport]"), sheet = $("[data-sheet]");
  var focusBox = $("[data-focus]"), prog = $("[data-progress]"), playBtn = $("[data-b-play]");
  var car = null, idx = 0, mode = "ring", playing = !reduce, timer = null, lastFocus = null, step = 0, radius = 0, dragAngle = 0;

  function openBuild(i) {
    car = CARS[i]; if (!car) return;
    lastFocus = document.activeElement; idx = 0; mode = car.mode; playing = !reduce;
    build.style.setProperty("--accent", car.accent);
    $("[data-b-name]").innerHTML = car.name.split("").map(function (ch, k) { return '<span style="animation-delay:' + (k * 45) + 'ms">' + (ch === " " ? "&nbsp;" : esc(ch)) + "</span>"; }).join("");
    $("[data-b-name]").setAttribute("aria-label", car.name);
    $("[data-b-meta]").textContent = metaLine(car);
    drawSheet();
    build.hidden = false; document.body.classList.add("lock"); build.classList.remove("sheet-open");
    $("[data-sheet-toggle]").setAttribute("aria-expanded", "false");
    setMode(mode, true);
    $("[data-close-build]").focus();
    try { history.replaceState(null, "", "?car=" + encodeURIComponent(car.name)); } catch (e) {}
  }
  function closeBuild() {
    stopTimer(); closeFocus(true);
    build.hidden = true; document.body.classList.remove("lock");
    spin.innerHTML = ""; film.innerHTML = "";
    var yt = $("iframe", sheet); if (yt) yt.remove();
    var v = $("video", sheet); if (v) v.pause();
    try { history.replaceState(null, "", location.pathname); } catch (e) {}
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $("[data-close-build]").addEventListener("click", closeBuild);

  function drawSheet() {
    var c = car, rows = c.specs.length ? c.specs : [{ label: "Year", value: c.year }, { label: "Make", value: c.make }, { label: "Model", value: c.model }, { label: "Wrap", value: c.wrap }].filter(function (s) { return s.value; });
    if (c.owner && !rows.some(function (r) { return /owner/i.test(r.label); })) rows = rows.concat([{ label: "Owner", value: c.owner }]);
    var h = '<h2>Spec sheet</h2><p class="big holo-text">' + esc(c.name) + "</p>" + (c.tagline ? "<p>" + esc(c.tagline) + "</p>" : "");
    if (rows.length) h += '<ul class="spec-list">' + rows.map(function (r) { return "<li><b>" + esc(r.label) + "</b><span>" + esc(r.value) + "</span></li>"; }).join("") + "</ul>";
    if (c.story) h += "<h2>The story</h2><p>" + A.multiline(c.story) + "</p>";
    if (c.anthem) h += '<h2>' + (c.wrap ? esc(c.wrap) + " anthem" : "Anthem") + '</h2><button type="button" class="yt" data-yt="' + esc(c.anthem) + '"><img src="https://i.ytimg.com/vi/' + esc(c.anthem) + '/hqdefault.jpg" alt="" loading="lazy"><span class="play"><span><svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + PLAY + '</svg>Play the anthem</span></span></button>' +
      '<p class="fine" style="margin-top:.5rem"><a href="https://www.youtube.com/watch?v=' + esc(c.anthem) + '" target="_blank" rel="noopener">Watch on YouTube<span class="sr-only"> (opens in a new tab)</span></a></p>';
    if (c.clip) h += '<h2>On the move</h2><div class="clip"><video controls playsinline preload="none" poster="./' + esc(c.clip.poster || "") + '"><source src="./' + esc(c.clip.src) + '" type="video/mp4"></video></div>';
    h += '<h2>Pitch in</h2><p>Every show on this floor collects food, clothing, shoes and school supplies for the block.</p><a class="btn btn-holo btn-sm" href="./give.html#donate">Donate</a>';
    sheet.innerHTML = h;
  }
  sheet.addEventListener("click", function (e) {
    var b = e.target.closest("[data-yt]"); if (!b) return;
    var id = b.getAttribute("data-yt"); if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    var f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
    f.title = "Anthem video"; f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true;
    var wrap = document.createElement("div"); wrap.className = "yt"; wrap.appendChild(f);
    b.parentNode.replaceChild(wrap, b); f.focus();
    playing = false; stopTimer(); syncPlay();
  });
  $("[data-sheet-toggle]").addEventListener("click", function () {
    var on = !build.classList.contains("sheet-open"); build.classList.toggle("sheet-open", on);
    this.setAttribute("aria-expanded", on ? "true" : "false");
  });

  /* modes */
  $$("[data-mode]").forEach(function (b) { b.addEventListener("click", function () { setMode(b.getAttribute("data-mode")); }); });
  function setMode(m, fresh) {
    mode = m; $$("[data-mode]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-mode") === m ? "true" : "false"); });
    spin.hidden = m !== "ring"; film.hidden = m !== "film";
    if (m === "ring") buildRing(fresh); else buildFilm();
    show(); restart();
  }

  /* ring: photos on the inside of a cylinder, assembled from deep space */
  function panelWidth() {
    var w = vp.clientWidth || innerWidth;
    return Math.round(Math.min(560, Math.max(200, w * (w < 700 ? 0.68 : 0.42))));
  }
  function layoutRing(noAnim) {
    var n = car.photos.length, pw = panelWidth(), seats = Math.max(n, 7);
    step = 360 / seats;
    radius = n < 2 ? 0 : Math.round(pw / 2 / Math.tan(Math.PI / seats) + pw * 0.12);
    spin.style.setProperty("--pw", pw + "px");
    $$(".panel3d", spin).forEach(function (p, i) { p.style.transform = "rotateY(" + i * step + "deg) translateZ(" + radius + "px)"; });
    turn(noAnim);
  }
  function buildRing(fresh) {
    spin.innerHTML = car.photos.map(function (p, i) {
      return '<button type="button" class="panel3d" data-i="' + i + '" tabindex="-1" aria-label="Photo ' + (i + 1) + " of " + car.photos.length + (p.caption ? ": " + esc(p.caption) : "") + '">' +
        '<img src="' + esc(p.small) + '" ' + (p.small !== p.url ? 'srcset="' + esc(p.small) + " 720w, " + esc(p.url) + ' 1600w" sizes="560px" ' : "") + 'alt="" draggable="false" decoding="async"></button>';
    }).join("");
    var panels = $$(".panel3d", spin);
    layoutRing(true);
    if (reduce || !fresh) { panels.forEach(function (p) { p.classList.add("built"); }); return; }
    // fly-in: each panel starts far away and lands in its seat
    panels.forEach(function (p, i) {
      var seat = p.style.transform;
      p.style.transition = "none"; p.style.transform = seat + " translateZ(1600px) rotateX(-40deg)";
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        p.style.transition = "transform 1.3s cubic-bezier(.16,.9,.2,1) " + (i * 90) + "ms, opacity .8s " + (i * 90) + "ms, filter .4s";
        p.style.transform = seat; p.classList.add("built");
      }); });
    });
  }
  function turn(noAnim) {
    var a = -idx * step + dragAngle;
    spin.style.transition = noAnim || reduce ? "none" : "transform 1.1s cubic-bezier(.2,.75,.15,1)";
    spin.style.transform = "translateZ(" + -radius + "px) rotateY(" + a + "deg)";
    $$(".panel3d", spin).forEach(function (p, i) { p.classList.toggle("front", i === idx); p.tabIndex = i === idx ? 0 : -1; });
  }
  spin.addEventListener("click", function (e) {
    if (moved) return;
    var b = e.target.closest("[data-i]"); if (!b) return;
    var i = +b.getAttribute("data-i");
    if (i === idx) openFocus(); else { idx = i; show(); restart(); }
  });

  /* film: crossfade with a slow push-in */
  function buildFilm() {
    film.innerHTML = car.photos.map(function (p, i) {
      return '<figure data-f="' + i + '"><img src="' + esc(p.url) + '" alt="' + esc(p.caption || ("Photo " + (i + 1) + " of " + car.name)) + '" loading="' + (i < 2 ? "eager" : "lazy") + '" decoding="async"></figure>';
    }).join("");
    film.style.setProperty("--dur", car.speed + 1 + "s");
  }

  function show() {
    var n = car.photos.length, p = car.photos[idx];
    if (mode === "ring") turn(); else $$("figure", film).forEach(function (f, i) { f.classList.toggle("on", i === idx); });
    $("[data-b-cap]").innerHTML = "<b>" + ("0" + (idx + 1)).slice(-2) + " / " + ("0" + n).slice(-2) + "</b>" + esc(p.caption || car.name);
    if (!focusBox.hidden) drawFocus();
    [idx - 1, idx + 1].forEach(function (k) { var q = car.photos[(k + n) % n]; if (q) new Image().src = q.url; });
  }
  function move(d) { var n = car.photos.length; idx = (idx + d + n) % n; dragAngle = 0; show(); restart(); }
  $("[data-b-prev]").addEventListener("click", function () { move(-1); });
  $("[data-b-next]").addEventListener("click", function () { move(1); });

  /* autoplay */
  function stopTimer() { clearTimeout(timer); timer = null; prog.classList.remove("run"); }
  function restart() {
    stopTimer();
    if (!playing || build.hidden || !focusBox.hidden || car.photos.length < 2) return;
    prog.style.setProperty("--dur", car.speed + "s"); void prog.offsetWidth; prog.classList.add("run");
    timer = setTimeout(function () { move(1); }, car.speed * 1000);
  }
  function syncPlay() {
    playBtn.setAttribute("aria-pressed", playing ? "true" : "false");
    playBtn.setAttribute("aria-label", playing ? "Pause slideshow" : "Play slideshow");
    playBtn.querySelector("svg").innerHTML = playing ? PAUSE : PLAY;
  }
  playBtn.addEventListener("click", function () { playing = !playing; syncPlay(); restart(); });
  document.addEventListener("visibilitychange", function () { if (document.hidden) stopTimer(); else if (!build.hidden) restart(); });

  /* drag to spin */
  var down = null, moved = false;
  vp.addEventListener("pointerdown", function (e) {
    if (mode !== "ring" || e.button > 0) return;
    down = { x: e.clientX, a: dragAngle }; moved = false; stopTimer();
  });
  addEventListener("pointermove", function (e) {
    if (!down) return;
    var dx = e.clientX - down.x;
    if (Math.abs(dx) > 6) moved = true;
    if (!moved) return;
    dragAngle = down.a + dx * 0.25;
    spin.style.transition = "none";
    spin.style.transform = "translateZ(" + -radius + "px) rotateY(" + (-idx * step + dragAngle) + "deg)";
  });
  addEventListener("pointerup", function () {
    if (!down) return; down = null;
    if (moved) {
      var n = car.photos.length, shift = Math.round(-dragAngle / step);
      idx = ((idx + shift) % n + n) % n; dragAngle = 0; show();
      setTimeout(function () { moved = false; }, 0);
    }
    restart();
  });
  // swipe in film mode
  var fx = null;
  film.addEventListener("touchstart", function (e) { fx = e.touches[0].clientX; }, { passive: true });
  film.addEventListener("touchend", function (e) { if (fx == null) return; var dx = e.changedTouches[0].clientX - fx; fx = null; if (Math.abs(dx) > 45) move(dx < 0 ? 1 : -1); });
  film.addEventListener("click", function () { openFocus(); });

  /* focus view */
  function drawFocus() {
    var p = car.photos[idx], img = $("[data-focus-img]");
    img.src = p.url; img.alt = p.caption || ("Photo " + (idx + 1) + " of " + car.name);
    $("[data-focus-cap]").textContent = (idx + 1) + " / " + car.photos.length + (p.caption ? " · " + p.caption : "");
  }
  function openFocus() { focusBox.hidden = false; drawFocus(); stopTimer(); $("[data-focus-close]").focus(); }
  function closeFocus(silent) {
    if (focusBox.hidden) return; focusBox.hidden = true;
    if (!silent) { restart(); var f = $(".panel3d.front", spin); (mode === "ring" && f ? f : $("[data-b-next]")).focus(); }
  }
  $("[data-focus-close]").addEventListener("click", function () { closeFocus(); });
  $("[data-focus-prev]").addEventListener("click", function () { move(-1); });
  $("[data-focus-next]").addEventListener("click", function () { move(1); });

  /* keyboard inside the build */
  build.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.preventDefault(); if (!focusBox.hidden) closeFocus(); else if (build.classList.contains("sheet-open")) $("[data-sheet-toggle]").click(); else closeBuild(); return; }
    if (e.target.closest("input, textarea, select, iframe")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
    else if (e.key === "Tab") {   // keep focus inside the build
      var root = focusBox.hidden ? build : focusBox;
      var f = $$("button, a[href], video, iframe, [tabindex='0']", root).filter(function (el) { return !el.disabled && el.offsetParent !== null && el.tabIndex >= 0 && !el.closest("[hidden]"); });
      if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ---------------- start ---------------- */
  syncPlay();
  function startAt() {
    if (!deep) return;
    var name = decodeURIComponent(deep).toLowerCase();
    var i = CARS.map(function (c) { return c.name.toLowerCase(); }).indexOf(name);
    if (i >= 0) { go(i); openBuild(i); }
    deep = null;
  }
  drawFloor();
  if (!A.ready) { startAt(); return; }
  A.showroom().then(function (list) {
    var keep = CARS[cur] && CARS[cur].name;
    CARS = merge(list);
    var k = CARS.map(function (c) { return c.name; }).indexOf(keep); cur = k >= 0 ? k : 0;
    drawFloor(); startAt();
  }).catch(function () { startAt(); });
})();
