/* ==========================================================================
   Hood 2 Hood Rydas | h2h-api.js : the only file that talks to Supabase
   (Showroom, Events, forms, Voices, Admin). You shouldn't need to edit it.
   Connection settings live in data.js (supabaseUrl, supabaseKey).
   ========================================================================== */
window.HAPI = (function () {
  "use strict";
  var C = window.H2H || {};
  var ready = !!(C.supabaseUrl && C.supabaseKey && window.supabase);
  var sb = ready ? window.supabase.createClient(C.supabaseUrl, C.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
  var BUCKET = "media";
  var FRIENDLY = [
    [/invalid login credentials/i, "That email and password don’t match."],
    [/failed to fetch|networkerror|load failed/i, "Can’t reach the server right now. Check your connection and try again."],
    [/payload too large|exceeded the maximum allowed size|too large/i, "That photo is too large (10 MB max)."],
    [/mime type|invalid_mime|not supported/i, "That file type isn’t supported. Please use JPG, PNG or WebP photos."],
    [/rate limit|too many/i, "Too many attempts. Please wait a minute and try again."],
    [/duplicate|already exists/i, "That photo was already uploaded."]
  ];
  function wrap(e) {
    var m = (e && (e.message || e.msg || e.error)) || String(e);
    var bar = m.indexOf("|"), out = new Error(bar > 0 && bar < 20 ? m.slice(bar + 1) : m);
    out.code = bar > 0 && bar < 20 ? m.slice(0, bar) : "";
    if (!out.code) for (var i = 0; i < FRIENDLY.length; i++) if (FRIENDLY[i][0].test(m)) { out.message = FRIENDLY[i][1]; break; }
    return out;
  }
  function rpc(fn, args) {
    if (!sb) return Promise.reject(wrap("NOT_CONNECTED|The website isn’t connected to its database yet."));
    return sb.rpc(fn, args || {}).then(function (r) { if (r.error) throw wrap(r.error); return r.data; });
  }

  // Resize a photo in the browser (longest side 2000px, JPEG) so phone uploads are fast.
  // iPhone HEIC photos are converted too when the browser can open them (Safari can).
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var plain = /^image\/(jpeg|png|webp)$/.test(file.type);
      if (!window.createImageBitmap) return plain ? resolve(file) : reject(wrap("MIME|Please use JPG, PNG or WebP photos."));
      createImageBitmap(file).then(function (bmp) {
        var max = 2000, s = Math.min(1, max / Math.max(bmp.width, bmp.height));
        if (plain && s === 1 && file.size < 2.5e6) return resolve(file);
        var c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
        c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          if (b && (!plain || b.size < file.size)) resolve(b);
          else if (plain) resolve(file);
          else reject(wrap("MIME|This photo couldn’t be converted. Please use a JPG or PNG."));
        }, "image/jpeg", 0.86);
      }).catch(function () {
        if (plain) resolve(file);
        else reject(wrap("MIME|" + (file.name || "This file") + " isn’t a photo this browser can open. Please use JPG, PNG or WebP."));
      });
    });
  }
  function uploadPhoto(ownerId, file) {
    if (!sb) return Promise.reject(wrap("NOT_CONNECTED|Not connected."));
    return shrink(file).then(function (blob) {
      var type = blob === file ? file.type : "image/jpeg";
      var ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[type] || "jpg";
      var path = ownerId + "/" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
      return sb.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false, cacheControl: "31536000" })
        .then(function (r) { if (r.error) throw wrap(r.error); return path; });
    });
  }
  function removeFiles(paths) {
    if (!sb || !paths || !paths.length) return Promise.resolve();
    return sb.storage.from(BUCKET).remove(paths).then(function (r) { if (r.error) throw wrap(r.error); });
  }

  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function photoUrl(path) {
    return ready && /^[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(path || "")
      ? C.supabaseUrl.replace(/\/+$/, "") + "/storage/v1/object/public/" + BUCKET + "/" + path : "";
  }
  // "2026-03-14" -> Date at local midnight (no timezone shift)
  function day(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function dateRange(a, b) {
    var d1 = day(a), d2 = day(b); if (!d1) return "";
    var o = { weekday: "short", month: "short", day: "numeric", year: "numeric" };
    if (!d2) return d1.toLocaleDateString("en-US", o);
    if (d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth())
      return d1.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " – " + d2.getDate() + ", " + d2.getFullYear();
    return d1.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " – " + d2.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function safeHttps(u) { return /^https:\/\/[^\s<>"]+$/.test(u || "") ? u : ""; }
  // YouTube link -> 11-character video id, or "".
  function youtubeId(u) {
    var m = /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(u || "");
    return m ? m[1] : "";
  }
  // A photo is either built into the site (src: a file in this folder) or uploaded in Admin (path).
  function imgSrc(p, small) {
    if (!p) return "";
    if (p.src) {
      if (!/^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(p.src)) return "";
      return "./" + (small ? p.src.replace(/\.(jpg|jpeg|png|webp)$/i, "-sm.$1") : p.src);
    }
    return photoUrl(p.path);
  }

  return {
    ready: ready,
    rpc: rpc,
    showroom: function () { return ready ? rpc("list_showroom") : Promise.resolve([]); },
    events: function () { return ready ? rpc("list_events") : Promise.resolve([]); },
    stories: function () { return ready ? rpc("list_stories") : Promise.resolve([]); },
    submit: function (data) { return rpc("submit_request", { p: data }); },
    submitStory: function (data) { return rpc("submit_story", { p: data }); },
    uploadPhoto: uploadPhoto,
    removeFiles: removeFiles,
    photoUrl: photoUrl,
    auth: {
      user: function () { return sb ? sb.auth.getSession().then(function (r) { return (r.data.session && r.data.session.user) || null; }) : Promise.resolve(null); },
      signIn: function (email, pw) { return sb.auth.signInWithPassword({ email: email, password: pw }).then(function (r) { if (r.error) throw wrap(r.error); }); },
      signOut: function () { return sb.auth.signOut(); },
      reset: function (email) { return sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }).then(function (r) { if (r.error) throw wrap(r.error); }); },
      setPassword: function (pw) { return sb.auth.updateUser({ password: pw }).then(function (r) { if (r.error) throw wrap(r.error); }); },
      onChange: function (cb) { if (sb) sb.auth.onAuthStateChange(function (ev) { cb(ev); }); }
    },
    esc: esc,
    multiline: function (s) { return esc(s).replace(/\n/g, "<br>"); },
    day: day,
    dateRange: dateRange,
    safeHttps: safeHttps,
    youtubeId: youtubeId,
    imgSrc: imgSrc
  };
})();
