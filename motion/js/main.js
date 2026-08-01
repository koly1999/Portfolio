/* Shared behaviour: mobile nav, scroll reveals, lightbox, preview-video pausing. */
(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---- Mobile navigation ------------------------------------------------ */
  var toggle = document.querySelector(".nav-toggle");
  var navList = document.querySelector(".nav-list");

  function closeMenu() {
    if (!toggle || !navList) return;
    navList.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  if (toggle && navList) {
    toggle.addEventListener("click", function () {
      var open = navList.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    navList.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && navList.classList.contains("is-open")) {
        closeMenu();
        toggle.focus();
      }
    });
  }

  /* ---- Scroll reveals ----------------------------------------------------- */
  var revealTargets = document.querySelectorAll(".reveal");
  if (revealTargets.length && "IntersectionObserver" in window && !reducedMotion.matches) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    revealTargets.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    revealTargets.forEach(function (el) {
      el.classList.add("is-in");
    });
  }

  /* ---- Muted preview videos: play only while on screen ---------------------- */
  var previews = document.querySelectorAll("video[data-preview]");
  if (previews.length) {
    if (reducedMotion.matches) {
      previews.forEach(function (video) {
        video.removeAttribute("autoplay");
        video.pause();
      });
    } else if ("IntersectionObserver" in window) {
      var previewObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var video = entry.target;
            if (entry.isIntersecting) {
              var playing = video.play();
              if (playing && playing.catch) playing.catch(function () {});
            } else {
              video.pause();
            }
          });
        },
        { threshold: 0.2 }
      );
      previews.forEach(function (video) {
        previewObserver.observe(video);
      });
    }
  }

  /* ---- Landing page: active project rail -------------------------------------- */
  var rail = document.querySelector(".work-rail");
  var portals = document.querySelectorAll(".portal[id]");
  if (rail && portals.length && "IntersectionObserver" in window) {
    var railLinks = rail.querySelectorAll("a");
    var portalObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var link = rail.querySelector('a[href="#' + entry.target.id + '"]');
          if (!link) return;
          if (entry.isIntersecting) {
            railLinks.forEach(function (a) {
              a.classList.remove("is-active");
            });
            link.classList.add("is-active");
            rail.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.4 }
    );
    portals.forEach(function (portal) {
      portalObserver.observe(portal);
    });
    /* Hide the rail while the hero is on screen. */
    var hero = document.querySelector(".home-hero");
    if (hero) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) rail.classList.remove("is-visible");
        });
      }, { threshold: 0.5 }).observe(hero);
    }
  }

  /* ---- Lightbox (native <dialog>) -------------------------------------------- */
  /* Triggers are plain links to the full-size image, so everything still works
     without JavaScript. */
  var lightbox = document.querySelector("dialog.lightbox");
  if (lightbox && typeof lightbox.showModal === "function") {
    var lbImage = lightbox.querySelector("img");
    var lbCaption = lightbox.querySelector("figcaption");
    var lbCount = lightbox.querySelector("[data-lightbox-count]");
    var triggers = Array.prototype.slice.call(document.querySelectorAll("a[data-lightbox]"));
    var current = -1;

    function show(index) {
      if (!triggers.length) return;
      current = (index + triggers.length) % triggers.length;
      var link = triggers[current];
      var img = link.querySelector("img");
      lbImage.src = link.getAttribute("href");
      lbImage.alt = img ? img.alt : "";
      lbCaption.textContent = link.getAttribute("data-caption") || (img ? img.alt : "");
      if (lbCount) lbCount.textContent = current + 1 + " / " + triggers.length;
    }

    triggers.forEach(function (link, index) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        show(index);
        lightbox.showModal();
      });
    });

    lightbox.addEventListener("click", function (event) {
      var action = event.target.closest("[data-lightbox-action]");
      if (action) {
        var kind = action.getAttribute("data-lightbox-action");
        if (kind === "close") lightbox.close();
        if (kind === "prev") show(current - 1);
        if (kind === "next") show(current + 1);
        return;
      }
      /* Click on the backdrop closes. */
      if (event.target === lightbox) lightbox.close();
    });

    lightbox.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") show(current - 1);
      if (event.key === "ArrowRight") show(current + 1);
    });

    lightbox.addEventListener("close", function () {
      if (current >= 0 && triggers[current]) triggers[current].focus();
      lbImage.removeAttribute("src");
    });
  }
})();
