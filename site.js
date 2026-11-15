/* ==========================================================================
   Hood 2 Hood Rydas | site.js : menu, footer year, contact details,
   scroll reveals and the muted featured clip. Runs on every page.
   ========================================================================== */
(function () {
  "use strict";
  var C = window.H2H || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("js");

  // mobile menu
  var btn = $("[data-menu]"), nav = $("#mobile-nav");
  function setMenu(open) {
    if (!btn || !nav) return;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    nav.hidden = !open; document.body.classList.toggle("lock", open);
    if (open) { var a = nav.querySelector("a"); if (a) a.focus(); }
  }
  if (btn) {
    btn.addEventListener("click", function () { setMenu(btn.getAttribute("aria-expanded") !== "true"); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !nav.hidden) { setMenu(false); btn.focus(); } });
    matchMedia("(min-width: 1061px)").addEventListener("change", function (m) { if (m.matches) setMenu(false); });
  }

  // footer year
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // contact details from data.js
  var email = /^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/.test(C.email || "") ? C.email : "";
  if (email) {
    $$("[data-email]").forEach(function (el) { el.textContent = email; });
    $$("[data-email-card]").forEach(function (el) { el.href = "mailto:" + email; });
  }
  var phone = String(C.phone || "").trim();
  if (phone && /^[\d\s()+.-]{7,20}$/.test(phone)) {
    $$("[data-phone]").forEach(function (el) { el.textContent = phone; });
    $$("[data-phone-card]").forEach(function (el) {
      var a = document.createElement("a"); a.className = el.className; a.href = "tel:" + phone.replace(/[^\d+]/g, ""); a.innerHTML = el.innerHTML; a.hidden = false;
      el.parentNode.replaceChild(a, el);
    });
  }

  // reveal on scroll
  var rv = $$(".reveal");
  if (reduce || !("IntersectionObserver" in window)) rv.forEach(function (el) { el.classList.add("in"); });
  else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    rv.forEach(function (el, i) { el.style.transitionDelay = (i % 4) * 80 + "ms"; io.observe(el); });
  }

  // muted clip: plays only while on screen, never with reduced motion (then it shows controls)
  $$("video[data-autoplay]").forEach(function (v) {
    if (reduce || !("IntersectionObserver" in window)) { v.controls = true; return; }
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () { v.controls = true; }); } else v.pause(); });
    }, { threshold: 0.3 }).observe(v);
  });
})();
