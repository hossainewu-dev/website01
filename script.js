(function () {
  "use strict";

  /* ==========================================================
     Settings
     ----------------------------------------------------------
     FORM_ENDPOINT: URL that accepts the contact form as JSON
     (your own backend, or a form service). While it is empty the
     form runs in demo mode and sends nothing.
     ========================================================== */
  var FORM_ENDPOINT = "";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- Footer year ---------- */
  var yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ==========================================================
     Navigation: mobile drawer + Solutions dropdown
     ========================================================== */
  var nav = $("#primaryNav");
  var toggle = $("#navToggle");
  var overlay = $("#navOverlay");
  var dropdownItems = $$(".has-dropdown");

  function closeDropdowns(except) {
    dropdownItems.forEach(function (item) {
      if (item === except) return;
      item.classList.remove("open");
      var btn = $(".dd-toggle", item);
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  }

  function setNav(open) {
    nav.classList.toggle("open", open);
    overlay.hidden = !open;
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (!open) closeDropdowns();
  }

  toggle.addEventListener("click", function () { setNav(!nav.classList.contains("open")); });
  overlay.addEventListener("click", function () { setNav(false); });

  $$("a", nav).forEach(function (link) {
    link.addEventListener("click", function () {
      closeDropdowns();
      if (nav.classList.contains("open")) setNav(false);
    });
  });

  dropdownItems.forEach(function (item) {
    var btn = $(".dd-toggle", item);
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var willOpen = !item.classList.contains("open");
      closeDropdowns(item);
      item.classList.toggle("open", willOpen);
      btn.setAttribute("aria-expanded", String(willOpen));
    });
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".has-dropdown")) closeDropdowns();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (nav.classList.contains("open")) { setNav(false); toggle.focus(); }
    else closeDropdowns();
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 980 && nav.classList.contains("open")) setNav(false);
  });

  /* ---------- Highlight the current section in the menu ---------- */
  var navLinks = $$(".nav-link");
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          link.classList.toggle("active", link.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-40% 0px -55% 0px" });

    navLinks.forEach(function (link) {
      var target = $(link.getAttribute("href"));
      if (target) spy.observe(target);
    });
  }

  /* ==========================================================
     Industries tabs
     ========================================================== */
  var tabs = $$('[role="tab"]');

  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var selected = t === tab;
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !selected;
    });
    if (focus) tab.focus();
  }

  if (tabs.length) {
    selectTab(tabs[0], false);

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { selectTab(tab, false); });
      tab.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === "Home") next = tabs[0];
        else if (e.key === "End") next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); selectTab(next, true); }
      });
    });
  }

  /* ==========================================================
     Hero illustration: what a digital seal does
     Hashes the visible text of the sample document. Changing the
     amount changes the fingerprint, so the check fails. No real
     signature or certificate is involved.
     ========================================================== */
  var docEl = $("#doc");
  if (docEl) {
    var amountEl = $("#amount");
    var sealEl = $("#seal");
    var stepEls = $$("#verifySteps li");
    var fpSealed = $("#fpSealed");
    var fpCurrent = $("#fpCurrent");
    var statusEl = $("#verifyStatus");
    var btnVerify = $("#btnVerify");
    var btnTamper = $("#btnTamper");

    var ORIGINAL = "BDT 500,000";
    var CHANGED = "BDT 5,000,000";
    var edited = false;
    var sealedHash = "";
    var currentHash = "";
    var running = false;

    var docText = function () {
      return $$(".doc-title, .doc-line", docEl)
        .map(function (el) { return el.textContent.replace(/\s+/g, " ").trim(); })
        .join("\n");
    };

    var fallbackHash = function (str) {
      var out = "";
      for (var s = 0; s < 8; s++) {
        var h = (0x811c9dc5 ^ Math.imul(s + 1, 0x9e3779b1)) >>> 0;
        for (var i = 0; i < str.length; i++) {
          h ^= str.charCodeAt(i);
          h = Math.imul(h, 0x01000193) >>> 0;
        }
        out += ("00000000" + h.toString(16)).slice(-8);
      }
      return out;
    };

    var digest = function (text) {
      if (window.crypto && window.crypto.subtle && window.TextEncoder) {
        return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buf) {
          return Array.prototype.map.call(new Uint8Array(buf), function (b) {
            return ("0" + b.toString(16)).slice(-2);
          }).join("");
        });
      }
      return Promise.resolve(fallbackHash(text));
    };

    var short = function (h) { return h.slice(0, 8) + "…" + h.slice(-8); };

    var setStatus = function (text, kind) {
      statusEl.textContent = text;
      statusEl.className = "verify-status" + (kind ? " " + kind : "");
    };

    var resetChecks = function () {
      stepEls.forEach(function (li) { li.setAttribute("data-state", "idle"); });
      sealEl.setAttribute("data-state", "idle");
    };

    var refreshFingerprint = function () {
      return digest(docText()).then(function (h) {
        currentHash = h;
        fpCurrent.textContent = short(h);
        fpCurrent.classList.toggle("diff", sealedHash && h !== sealedHash);
      });
    };

    digest(docText()).then(function (h) {
      sealedHash = h;
      fpSealed.textContent = short(h);
      return refreshFingerprint();
    });

    btnTamper.addEventListener("click", function () {
      if (running) return;
      edited = !edited;
      amountEl.textContent = edited ? CHANGED : ORIGINAL;
      docEl.classList.toggle("is-edited", edited);
      btnTamper.textContent = edited ? "Restore the amount" : "Change the amount";
      resetChecks();
      refreshFingerprint();
      setStatus(
        edited
          ? "The amount now reads " + CHANGED + ". Verify the document to see what happens."
          : "Amount restored. Verify again to confirm it matches the signed version.",
        ""
      );
    });

    btnVerify.addEventListener("click", function () {
      if (running) return;
      running = true;
      btnVerify.disabled = true;
      btnTamper.disabled = true;
      resetChecks();
      setStatus("Checking the document.", "");

      var matches = currentHash === sealedHash;
      var gap = reduceMotion ? 0 : 520;

      stepEls.forEach(function (li, i) {
        window.setTimeout(function () { li.setAttribute("data-state", "running"); }, i * gap);
        window.setTimeout(function () {
          li.setAttribute("data-state", matches ? "pass" : "fail");
        }, i * gap + (reduceMotion ? 0 : 400));
      });

      window.setTimeout(function () {
        sealEl.setAttribute("data-state", matches ? "pass" : "fail");
        setStatus(
          matches
            ? "Verified. The document is unchanged since it was signed."
            : "Verification failed. The content no longer matches the signature and seal.",
          matches ? "pass" : "fail"
        );
        running = false;
        btnVerify.disabled = false;
        btnTamper.disabled = false;
      }, (stepEls.length - 1) * gap + (reduceMotion ? 0 : 450));
    });
  }

  /* ==========================================================
     Solution links preselect the matching interest in the form
     ========================================================== */
  $$("[data-interest]").forEach(function (link) {
    link.addEventListener("click", function () {
      var wanted = link.getAttribute("data-interest");
      $$('input[name="interest"]').forEach(function (box) {
        if (box.value === wanted) box.checked = true;
      });
    });
  });

  /* ==========================================================
     Contact form
     ========================================================== */
  var form = $("#contactForm");
  if (form) {
    var statusOut = $("#formStatus");
    var submitBtn = $("#submitBtn");
    var submitLabel = $(".btn-label", submitBtn);
    var counter = $("#msgCount");
    var messageEl = $("#message");

    var rules = {
      name: function (v) { return v.trim() ? "" : "Enter your full name."; },
      email: function (v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "Enter a valid email address, like name@company.com.";
      },
      phone: function (v) {
        return !v.trim() || /^\+?[\d\s\-()]{7,20}$/.test(v.trim())
          ? "" : "Use digits, spaces, + or dashes only, for example +880 1XXX-XXXXXX.";
      },
      organization: function (v) { return v.trim() ? "" : "Enter your organization's name."; },
      message: function (v) {
        return v.trim().length >= 10 ? "" : "Write at least 10 characters so we understand your request.";
      }
    };

    var setError = function (id, message) {
      var input = document.getElementById(id);
      var out = document.getElementById("err-" + id);
      var field = input.closest(".field");
      if (field) field.classList.toggle("invalid", Boolean(message));
      input.setAttribute("aria-invalid", message ? "true" : "false");
      if (out) out.textContent = message || "";
    };

    var validateField = function (id) {
      var message = rules[id](document.getElementById(id).value);
      setError(id, message);
      return !message;
    };

    var validateConsent = function () {
      var box = document.getElementById("consent");
      var message = box.checked ? "" : "Confirm that we may contact you about this request.";
      setError("consent", message);
      return !message;
    };

    Object.keys(rules).forEach(function (id) {
      var el = document.getElementById(id);
      el.addEventListener("blur", function () { if (el.value) validateField(id); });
      el.addEventListener("input", function () {
        if (el.getAttribute("aria-invalid") === "true") validateField(id);
      });
    });
    document.getElementById("consent").addEventListener("change", validateConsent);

    messageEl.addEventListener("input", function () {
      counter.textContent = messageEl.value.length + " / 1000";
    });

    var setStatusOut = function (text, kind) {
      statusOut.textContent = text;
      statusOut.className = "form-status" + (kind ? " " + kind : "");
    };

    var setSending = function (sending) {
      submitBtn.disabled = sending;
      submitLabel.textContent = sending ? "Sending" : "Send message";
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setStatusOut("", "");

      var results = Object.keys(rules).map(validateField);
      results.push(validateConsent());
      if (results.indexOf(false) !== -1) {
        var firstBad = $('[aria-invalid="true"]', form);
        if (firstBad) firstBad.focus();
        setStatusOut("Some fields need your attention. Check the messages above.", "err");
        return;
      }

      // Spam trap: bots fill hidden fields. Pretend it worked.
      if (form.elements.website && form.elements.website.value) {
        form.reset();
        setStatusOut("Message sent.", "ok");
        return;
      }

      var payload = {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        phone: form.elements.phone.value.trim(),
        organization: form.elements.organization.value.trim(),
        sector: form.elements.sector.value,
        interests: $$('input[name="interest"]:checked', form).map(function (b) { return b.value; }),
        message: form.elements.message.value.trim()
      };

      var done = function () {
        form.reset();
        counter.textContent = "0 / 1000";
        setStatusOut("Message sent. We will reply to " + payload.email + ".", "ok");
      };

      if (!FORM_ENDPOINT) {
        // Demo mode: nothing leaves the browser.
        done();
        setStatusOut("Demo mode: nothing was sent. Set FORM_ENDPOINT in script.js to receive messages.", "ok");
        return;
      }

      setSending(true);
      fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        done();
      }).catch(function () {
        setStatusOut("Message not sent. Check your connection and try again, or email info@example.com.", "err");
      }).then(function () {
        setSending(false);
      });
    });
  }
})();
