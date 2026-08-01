/* SEND IT! page: scroll-linked paper airplane, cloud parallax,
   and the landing reveal. All movement is transform-only and
   throttled through requestAnimationFrame. */
(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Landed plane reveal (runs for everyone with JS) ------------------------ */
  var landedPlane = document.getElementById("landed-plane");
  var ground = document.querySelector(".ground");

  function settleLanding() {
    if (landedPlane) landedPlane.classList.add("is-landed");
    if (ground) ground.classList.add("is-settled");
  }

  if (landedPlane && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          /* small delay so the flying plane "arrives" first */
          window.setTimeout(settleLanding, reducedMotion ? 0 : 320);
          observer.disconnect();
        }
      });
    }, { threshold: 0.4 }).observe(landedPlane);
  } else if (landedPlane) {
    settleLanding();
  }

  if (reducedMotion) return; /* static fallbacks are handled in CSS */

  /* ---- Flight path -------------------------------------------------------------- */
  /* Two broad Bezier passes echo the animation: a short exit, then one long
     landing approach. The plane is hidden between passes instead of reversing
     direction on screen. Coordinates are fractions of the viewport. */
  var FLIGHT_LEGS = [
    {
      start: 0,
      end: 0.14,
      from: { x: 0.72, y: 0.17 },
      control1: { x: 0.84, y: 0.08 },
      control2: { x: 1.04, y: 0.12 },
      to: { x: 1.14, y: 0.22 }
    },
    {
      start: 0.20,
      end: 0.97,
      from: { x: 1.12, y: 0.20 },
      control1: { x: 0.84, y: 0.16 },
      control2: { x: 0.58, y: 0.52 },
      to: { x: 0.17, y: 0.77 }
    }
  ];

  var plane = document.getElementById("flight-plane");
  var clouds = document.querySelectorAll("[data-parallax]");
  var ticking = false;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function cubic(a, b, c, d, t) {
    var inverse = 1 - t;
    return inverse * inverse * inverse * a +
      3 * inverse * inverse * t * b +
      3 * inverse * t * t * c +
      t * t * t * d;
  }

  function cubicDerivative(a, b, c, d, t) {
    var inverse = 1 - t;
    return 3 * inverse * inverse * (b - a) +
      6 * inverse * t * (c - b) +
      3 * t * t * (d - c);
  }

  function poseOnLeg(leg, progress) {
    var t = clamp((progress - leg.start) / (leg.end - leg.start), 0, 1);
    var dx = cubicDerivative(leg.from.x, leg.control1.x, leg.control2.x, leg.to.x, t);
    var dy = cubicDerivative(leg.from.y, leg.control1.y, leg.control2.y, leg.to.y, t);
    var angle = Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI;
    if (dx < 0) angle *= -1;

    return {
      x: cubic(leg.from.x, leg.control1.x, leg.control2.x, leg.to.x, t),
      y: cubic(leg.from.y, leg.control1.y, leg.control2.y, leg.to.y, t),
      r: clamp(angle, -24, 24),
      reverse: dx < 0,
      active: true
    };
  }

  function planePose(progress) {
    if (progress <= FLIGHT_LEGS[0].end) return poseOnLeg(FLIGHT_LEGS[0], progress);
    if (progress >= FLIGHT_LEGS[1].start && progress <= FLIGHT_LEGS[1].end) {
      return poseOnLeg(FLIGHT_LEGS[1], progress);
    }
    var restingLeg = progress < FLIGHT_LEGS[1].start ? FLIGHT_LEGS[0] : FLIGHT_LEGS[1];
    var pose = poseOnLeg(restingLeg, restingLeg.end);
    pose.active = false;
    return pose;
  }

  function paint() {
    ticking = false;
    var doc = document.documentElement;
    var landingPoint = ground ? ground.offsetTop - window.innerHeight * 0.55 : doc.scrollHeight - window.innerHeight;
    var progress = landingPoint > 0 ? clamp(window.scrollY / landingPoint, 0, 1) : 0;

    if (plane) {
      var pose = planePose(progress);
      var w = plane.offsetWidth || 80;
      var px = pose.x * (window.innerWidth - w);
      var py = pose.y * (window.innerHeight - plane.offsetHeight);
      var flip = pose.reverse ? " scaleX(-1)" : "";
      plane.style.transform =
        "translate3d(" + px.toFixed(1) + "px," + py.toFixed(1) + "px,0) rotate(" + pose.r.toFixed(1) + "deg)" + flip;
      plane.classList.toggle("is-flying", pose.active);
    }

    clouds.forEach(function (cloud) {
      var factor = parseFloat(cloud.getAttribute("data-parallax")) || 0.05;
      cloud.style.transform = "translate3d(0," + (-window.scrollY * factor).toFixed(1) + "px,0)";
    });
  }

  function requestPaint() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(paint);
    }
  }

  if (plane || clouds.length) {
    window.addEventListener("scroll", requestPaint, { passive: true });
    window.addEventListener("resize", requestPaint);
    requestPaint();
  }
})();
