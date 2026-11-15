/* ==========================================================================
   Hood 2 Hood Rydas | voices.js : the wall of approved neighborhood stories.
   Only stories staff approved in Admin > Voices are shown, and never with an
   email or phone number.
   ========================================================================== */
(function () {
  "use strict";
  var A = window.HAPI; if (!A) return;
  var wall = document.querySelector("[data-stories]"); if (!wall) return;
  var esc = A.esc;
  function empty(msg) { wall.innerHTML = '<div class="empty-state" style="column-span:all"><p>' + msg + "</p></div>"; }
  if (!A.ready) return empty("<strong>Be the first voice.</strong> Stories will appear here once the club reviews them. Share yours below.");
  A.stories().then(function (list) {
    if (!list || !list.length) return empty("<strong>No stories posted yet.</strong> Be the first to speak for your block below.");
    wall.innerHTML = list.map(function (s) {
      var where = [s.neighborhood, s.city].filter(Boolean).join(", ");
      return '<article class="story"><blockquote>' + A.multiline(s.story) + "</blockquote><footer>" +
        "<strong>" + esc(where) + "</strong>" + (s.name ? "<span>— " + esc(s.name) + "</span>" : "") +
        (s.needs && s.needs.length ? '<ul class="tags" aria-label="Needs">' + s.needs.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>" : "") +
        "</footer></article>";
    }).join("");
  }).catch(function () { empty("Stories couldn’t load right now. Please refresh in a minute."); });
})();
