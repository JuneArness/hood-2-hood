/* ==========================================================================
   Hood 2 Hood Rydas | admin.js : the private Admin page (admin.html).
   Sign in -> Showroom (cars, photos, light color, gallery style, order),
   Events (+ flyer and photos), Forms, Voices (approve stories) and Team.
   Every action is checked again by the database; hiding a button here is
   never the only protection.
   ========================================================================== */
(function () {
  "use strict";
  var A = window.HAPI, C = window.H2H || {};
  if (!A) return;
  var esc = A.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var views = $$("[data-view]");
  function view(name) { views.forEach(function (v) { v.hidden = v.getAttribute("data-view") !== name; }); }
  function status(el, kind, msg) { if (el === appStatus) clearTimeout(flash.t); el.className = "form-status show " + kind; el.innerHTML = msg; }
  function clear(el) { el.className = "form-status"; el.innerHTML = ""; }
  var appStatus = $("[data-app-status]");
  function fail(err) { status(appStatus, "err", esc(err.message || String(err))); appStatus.focus(); if (err.code === "AUTH") start(); }
  function flash(msg) { status(appStatus, "ok", esc(msg)); clearTimeout(flash.t); flash.t = setTimeout(function () { clear(appStatus); }, 4500); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  var ME = {};

  if (!A.ready) { $("[data-not-connected]").hidden = false; return; }

  /* ---------------- sign in ---------------- */
  var recovering = /type=recovery/.test(location.hash);
  A.auth.onChange(function (ev) { if (ev === "PASSWORD_RECOVERY") { recovering = true; view("newpass"); } else if (ev === "SIGNED_OUT") view("signin"); });
  $("#signin-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var st = $("[data-signin-status]"), b = e.target.querySelector('button[type="submit"]');
    var em = $("#a-email").value.trim(), pw = $("#a-pass").value;
    if (!em || !pw) { status(st, "err", "Enter your email and password."); return; }
    b.disabled = true; clear(st);
    A.auth.signIn(em, pw).then(function () { $("#a-pass").value = ""; start(); })
      .catch(function (err) { status(st, "err", esc(err.message)); st.focus(); })
      .then(function () { b.disabled = false; });
  });
  $("[data-forgot]").addEventListener("click", function () {
    var st = $("[data-signin-status]"), em = $("#a-email").value.trim();
    if (!em) { status(st, "info", "Type your email above first, then press “Forgot password?” again."); $("#a-email").focus(); return; }
    A.auth.reset(em).then(function () { status(st, "ok", "If that email has an account, a reset link is on its way. Open it on this device."); })
      .catch(function (err) { status(st, "err", esc(err.message)); });
  });
  $("#newpass-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var st = $("[data-newpass-status]"), pw = $("#a-new").value;
    if (pw.length < 10) { status(st, "err", "Use at least 10 characters."); return; }
    A.auth.setPassword(pw).then(function () { recovering = false; history.replaceState(null, "", location.pathname); start(); })
      .catch(function (err) { status(st, "err", esc(err.message)); });
  });
  $$("[data-signout]").forEach(function (b) { b.addEventListener("click", function () { A.auth.signOut().then(function () { view("signin"); }); }); });

  function start() {
    if (recovering) return view("newpass");
    A.auth.user().then(function (u) {
      if (!u) return view("signin");
      return A.rpc("admin_me").then(function (me) {
        if (!me.is_admin) return view("denied");
        ME = me;
        $("[data-who]").textContent = me.email || u.email || "";
        var r = $("[data-role]"); r.textContent = me.role === "owner" ? "Owner" : "Staff";
        $("[data-team-add] form").hidden = me.role !== "owner"; $("[data-team-owner-only]").hidden = me.role === "owner";
        view("app"); load();
      });
    }).catch(function (err) { view("signin"); status($("[data-signin-status]"), "err", esc(err.message)); });
  }

  /* ---------------- tabs ---------------- */
  var tabs = $$("[data-tab]");
  function selectTab(name, focus) {
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-tab") === name;
      t.setAttribute("aria-selected", on ? "true" : "false"); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus();
    });
    $$("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== name; });
    clear(appStatus);
    if (name === "team") loadTeam();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { if (busyUpload()) return; selectTab(t.getAttribute("data-tab")); load(); });
    t.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var n = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length]; selectTab(n.getAttribute("data-tab"), true);
    });
  });

  /* ---------------- data ---------------- */
  var OV = { cars: [], events: [], requests: [], stories: [] };
  function load() {
    return A.rpc("admin_overview").then(function (ov) { OV = ov; drawCars(); drawEvents(); drawRequests(); drawStories(); }).catch(fail);
  }

  /* ================= photo manager (shared by cars and events) ================= */
  var uploading = false;
  function busyUpload() { if (uploading) status(appStatus, "info", "Photos are still uploading. Please wait until they finish."); return uploading; }
  window.addEventListener("beforeunload", function (e) { if (uploading) { e.preventDefault(); e.returnValue = ""; } });

  function PhotoManager(k, kind, getOwner, refresh, onChange) {
    var grid = $("[data-" + k + "-grid]");
    function draw() {
      var o = getOwner(), has = !!o;
      $("[data-" + k + "-photo-tools]").hidden = !has; $("[data-" + k + "-photos-hint]").hidden = has;
      if (!has) { grid.innerHTML = ""; return; }
      var ph = o.photos || [];
      $("[data-" + k + "-photos-h]").textContent = "Photos (" + ph.length + ")";
      grid.innerHTML = ph.map(function (p, i) {
        var cover = o.cover_photo_id === p.id;
        return '<li class="photo-admin' + (cover ? " is-cover" : "") + '" data-id="' + esc(p.id) + '">' +
          '<img src="' + esc(A.photoUrl(p.path)) + '" alt="Photo ' + (i + 1) + '" loading="lazy">' +
          (cover ? '<span class="cover-tag">' + (kind === "car" ? "Showroom pic" : "Cover") + "</span>" : "") +
          '<label class="sr-only" for="cap-' + esc(p.id) + '">Caption for photo ' + (i + 1) + "</label>" +
          '<input id="cap-' + esc(p.id) + '" class="cap" maxlength="200" placeholder="Add a caption (optional)" value="' + esc(p.caption) + '" data-cap>' +
          '<div class="photo-btns">' +
          '<button type="button" data-move="-1" aria-label="Move photo ' + (i + 1) + ' earlier"' + (i === 0 ? " disabled" : "") + ">&larr;</button>" +
          '<button type="button" data-move="1" aria-label="Move photo ' + (i + 1) + ' later"' + (i === ph.length - 1 ? " disabled" : "") + ">&rarr;</button>" +
          '<button type="button" data-cover aria-label="Make photo ' + (i + 1) + (kind === "car" ? ' the showroom picture"' : ' the cover"') + (cover ? " disabled" : "") + ">&#9733;</button>" +
          '<button type="button" class="danger" data-del-photo aria-label="Delete photo ' + (i + 1) + '">&#128465;</button></div></li>';
      }).join("");
      if (onChange) onChange();
    }
    grid.addEventListener("change", function (e) {
      var c = e.target.closest("[data-cap]"); if (!c) return;
      var id = c.closest("[data-id]").getAttribute("data-id");
      A.rpc("admin_update_photo", { p_id: id, p_caption: c.value }).then(function () {
        (getOwner().photos.filter(function (p) { return p.id === id; })[0] || {}).caption = c.value; flash("Caption saved.");
      }).catch(fail);
    });
    grid.addEventListener("click", function (e) {
      var li = e.target.closest("[data-id]"); if (!li) return;
      var id = li.getAttribute("data-id"), b;
      if ((b = e.target.closest("[data-move]"))) {
        A.rpc("admin_move_photo", { p_id: id, p_dir: +b.getAttribute("data-move") }).then(refresh).then(function () {
          var nb = grid.querySelector('[data-id="' + id + '"] [data-move="' + b.getAttribute("data-move") + '"]'); if (nb && !nb.disabled) nb.focus();
        }).catch(fail);
      } else if (e.target.closest("[data-cover]")) {
        A.rpc("admin_set_cover", { p_photo: id }).then(refresh).then(function () { flash(kind === "car" ? "Showroom picture set." : "Cover photo set."); }).catch(fail);
      } else if (e.target.closest("[data-del-photo]")) {
        if (!confirm("Delete this photo? This can’t be undone.")) return;
        A.rpc("admin_delete_photo", { p_id: id }).then(function (path) { return A.removeFiles([path]).catch(function () {}); })
          .then(refresh).then(function () { flash("Photo deleted."); }).catch(fail);
      }
    });
    function addFiles(list, asFlyer) {
      var o = getOwner();
      var files = Array.prototype.filter.call(list || [], function (f) { return /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name || ""); });
      var skipped = (list ? list.length : 0) - files.length;
      if (!o || !files.length) { if (skipped) status(appStatus, "err", "Only photos can be added here."); return Promise.resolve(); }
      if (uploading) { busyUpload(); return Promise.resolve(); }
      if (files.length > 50) { status(appStatus, "err", "Please add up to 50 photos at a time."); return Promise.resolve(); }
      uploading = true; clear(appStatus);
      var q = $("[data-" + k + "-queue]"), bar = $("[data-" + k + "-bar]"), txt = $("[data-" + k + "-ptext]"), pos = [], done = [], failed = [], n = 0, i = 0;
      q.hidden = false; bar.style.width = "0%";
      function tick() { bar.style.width = Math.round(100 * n / files.length) + "%"; txt.textContent = "Uploading " + Math.min(n + 1, files.length) + " of " + files.length + "…"; }
      tick();
      function worker() {   // two at a time: quick on Wi-Fi, still reliable on a weak phone signal
        if (i >= files.length) return Promise.resolve();
        var f = files[i++], at = i - 1;
        return A.uploadPhoto(o.id, f).then(function (path) { pos[at] = path; }, function (err) { failed.push((f.name || "photo") + ": " + err.message); })
          .then(function () { n++; tick(); return worker(); });
      }
      return Promise.all([worker(), worker()]).then(function () {
        done = pos.filter(Boolean);
        return done.length ? A.rpc("admin_add_photos", { p_kind: kind, p_owner: o.id, p_paths: done }) : null;
      }).then(refresh).then(function () {
        var oo = getOwner(), byPath = {};
        (oo.photos || []).forEach(function (p) { byPath[p.path] = p; });
        var jobs = [];
        files.forEach(function (f, j) { if (f.caption && pos[j] && byPath[pos[j]]) jobs.push(A.rpc("admin_update_photo", { p_id: byPath[pos[j]].id, p_caption: f.caption })); });
        if (asFlyer && done.length && byPath[done[0]]) {
          jobs.push(A.rpc("admin_update_photo", { p_id: byPath[done[0]].id, p_caption: byPath[done[0]].caption || "Event flyer" })
            .then(function () { return A.rpc("admin_set_cover", { p_photo: byPath[done[0]].id }); }));
        }
        return jobs.length ? Promise.all(jobs).then(refresh) : null;
      }).then(function () {
        var oo = getOwner(), live = oo.published ? "" : " It’s still a draft; tick Published and save to show it.";
        if (asFlyer && done.length) { txt.textContent = "Flyer added and set as the thumbnail."; flash("Flyer added. It’s now the thumbnail on the Events page." + live); return; }
        txt.textContent = plural(done.length, "photo") + " added.";
        if (failed.length) status(appStatus, "err", "Some photos didn’t upload:<br>" + failed.map(esc).join("<br>"));
        else flash(plural(done.length, "photo") + " added." + live);
      }).catch(fail).then(function () { uploading = false; bar.style.width = "100%"; setTimeout(function () { q.hidden = true; }, 2500); });
    }
    var fl = $("[data-" + k + "-flyer]");
    if (fl) fl.addEventListener("change", function (e) { addFiles(Array.prototype.slice.call(e.target.files, 0, 1), true); e.target.value = ""; });
    $("[data-" + k + "-pick]").addEventListener("change", function (e) { addFiles(e.target.files); e.target.value = ""; });
    $("[data-" + k + "-camera]").addEventListener("change", function (e) { addFiles(e.target.files); e.target.value = ""; });
    var drop = $("[data-" + k + "-drop]");
    ["dragenter", "dragover"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
    drop.addEventListener("drop", function (e) { if (e.dataTransfer) addFiles(e.dataTransfer.files); });
    return { draw: draw, add: addFiles };
  }

  function invalid(form, checks) {
    var ok = true;
    checks.forEach(function (x) {
      var box = x[0].closest(".field"); if (box) box.classList.toggle("invalid", !x[1]);
      x[0].setAttribute("aria-invalid", x[1] ? "false" : "true"); if (!x[1] && ok) { ok = false; x[0].focus(); }
    });
    if (!ok) status(appStatus, "err", "Please fix the highlighted fields.");
    return !ok;
  }
  function editorView(prefix, on) {
    $("[data-" + prefix + "-list-view]").hidden = on; $("[data-" + prefix + "-edit-view]").hidden = !on;
    window.scrollTo(0, Math.max(0, $(".admin-shell").offsetTop - 90));
  }

  /* ================= SHOWROOM (cars) ================= */
  var CAR = null, carForm = $("#car-form");
  var builtIns = (C.builtInCars || []).filter(function (c) { return c && c.name; });
  function drawCars() {
    var ul = $("[data-car-list]"), names = OV.cars.map(function (c) { return c.name.toLowerCase(); });
    var missing = builtIns.filter(function (b) { return names.indexOf(b.name.toLowerCase()) < 0; })[0];
    $("[data-import]").hidden = !missing;
    if (missing) { $("[data-import-name]").textContent = missing.name; $("[data-import-btn]").setAttribute("data-name", missing.name); }
    if (!OV.cars.length) { ul.innerHTML = '<li class="empty-state"><p>No cars in the database yet. Press <strong>+ New car</strong>' + (missing ? " or move " + esc(missing.name) + " in above" : "") + ".</p></li>"; return; }
    ul.innerHTML = OV.cars.map(function (c, i) {
      var u = A.photoUrl(c.cover), meta = [c.year, [c.make, c.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
      return '<li style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.5rem;align-items:center"><button type="button" class="admin-item" data-car-edit="' + esc(c.id) + '">' +
        (u ? '<img src="' + esc(u) + '" alt="" loading="lazy">' : '<span class="admin-thumb-ph" aria-hidden="true">H2H</span>') +
        '<span class="admin-item-main"><strong><span aria-hidden="true" style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:.45rem;background:' + esc(/^#[0-9a-f]{6}$/i.test(c.accent) ? c.accent : "#39f3ff") + '"></span>' + esc(c.name) + "</strong><span>" + esc(meta || "No details yet") + " · " + plural(c.photos, "photo") + "</span></span>" +
        '<span style="display:grid;gap:.3rem;justify-items:end">' + (c.featured ? '<span class="pill pill-new">Spotlight</span>' : "") + '<span class="pill ' + (c.published ? "pill-live" : "pill-draft") + '">' + (c.published ? "Published" : "Draft") + "</span></span></button>" +
        '<span style="display:grid;gap:.3rem"><button type="button" class="round" style="width:44px;height:44px" data-car-move="-1" data-id="' + esc(c.id) + '" aria-label="Move ' + esc(c.name) + ' earlier"' + (i === 0 ? " disabled" : "") + ">&uarr;</button>" +
        '<button type="button" class="round" style="width:44px;height:44px" data-car-move="1" data-id="' + esc(c.id) + '" aria-label="Move ' + esc(c.name) + ' later"' + (i === OV.cars.length - 1 ? " disabled" : "") + ">&darr;</button></span></li>";
    }).join("");
  }
  $("[data-car-list]").addEventListener("click", function (e) {
    var m = e.target.closest("[data-car-move]");
    if (m) {
      var id = m.getAttribute("data-id"), d = m.getAttribute("data-car-move");
      A.rpc("admin_move_car", { p_id: id, p_dir: +d }).then(load).then(function () { flash("Order updated."); var nb = $('[data-car-move="' + d + '"][data-id="' + id + '"]'); if (nb && !nb.disabled) nb.focus(); }).catch(fail);
      return;
    }
    var b = e.target.closest("[data-car-edit]"); if (b) openCar(b.getAttribute("data-car-edit"));
  });
  $("[data-new-car]").addEventListener("click", function () { openCar(null); });
  $("[data-car-back]").addEventListener("click", function () { if (busyUpload()) return; CAR = null; editorView("car", false); load(); });

  // spec sheet rows
  var specBox = $("[data-spec-rows]");
  function specRow(l, v) {
    var n = specBox.children.length + 1, row = document.createElement("div"); row.className = "spec-row";
    row.innerHTML = '<label class="sr-only" for="sl-' + n + '">Spec ' + n + ' label</label><input id="sl-' + n + '" maxlength="30" placeholder="Label (e.g. Wheels)" value="' + esc(l || "") + '" data-sl>' +
      '<label class="sr-only" for="sv-' + n + '">Spec ' + n + ' value</label><input id="sv-' + n + '" maxlength="60" placeholder="Value (e.g. 13-inch wire)" value="' + esc(v || "") + '" data-sv>' +
      '<button type="button" aria-label="Remove spec ' + n + '" data-rm-spec>&times;</button>';
    specBox.appendChild(row);
  }
  $("[data-add-spec]").addEventListener("click", function () { if (specBox.children.length >= 12) return flash("Up to 12 spec lines."); specRow(); specBox.lastChild.querySelector("input").focus(); });
  specBox.addEventListener("click", function (e) { var b = e.target.closest("[data-rm-spec]"); if (b) b.parentNode.remove(); });

  // light color + preview
  var accentIn = $("#c-accent"), preview = $("[data-preview]");
  function setAccent(c) {
    c = /^#[0-9a-f]{6}$/i.test(c || "") ? c.toLowerCase() : "#39f3ff";
    accentIn.value = c; preview.style.setProperty("--accent", c);
    $$("[data-swatch]").forEach(function (s) { s.setAttribute("aria-pressed", s.getAttribute("data-swatch").toLowerCase() === c ? "true" : "false"); });
  }
  $$("[data-swatch]").forEach(function (s) { s.addEventListener("click", function () { setAccent(s.getAttribute("data-swatch")); }); });
  accentIn.addEventListener("input", function () { setAccent(accentIn.value); });
  var speed = $("#c-speed"), speedOut = $("[data-speed-out]");
  speed.addEventListener("input", function () { speedOut.textContent = speed.value + "s"; });
  function drawPreview() {
    var img = $("[data-preview-img]"), c = CAR && CAR.photos && CAR.photos.filter(function (p) { return p.id === CAR.cover_photo_id; })[0];
    if (c) { img.src = A.photoUrl(c.path); img.hidden = false; } else img.hidden = true;
  }

  var carPhotos = PhotoManager("car", "car", function () { return CAR; }, refreshCar, drawPreview);
  function refreshCar() { return A.rpc("admin_get_car", { p_id: CAR.id }).then(function (c) { CAR = c; carPhotos.draw(); }); }
  var CAR_FIELDS = ["name", "owner_name", "year", "make", "model", "wrap_name", "tagline", "story", "anthem_url"];
  function openCar(id) {
    clear(appStatus); carForm.reset(); $$(".field.invalid", carForm).forEach(function (f) { f.classList.remove("invalid"); });
    specBox.innerHTML = "";
    if (!id) {
      CAR = null; $("[data-car-heading]").textContent = "New car"; $("[data-del-car]").hidden = true;
      setAccent("#39f3ff"); speed.value = 5; speedOut.textContent = "5s"; specRow("Year", ""); specRow("Make", ""); specRow("Model", "");
      carPhotos.draw(); drawPreview(); editorView("car", true); $("#c-name").focus(); return;
    }
    A.rpc("admin_get_car", { p_id: id }).then(function (c) {
      CAR = c; $("[data-car-heading]").textContent = c.name;
      CAR_FIELDS.forEach(function (k) { carForm.elements[k].value = c[k] == null ? "" : c[k]; });
      (c.specs || []).forEach(function (s) { specRow(s.label, s.value); });
      setAccent(c.accent); carForm.elements.mode.value = c.mode; speed.value = c.speed; speedOut.textContent = c.speed + "s";
      carForm.elements.featured.checked = !!c.featured; carForm.elements.published.checked = !!c.published;
      $("[data-del-car]").hidden = false; carPhotos.draw(); drawPreview(); editorView("car", true);
      var h = $("[data-car-heading]"); h.focus();
    }).catch(fail);
  }
  function carPayload() {
    var p = {}; CAR_FIELDS.forEach(function (k) { p[k] = carForm.elements[k].value.trim(); });
    p.specs = $$(".spec-row", specBox).map(function (r) { return { label: r.querySelector("[data-sl]").value.trim(), value: r.querySelector("[data-sv]").value.trim() }; }).filter(function (s) { return s.label && s.value; });
    p.accent = accentIn.value; p.mode = carForm.elements.mode.value; p.speed = +speed.value;
    p.featured = carForm.elements.featured.checked; p.published = carForm.elements.published.checked;
    if (CAR) p.id = CAR.id;
    return p;
  }
  carForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var n = carForm.elements.name, y = carForm.elements.year, an = carForm.elements.anthem_url;
    if (invalid(carForm, [[n, n.value.trim() !== ""], [y, !y.value.trim() || /^\d{4}$/.test(y.value.trim())], [an, !an.value.trim() || !!A.youtubeId(an.value.trim())]])) return;
    var p = carPayload(), b = carForm.querySelector('button[type="submit"]'); b.disabled = true;
    A.rpc("admin_save_car", { p: p }).then(function (id) {
      var isNew = !CAR;
      return A.rpc("admin_get_car", { p_id: id }).then(function (c) {
        CAR = c; $("[data-car-heading]").textContent = c.name; $("[data-del-car]").hidden = false; carPhotos.draw();
        flash(isNew ? "Car saved. Now add photos." : (p.published ? "Saved. It’s live in the Showroom." : "Saved as a draft (not shown on the website)."));
        if (isNew) $("[data-car-photos-card]").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }).catch(fail).then(function () { b.disabled = false; });
  });
  $("[data-del-car]").addEventListener("click", function () {
    if (!CAR || !confirm("Delete “" + CAR.name + "” and all " + plural((CAR.photos || []).length, "photo") + "? This can’t be undone.")) return;
    A.rpc("admin_delete_car", { p_id: CAR.id }).then(function (paths) { return A.removeFiles(paths).catch(function () {}); })
      .then(function () { CAR = null; editorView("car", false); load(); flash("Car deleted."); }).catch(fail);
  });

  // Move a car that's built into the website into the database (photos included)
  $("[data-import-btn]").addEventListener("click", function () {
    var b = this, src = builtIns.filter(function (c) { return c.name === b.getAttribute("data-name"); })[0]; if (!src || uploading) return;
    b.disabled = true; status(appStatus, "info", "Creating " + esc(src.name) + "…");
    var p = { name: src.name, owner_name: src.owner_name || "", year: src.year ? String(src.year) : "", make: src.make || "", model: src.model || "",
      wrap_name: src.wrap_name || "", tagline: src.tagline || "", story: src.story || "", anthem_url: src.anthem_url || "", specs: src.specs || [],
      accent: src.accent || "#39f3ff", mode: src.mode || "ring", speed: src.speed || 5, featured: false, published: false };
    var photos = (src.photos || []).filter(function (x) { return /^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(x.src || ""); });
    A.rpc("admin_save_car", { p: p }).then(function (id) { return A.rpc("admin_get_car", { p_id: id }); }).then(function (c) {
      CAR = c; status(appStatus, "info", "Copying " + plural(photos.length, "photo") + "…");
      return Promise.all(photos.map(function (x) {
        return fetch("./" + x.src).then(function (r) { if (!r.ok) throw new Error("Missing " + x.src); return r.blob(); })
          .then(function (bl) { var f = new Blob([bl], { type: bl.type || "image/jpeg" }); f.name = x.src; f.caption = x.caption || ""; return f; });
      }));
    }).then(function (files) { return carPhotos.add(files); }).then(function () {
      return A.rpc("admin_save_car", { p: Object.assign({}, p, { id: CAR.id, published: true }) });
    }).then(function () {
      CAR = null; return load();
    }).then(function () { flash(src.name + " is in the database and published. Edit it below."); }).catch(fail).then(function () { b.disabled = false; });
  });

  /* ================= EVENTS ================= */
  var EV = null, evForm = $("#event-form");
  function drawEvents() {
    var ul = $("[data-ev-list]");
    if (!OV.events.length) { ul.innerHTML = '<li class="empty-state"><p>No events yet. Press <strong>+ New event</strong> to add your first show.</p></li>'; return; }
    ul.innerHTML = OV.events.map(function (e) {
      var u = A.photoUrl(e.cover);
      return '<li><button type="button" class="admin-item" data-ev-edit="' + esc(e.id) + '">' +
        (u ? '<img src="' + esc(u) + '" alt="" loading="lazy">' : '<span class="admin-thumb-ph" aria-hidden="true">H2H</span>') +
        '<span class="admin-item-main"><strong>' + esc(e.title) + "</strong><span>" + esc(A.dateRange(e.event_date, e.end_date)) + " · " + plural(e.photos, "photo") + "</span></span>" +
        '<span class="pill ' + (e.published ? "pill-live" : "pill-draft") + '">' + (e.published ? "Published" : "Draft") + "</span></button></li>";
    }).join("");
  }
  $("[data-ev-list]").addEventListener("click", function (e) { var b = e.target.closest("[data-ev-edit]"); if (b) openEvent(b.getAttribute("data-ev-edit")); });
  $("[data-new-event]").addEventListener("click", function () { openEvent(null); });
  $("[data-ev-back]").addEventListener("click", function () { if (busyUpload()) return; EV = null; editorView("ev", false); load(); });
  var evPhotos = PhotoManager("ev", "event", function () { return EV; }, refreshEvent);
  function refreshEvent() { return A.rpc("admin_get_event", { p_id: EV.id }).then(function (e) { EV = e; evPhotos.draw(); }); }
  var EV_FIELDS = ["title", "event_date", "end_date", "time_text", "location", "summary", "details", "link_url", "link_label"];
  function openEvent(id) {
    clear(appStatus); evForm.reset(); $$(".field.invalid", evForm).forEach(function (f) { f.classList.remove("invalid"); });
    if (!id) { EV = null; $("[data-ev-heading]").textContent = "New event"; $("[data-del-event]").hidden = true; evPhotos.draw(); editorView("ev", true); $("#e-title").focus(); return; }
    A.rpc("admin_get_event", { p_id: id }).then(function (e) {
      EV = e; $("[data-ev-heading]").textContent = "Edit event";
      EV_FIELDS.forEach(function (k) { evForm.elements[k].value = e[k] || ""; });
      evForm.elements.published.checked = !!e.published; $("[data-del-event]").hidden = false;
      evPhotos.draw(); editorView("ev", true); $("[data-ev-heading]").focus();
    }).catch(fail);
  }
  evForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var t = evForm.elements.title, d = evForm.elements.event_date, l = evForm.elements.link_url;
    if (invalid(evForm, [[t, t.value.trim() !== ""], [d, !!d.value], [l, !l.value.trim() || /^https:\/\/\S+$/.test(l.value.trim())]])) return;
    var p = {}; EV_FIELDS.forEach(function (k) { p[k] = evForm.elements[k].value.trim(); });
    p.published = evForm.elements.published.checked; if (EV) p.id = EV.id;
    var b = evForm.querySelector('button[type="submit"]'); b.disabled = true;
    A.rpc("admin_save_event", { p: p }).then(function (id) {
      var isNew = !EV;
      return A.rpc("admin_get_event", { p_id: id }).then(function (ev) {
        EV = ev; $("[data-del-event]").hidden = false; $("[data-ev-heading]").textContent = "Edit event"; evPhotos.draw();
        flash(isNew ? "Event saved. Now add the flyer and photos." : (p.published ? "Saved. It’s live on the Events page." : "Saved as a draft (not shown on the website)."));
        if (isNew) $("[data-ev-photos-card]").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }).catch(fail).then(function () { b.disabled = false; });
  });
  $("[data-del-event]").addEventListener("click", function () {
    if (!EV || !confirm("Delete “" + EV.title + "” and all " + plural((EV.photos || []).length, "photo") + "? This can’t be undone.")) return;
    A.rpc("admin_delete_event", { p_id: EV.id }).then(function (paths) { return A.removeFiles(paths).catch(function () {}); })
      .then(function () { EV = null; editorView("ev", false); load(); flash("Event deleted."); }).catch(fail);
  });

  /* ================= FORMS ================= */
  var KIND = { donate: "Donation", support: "Supporter", volunteer: "Volunteer" }, ST = { new: "New", contacted: "Contacted", closed: "Closed" }, filter = "";
  function drawRequests() {
    var news = OV.requests.filter(function (r) { return r.status === "new"; }).length, badge = $("[data-new-forms]");
    badge.hidden = !news; badge.textContent = news ? news + " new" : "";
    var list = OV.requests.filter(function (r) { return !filter || r.kind === filter; }), ul = $("[data-rq-list]");
    if (!list.length) { ul.innerHTML = '<li class="empty-state"><p>No forms here yet.</p></li>'; return; }
    ul.innerHTML = list.map(function (r) {
      return '<li><button type="button" class="admin-item no-thumb" data-rq="' + esc(r.id) + '"><span class="kind-tag kind-' + esc(r.kind) + '">' + KIND[r.kind] + "</span>" +
        '<span class="admin-item-main"><strong>' + esc(r.name) + (r.organization ? " · " + esc(r.organization) : "") + "</strong><span>" +
        esc(new Date(r.created_at).toLocaleString()) + " · " + esc(r.ref) + "</span></span>" +
        '<span class="pill pill-' + esc(r.status) + '">' + ST[r.status] + "</span></button></li>";
    }).join("");
  }
  $$("[data-kind-filter]").forEach(function (b) {
    b.addEventListener("click", function () {
      filter = b.getAttribute("data-kind-filter");
      $$("[data-kind-filter]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      drawRequests();
    });
  });
  $("[data-rq-list]").addEventListener("click", function (e) { var b = e.target.closest("[data-rq]"); if (b) openRequest(b.getAttribute("data-rq")); });
  $("[data-rq-back]").addEventListener("click", function () { $("[data-rq-detail-view]").hidden = true; $("[data-rq-list-view]").hidden = false; load(); });
  function row(k, v) { return v ? "<dt>" + k + "</dt><dd>" + v + "</dd>" : ""; }
  function contactBtns(email, phone, subject) {
    var tel = phone ? String(phone).replace(/[^\d+]/g, "") : "";
    return '<div class="btn-row" style="margin:1rem 0 1.5rem">' + (email ? '<a class="btn btn-holo btn-sm" href="mailto:' + esc(email) + "?subject=" + encodeURIComponent(subject) + '">Email</a>' : "") +
      (tel ? '<a class="btn btn-sm" href="tel:' + esc(tel) + '">Call</a><a class="btn btn-sm" href="sms:' + esc(tel) + '">Text</a>' : "") + "</div>";
  }
  function openRequest(id) {
    A.rpc("admin_get_request", { p_id: id }).then(function (r) {
      $("[data-rq-detail]").innerHTML =
        '<p class="kind-tag kind-' + esc(r.kind) + '" style="display:inline-block;margin-top:1rem">' + KIND[r.kind] + '</p><h2 class="h3" tabindex="-1" data-rq-h>' + esc(r.name) + "</h2>" +
        '<dl class="rq-dl">' + row("Reference", esc(r.ref)) + row("Received", esc(new Date(r.created_at).toLocaleString())) +
        row("Organization", esc(r.organization)) + row("Email", '<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + "</a>") + row("Phone", esc(r.phone)) +
        row(r.kind === "donate" ? "Would like to give" : r.kind === "support" ? "Wants to" : "Wants to help with", esc((r.interests || []).join(", "))) +
        row(r.kind === "donate" ? "Getting it to us" : "Available", esc((r.availability || []).join(", "))) +
        row("18 or older", r.adult === true ? "Yes" : r.adult === false ? "No (needs a parent or guardian’s okay)" : "") +
        row("Message", A.multiline(r.message)) + "</dl>" + contactBtns(r.email, r.phone, "Hood 2 Hood Rydas: " + KIND[r.kind] + " (" + r.ref + ")") +
        '<div class="form-grid"><div class="field"><label for="rq-status">Status</label><select id="rq-status">' +
        ["new", "contacted", "closed"].map(function (s) { return '<option value="' + s + '"' + (r.status === s ? " selected" : "") + ">" + ST[s] + "</option>"; }).join("") +
        '</select></div><div class="field"><label for="rq-notes">Private notes</label><textarea id="rq-notes" maxlength="4000" rows="4">' + esc(r.notes) + "</textarea></div>" +
        '<div class="btn-row"><button type="button" class="btn btn-holo btn-sm" data-rq-save>Save</button><button type="button" class="btn btn-sm danger" data-rq-del>Delete form</button></div></div>';
      $("[data-rq-list-view]").hidden = true; $("[data-rq-detail-view]").hidden = false; $("[data-rq-h]").focus();
      $("[data-rq-save]").onclick = function () { A.rpc("admin_update_request", { p_id: r.id, p_status: $("#rq-status").value, p_notes: $("#rq-notes").value }).then(function () { flash("Saved."); }).catch(fail); };
      $("[data-rq-del]").onclick = function () {
        if (!confirm("Delete this form from " + r.name + "? This can’t be undone.")) return;
        A.rpc("admin_delete_request", { p_id: r.id }).then(function () { $("[data-rq-back]").click(); flash("Form deleted."); }).catch(fail);
      };
    }).catch(fail);
  }
  $("[data-export]").addEventListener("click", function () {
    A.rpc("admin_export_requests").then(function (rows) {
      if (!rows.length) return flash("No forms to download yet.");
      var cols = ["ref", "type", "received", "status", "name", "organization", "email", "phone", "interests", "availability", "age_18_plus", "message", "notes"];
      var cell = function (v) { v = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
      var csv = [cols.join(",")].concat(rows.map(function (r) { return cols.map(function (c) { return cell(r[c]); }).join(","); })).join("\r\n");
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
      a.download = "h2h-forms-" + new Date().toISOString().slice(0, 10) + ".csv"; document.body.appendChild(a); a.click(); a.remove();
    }).catch(fail);
  });

  /* ================= VOICES ================= */
  var SS = { pending: "Waiting for review", approved: "On the website", hidden: "Hidden" }, sfilter = "";
  function drawStories() {
    var pend = OV.stories.filter(function (s) { return s.status === "pending"; }).length, badge = $("[data-new-voices]");
    badge.hidden = !pend; badge.textContent = pend ? pend + " new" : "";
    var list = OV.stories.filter(function (s) { return !sfilter || s.status === sfilter; }), ul = $("[data-st-list]");
    if (!list.length) { ul.innerHTML = '<li class="empty-state"><p>No stories here yet.</p></li>'; return; }
    ul.innerHTML = list.map(function (s) {
      return '<li><button type="button" class="admin-item no-thumb" data-st="' + esc(s.id) + '"><span class="kind-tag" style="color:#c8fbff">' + esc(s.neighborhood) + "</span>" +
        '<span class="admin-item-main"><strong>' + esc(s.preview) + "…</strong><span>" + esc(new Date(s.created_at).toLocaleString()) + (s.city ? " · " + esc(s.city) : "") + "</span></span>" +
        '<span class="pill pill-' + esc(s.status) + '">' + (s.status === "pending" ? "New" : s.status === "approved" ? "Live" : "Hidden") + "</span></button></li>";
    }).join("");
  }
  $$("[data-st-filter]").forEach(function (b) {
    b.addEventListener("click", function () {
      sfilter = b.getAttribute("data-st-filter");
      $$("[data-st-filter]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      drawStories();
    });
  });
  $("[data-st-list]").addEventListener("click", function (e) { var b = e.target.closest("[data-st]"); if (b) openStory(b.getAttribute("data-st")); });
  $("[data-st-back]").addEventListener("click", function () { $("[data-st-detail-view]").hidden = true; $("[data-st-list-view]").hidden = false; load(); });
  function openStory(id) {
    A.rpc("admin_get_story", { p_id: id }).then(function (s) {
      var shown = s.show_name && s.name ? s.name : "(no name shown)";
      $("[data-st-detail]").innerHTML =
        '<p class="pill pill-' + esc(s.status) + '" style="display:inline-block;margin-top:1rem">' + SS[s.status] + '</p><h2 class="h3" tabindex="-1" data-st-h>' + esc([s.neighborhood, s.city].filter(Boolean).join(", ")) + "</h2>" +
        '<blockquote class="story" style="margin:1rem 0"><p style="margin:0">' + A.multiline(s.story) + "</p></blockquote>" +
        '<dl class="rq-dl">' + row("Reference", esc(s.ref)) + row("Received", esc(new Date(s.created_at).toLocaleString())) +
        row("Needs", esc((s.needs || []).join(", "))) + row("Name", esc(s.name || "")) + row("Shown on site as", esc(shown)) +
        row("Email (private)", s.email ? '<a href="mailto:' + esc(s.email) + '">' + esc(s.email) + "</a>" : "") + row("Phone (private)", esc(s.phone)) + "</dl>" +
        contactBtns(s.email, s.phone, "Hood 2 Hood Rydas: your neighborhood story (" + s.ref + ")") +
        '<p class="fine">Before approving, check the story doesn’t include anyone’s private details (full names of kids, addresses, health information) or anything hurtful.</p>' +
        '<div class="field" style="margin-bottom:1rem"><label for="st-notes">Private notes</label><textarea id="st-notes" maxlength="4000" rows="3">' + esc(s.notes) + "</textarea></div>" +
        '<div class="btn-row">' + (s.status !== "approved" ? '<button type="button" class="btn btn-holo btn-sm" data-st-set="approved">Approve: show on website</button>' : "") +
        (s.status !== "hidden" ? '<button type="button" class="btn btn-sm" data-st-set="hidden">Hide</button>' : "") +
        (s.status !== "pending" ? '<button type="button" class="btn btn-sm" data-st-set="pending">Back to review</button>' : "") +
        '<button type="button" class="btn btn-sm" data-st-set="' + esc(s.status) + '">Save notes</button><button type="button" class="btn btn-sm danger" data-st-del>Delete</button></div>';
      $("[data-st-list-view]").hidden = true; $("[data-st-detail-view]").hidden = false; $("[data-st-h]").focus();
      $$("[data-st-set]").forEach(function (b) {
        b.onclick = function () {
          var to = b.getAttribute("data-st-set");
          A.rpc("admin_update_story", { p_id: s.id, p_status: to, p_notes: $("#st-notes").value }).then(function () {
            flash(to === "approved" ? "Approved. It’s on the Voices page." : to === "hidden" ? "Hidden from the website." : to === s.status ? "Notes saved." : "Moved back to review.");
            if (to !== s.status) openStory(s.id);
          }).catch(fail);
        };
      });
      $("[data-st-del]").onclick = function () {
        if (!confirm("Delete this story? This can’t be undone.")) return;
        A.rpc("admin_delete_story", { p_id: s.id }).then(function () { $("[data-st-back]").click(); flash("Story deleted."); }).catch(fail);
      };
    }).catch(fail);
  }

  /* ================= TEAM ================= */
  function loadTeam() {
    A.rpc("admin_team").then(function (list) {
      $("[data-team-list]").innerHTML = list.map(function (m) {
        return '<li class="admin-item no-thumb" style="cursor:default"><span class="pill ' + (m.role === "owner" ? "pill-new" : "") + '">' + (m.role === "owner" ? "Owner" : "Staff") + '</span>' +
          '<span class="admin-item-main"><strong>' + esc(m.email) + "</strong><span>" + (m.me ? "You" : "") + "</span></span>" +
          (ME.role === "owner" && !m.me ? '<button type="button" class="btn btn-sm danger" data-rm-member="' + esc(m.user_id) + '" data-email="' + esc(m.email) + '">Remove</button>' : "<span></span>") + "</li>";
      }).join("");
    }).catch(fail);
  }
  $("[data-team-list]").addEventListener("click", function (e) {
    var b = e.target.closest("[data-rm-member]"); if (!b) return;
    if (!confirm("Remove " + b.getAttribute("data-email") + " from the team? They won’t be able to use Admin anymore.")) return;
    A.rpc("admin_remove_member", { p_user: b.getAttribute("data-rm-member") }).then(function () { flash("Removed."); loadTeam(); }).catch(fail);
  });
  $("#team-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var em = $("#t-email");
    if (invalid(e.target, [[em, /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.value.trim())]])) return;
    A.rpc("admin_add_member", { p_email: em.value.trim(), p_role: $("#t-role").value }).then(function () { flash("Added. They can sign in now."); em.value = ""; loadTeam(); }).catch(fail);
  });

  start();
})();
