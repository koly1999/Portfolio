/* CELSIUS page: carbonation bubbles (paused off-screen), pointer-follow can,
   and the scroll-linked rolling orange divider. */
(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return; /* every effect below is decorative motion */

  /* ---- Bubbles + slow orange spin: only animate while the hero is visible ---- */
  var hero = document.querySelector(".fizz-hero");
  var spinner = document.querySelector("[data-spin]");
  if (hero && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        hero.classList.toggle("is-fizzing", entry.isIntersecting);
        if (spinner) spinner.classList.toggle("is-spinning", entry.isIntersecting);
      });
    }, { threshold: 0.05 }).observe(hero);
  }

  /* ---- Can shifts slightly with pointer movement over the hero ------------------ */
  var can = document.getElementById("hero-can");
  if (hero && can && window.matchMedia("(pointer: fine)").matches) {
    var canTicking = false;
    var pointerX = 0;
    var pointerY = 0;
    hero.addEventListener("pointermove", function (event) {
      var rect = hero.getBoundingClientRect();
      pointerX = (event.clientX - rect.left) / rect.width - 0.5;
      pointerY = (event.clientY - rect.top) / rect.height - 0.5;
      if (!canTicking) {
        canTicking = true;
        requestAnimationFrame(function () {
          canTicking = false;
          can.style.transform =
            "translate(" + (pointerX * 14).toFixed(1) + "px," + (pointerY * 10).toFixed(1) + "px)" +
            " rotate(" + (pointerX * 2.4).toFixed(2) + "deg)";
        });
      }
    });
    hero.addEventListener("pointerleave", function () {
      can.style.transform = "";
    });
  }

  /* ---- Rolling orange: rolls across its band as the band crosses the viewport ---- */
  var band = document.getElementById("roll-band");
  var orange = document.getElementById("roll-orange");
  if (band && orange) {
    var rollTicking = false;

    function rollPaint() {
      rollTicking = false;
      var rect = band.getBoundingClientRect();
      var vh = window.innerHeight;
      /* 0 when the band enters at the bottom, 1 when it leaves at the top */
      var progress = Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height)));
      var travel = band.clientWidth - orange.clientWidth;
      var x = progress * travel;
      var rotations = travel / (Math.PI * orange.clientWidth);
      orange.style.transform = "translateX(" + x.toFixed(1) + "px) rotate(" + (progress * rotations * 360).toFixed(1) + "deg)";
    }

    function requestRoll() {
      if (!rollTicking) {
        rollTicking = true;
        requestAnimationFrame(rollPaint);
      }
    }

    window.addEventListener("scroll", requestRoll, { passive: true });
    window.addEventListener("resize", requestRoll);
    requestRoll();
  }
})();
