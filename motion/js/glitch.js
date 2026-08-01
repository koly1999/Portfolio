/* Digital Glitch page: CRT boot loader, screen-texture toggle,
   status readout, and a one-off title glitch. */
(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Boot loader --------------------------------------------------------- */
  var loader = document.getElementById("boot-loader");
  var SEEN_KEY = "dg-boot-seen";
  var seen = false;
  try {
    seen = sessionStorage.getItem(SEEN_KEY) === "1";
  } catch (error) {
    seen = true; /* storage blocked: never replay-loop the intro */
  }

  var timers = [];
  function later(fn, ms) {
    timers.push(window.setTimeout(fn, ms));
  }

  function finishLoader() {
    if (!loader || loader.classList.contains("is-done")) return;
    timers.forEach(clearTimeout);
    loader.classList.add("is-done");
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch (error) { /* ignore */ }
    window.setTimeout(function () {
      loader.remove();
      glitchTitle();
    }, 500);
  }

  function glitchTitle() {
    var title = document.querySelector("[data-glitch-title]");
    if (!title || reducedMotion) return;
    title.classList.add("is-glitching");
    window.setTimeout(function () {
      title.classList.remove("is-glitching");
    }, 1200);
  }

  if (loader && !reducedMotion && !seen) {
    loader.hidden = false;
    var skip = loader.querySelector("[data-boot-skip]");
    if (skip) skip.addEventListener("click", finishLoader);
    document.addEventListener("keydown", function onKey(event) {
      if (event.key === "Escape") {
        finishLoader();
        document.removeEventListener("keydown", onKey);
      }
    });

    /* power flicker -> CRT line -> screen opens -> boot text -> title -> done */
    later(function () { loader.classList.add("step-flicker"); }, 120);
    later(function () { loader.classList.add("step-line"); }, 260);
    later(function () { loader.classList.add("step-open"); }, 500);
    later(function () { loader.classList.add("step-text"); }, 760);
    later(function () { loader.classList.add("step-title"); }, 1500);
    later(finishLoader, 2050);
    /* hard safety: never block the page longer than 4s no matter what */
    later(finishLoader, 4000);
  } else if (loader) {
    loader.remove();
    if (!seen) glitchTitle();
  }

  /* ---- CRT screen-texture toggle --------------------------------------------- */
  var crtToggle = document.querySelector("[data-crt-toggle]");
  var crtScreen = document.getElementById("crt-screen");
  if (crtToggle && crtScreen) {
    crtToggle.addEventListener("click", function () {
      var on = crtScreen.classList.toggle("crt-on");
      crtToggle.setAttribute("aria-pressed", on ? "true" : "false");
      crtToggle.textContent = on ? "[ SCREEN TEXTURE: ON ]" : "[ SCREEN TEXTURE: OFF ]";
    });
  }

  /* ---- Status readout updates as sections enter -------------------------------- */
  var readout = document.querySelector("[data-readout]");
  var labelled = document.querySelectorAll("[data-section-label]");
  if (readout && labelled.length && "IntersectionObserver" in window) {
    var readoutObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            readout.textContent = entry.target.getAttribute("data-section-label");
          }
        });
      },
      { rootMargin: "-30% 0px -55% 0px" }
    );
    labelled.forEach(function (section) {
      readoutObserver.observe(section);
    });
  }
})();
