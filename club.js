/* ==========================================================================
   Hood 2 Hood Rydas | club.js : "Meet the Rydas" on the Home page.
   Shows published members from Admin > Members. Until there are any, it
   shows the leaders listed in data.js.
   ========================================================================== */
(function () {
  "use strict";
  var A = window.HAPI, C = window.H2H || {};
  var box = document.querySelector("[data-leaders]");
  if (!A || !box) return;
  var esc = A.esc;
  function draw(list) {
    if (!list || !list.length) return;
    box.innerHTML = list.map(function (m) {
      var u = m.photo ? A.photoUrl(m.photo) : "";
      var initial = (String(m.name || "").trim()[0] || "H").toUpperCase();
      return '<div class="leader in">' +
        (u ? '<img class="member-pic" src="' + esc(u) + '" alt="" loading="lazy" decoding="async">' : '<div class="monogram" aria-hidden="true">' + esc(initial) + "</div>") +
        "<h3>" + esc(m.name) + "</h3>" + (m.role ? "<p>" + esc(m.role) + "</p>" : "") +
        (m.ride ? '<p class="member-ride">Rides: ' + esc(m.ride) + "</p>" : "") +
        (m.bio ? '<p class="member-bio">' + esc(m.bio) + "</p>" : "") + "</div>";
    }).join("");
    box.classList.toggle("many", list.length > 3);
  }
  if (!A.ready) return;   // the founders in the page already come from data.js
  A.rpc("list_members").then(draw).catch(function () {});
})();
