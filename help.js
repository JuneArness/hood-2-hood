/* Hood 2 Hood Rydas | help.js : the "Print this page" button on help.html. */
(function () {
  "use strict";
  var b = document.querySelector("[data-print]");
  if (b) b.addEventListener("click", function () { window.print(); });
})();
