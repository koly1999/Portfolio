/* Asset carousel enhancement.
   Baseline (no JS) is a horizontally scrollable snap row; this adds
   prev/next buttons, a slide counter, keyboard support and pointer dragging. */
(function () {
  "use strict";

  document.querySelectorAll(".carousel").forEach(function (carousel) {
    var track = carousel.querySelector(".carousel-track");
    var items = track ? track.querySelectorAll(".carousel-item") : [];
    if (!track || !items.length) return;

    var prevBtn = carousel.querySelector("[data-carousel-prev]");
    var nextBtn = carousel.querySelector("[data-carousel-next]");
    var counter = carousel.querySelector(".carousel-count");

    function step() {
      var gap = parseFloat(getComputedStyle(track).columnGap || 0) || 0;
      return items[0].getBoundingClientRect().width + gap;
    }

    function maxScroll() {
      return track.scrollWidth - track.clientWidth;
    }

    function currentIndex() {
      return Math.min(items.length - 1, Math.round(track.scrollLeft / step()));
    }

    function update() {
      if (counter) counter.textContent = currentIndex() + 1 + " / " + items.length;
      if (prevBtn) prevBtn.disabled = track.scrollLeft <= 4;
      if (nextBtn) nextBtn.disabled = track.scrollLeft >= maxScroll() - 4;
    }

    function scrollByItems(direction) {
      track.scrollBy({ left: direction * step(), behavior: "smooth" });
    }

    if (prevBtn) prevBtn.addEventListener("click", function () { scrollByItems(-1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { scrollByItems(1); });

    track.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        scrollByItems(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        scrollByItems(1);
      } else if (event.key === "Home") {
        event.preventDefault();
        track.scrollTo({ left: 0, behavior: "smooth" });
      } else if (event.key === "End") {
        event.preventDefault();
        track.scrollTo({ left: maxScroll(), behavior: "smooth" });
      }
    });

    /* Pointer dragging for mouse users (touch already scrolls natively). */
    var dragging = false;
    var dragStartX = 0;
    var dragStartScroll = 0;
    track.addEventListener("pointerdown", function (event) {
      if (event.pointerType !== "mouse") return;
      dragging = true;
      dragStartX = event.clientX;
      dragStartScroll = track.scrollLeft;
      track.setPointerCapture(event.pointerId);
    });
    track.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      track.scrollLeft = dragStartScroll - (event.clientX - dragStartX);
    });
    ["pointerup", "pointercancel"].forEach(function (type) {
      track.addEventListener(type, function () {
        dragging = false;
      });
    });
    /* Suppress the click that follows a real drag so links are not triggered. */
    track.addEventListener("click", function (event) {
      if (Math.abs(track.scrollLeft - dragStartScroll) > 8 && event.target.closest("a")) {
        event.preventDefault();
      }
    });

    var scrollScheduled = false;
    track.addEventListener("scroll", function () {
      if (scrollScheduled) return;
      scrollScheduled = true;
      requestAnimationFrame(function () {
        scrollScheduled = false;
        update();
      });
    });
    window.addEventListener("resize", update);
    update();
  });
})();
