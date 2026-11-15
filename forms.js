/* ==========================================================================
   Hood 2 Hood Rydas | forms.js : Donate / Supporter / Volunteer forms
   (give.html) and the "Share your story" form (voices.html).
   Nothing is shown as "sent" unless the database actually saved it.
   ========================================================================== */
(function () {
  "use strict";
  var A = window.HAPI, C = window.H2H || {};
  if (!A) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- Get Involved tabs ---------- */
  var tabs = $$("[data-path]");
  function pick(name, focus) {
    var ok = tabs.some(function (t) { return t.getAttribute("data-path") === name; }); if (!ok) return;
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-path") === name;
      t.setAttribute("aria-selected", on ? "true" : "false"); t.tabIndex = on ? 0 : -1;
      $("#" + t.getAttribute("aria-controls")).hidden = !on;
      if (on && focus) t.focus();
    });
    try { history.replaceState(null, "", "#" + name); } catch (e) {}
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { pick(t.getAttribute("data-path")); });
    t.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      pick(tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length].getAttribute("data-path"), true);
    });
  });
  function fromHash() { var h = location.hash.replace("#", ""); if (h) pick(h); }
  if (tabs.length) { fromHash(); addEventListener("hashchange", fromHash); }

  // online giving button + note (data.js)
  var give = $("[data-give]"), url = A.safeHttps(C.donateUrl);
  if (give && url) {
    give.hidden = false; $("[data-give-link]", give).href = url;
    $("[data-give-label]", give).textContent = C.donateButton || "Give online";
  }
  var note = $("[data-give-note]");
  if (note && C.donateNote) { note.textContent = C.donateNote; note.hidden = false; }

  // story length counter
  var story = $("#st-story"), count = $("[data-count-story]");
  if (story && count) story.addEventListener("input", function () { count.textContent = story.value.length; });

  /* ---------- forms ---------- */
  function phoneOk(v) { var d = String(v || "").replace(/\D/g, ""); return !d || /^1?\d{10}$/.test(d); }

  $$(".inv-form, .story-form").forEach(function (form) {
    var isStory = form.classList.contains("story-form"), kind = form.getAttribute("data-kind");
    var status = $(".form-status", form), done = form.nextElementSibling;
    var btn = $('button[type="submit"]', form), label = btn.innerHTML, busy = false;
    function say(k, html) { status.className = "form-status show " + k; status.innerHTML = html; }

    function checkField(f) {
      var box = f.closest(".field"); if (!box || box.matches("fieldset")) return true;
      var ok = f.type === "checkbox" ? (!f.required || f.checked) : (f.checkValidity() && (!f.required || f.value.trim() !== ""));
      if (ok && f.hasAttribute("minlength") && f.value.trim().length < +f.getAttribute("minlength")) ok = false;
      if (ok && f.hasAttribute("data-phone")) ok = phoneOk(f.value);
      box.classList.toggle("invalid", !ok); f.setAttribute("aria-invalid", ok ? "false" : "true");
      return ok;
    }
    function checkGroup(fs) {
      var ok = !fs.hasAttribute("data-required") || !!fs.querySelector("input:checked");
      fs.classList.toggle("invalid", !ok);
      return ok;
    }
    form.addEventListener("change", function (ev) {
      var fs = ev.target.closest("fieldset[data-group]"); if (fs && fs.classList.contains("invalid")) checkGroup(fs);
      if (ev.target.closest(".field.invalid")) checkField(ev.target);
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (busy) return;
      var fields = $$("input, textarea", form).filter(function (f) { return f.id && f.name !== "website" && !f.closest("fieldset[data-group]"); });
      var bad = fields.filter(function (f) { return !checkField(f); });
      var badGroups = $$("fieldset[data-group]", form).filter(function (fs) { return !checkGroup(fs); });
      var consent = form.elements.consent, consentOk = consent.checked;
      consent.closest(".field").classList.toggle("invalid", !consentOk);
      if (bad.length || badGroups.length || !consentOk) {
        say("err", "Please fix the highlighted fields.");
        (bad[0] || (badGroups[0] && badGroups[0].querySelector("input")) || consent).focus();
        return;
      }
      if (!A.ready) {
        say("info", "Thanks! Online forms aren’t connected yet, so this was <strong>not sent</strong>. Please email us at <a href=\"mailto:" + A.esc(C.email || "") + "\">" + A.esc(C.email || "") + "</a> instead.");
        status.focus(); return;
      }
      var val = function (n) { var el = form.elements[n]; return el && el.value != null ? String(el.value).trim() : ""; };
      var picks = function (n) { return $$('input[name="' + n + '"]:checked', form).map(function (i) { return i.value; }); };
      var data, send;
      if (isStory) {
        data = { neighborhood: val("neighborhood"), city: val("city"), needs: picks("needs"), story: val("story"), name: val("name"),
          show_name: form.elements.show_name.checked, email: val("email"), phone: val("phone"), consent: true, website: val("website") };
        send = A.submitStory(data);
      } else {
        var adult = $('input[name="adult"]:checked', form);
        data = { kind: kind, name: val("name"), email: val("email"), phone: val("phone"), organization: val("organization"),
          interests: picks("interests"), availability: picks("availability"), adult: adult ? adult.value === "true" : null,
          message: val("message"), consent: true, website: val("website") };
        send = A.submit(data);
      }
      busy = true; btn.disabled = true; btn.textContent = "Sending…"; status.className = "form-status";
      send.then(function (ref) {
        $("[data-ref]", done).textContent = ref;
        form.hidden = true; done.hidden = false; done.focus();
      }).catch(function (err) {
        say("err", A.esc(err.message) + " It was <strong>not sent</strong>. Please try again.");
        status.focus();
      }).then(function () { busy = false; btn.disabled = false; btn.innerHTML = label; });
    });

    $("[data-again]", done).addEventListener("click", function () {
      form.reset(); if (count && isStory) count.textContent = "0";
      form.hidden = false; done.hidden = true; status.className = "form-status";
      $("input:not([type=hidden])", form).focus();
    });
  });
})();
