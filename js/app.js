/* =========================================================================
   Hinglish Sells? — main experiment engine (vanilla JS, no build step).

   Participant journey:
     consent → screening → instructions + brand introduction → 24 × (fixation →
     ad for exactly 10 s → ratings) → luxury–necessity manipulation check →
     cover-story check → language background (LEAP-Q adapted) → language
     favourability → demographics → hypothesis-awareness probe → submit → debrief

   URL parameters:
     ?v=lab | ?v=online           study version (default online)
     ?autotest=1                  QA autopilot (random answers; data flagged is_test=1)
     ?autotest=1&fast=1           QA autopilot with 300 ms exposure (pipeline tests only)
   ========================================================================= */
(function () {
  "use strict";
  const cfg = window.STUDY, Q = window.QUESTIONNAIRE;
  const params = new URLSearchParams(location.search);
  const AUTOTEST = params.get("autotest") === "1";
  const FAST = AUTOTEST && params.get("fast") === "1";
  const EXPOSURE_MS = FAST ? 300 : cfg.exposureMs;
  const VERSION = cfg.versions.includes(params.get("v")) ? params.get("v") : "online";

  const app = document.getElementById("app");
  const bar = document.getElementById("progress-fill");
  const barLabel = document.getElementById("progress-label");

  /* ---------------- state ---------------- */
  const S = {
    session: {
      participant_id: makeId(), version: VERSION, study_id: cfg.studyId,
      is_test: AUTOTEST ? 1 : 0, fast_mode: FAST ? 1 : 0,
      started_at: new Date().toISOString(), user_agent: navigator.userAgent,
      screen_w: window.screen.width, screen_h: window.screen.height,
      viewport_w: innerWidth, viewport_h: innerHeight,
      device: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop",
      touch: ("ontouchstart" in window) ? 1 : 0
    },
    trials: [],
    sequence: null,
    t0: performance.now()
  };

  function makeId() {
    const a = new Uint8Array(6); crypto.getRandomValues(a);
    return "P" + Array.from(a, b => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
  }
  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const nextFrame = () => new Promise(r => requestAnimationFrame(r));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------------- progress (weights reflect expected time) ---------------- */
  const STEPS = { consent: 2, screening: 4, intro: 8, trials: 82, manip: 86, lang: 93, demo: 97, done: 100 };
  const SLOTS = Object.keys(cfg.products);   // N1..N4, L1..L4
  let adsReady = Promise.resolve({ ok: false, failed: ["not started"], ms: 0 });
  function progress(pct, label) {
    bar.style.width = pct + "%";
    barLabel.textContent = label || "";
  }

  /* ---------------- no going back / accidental exit ---------------- */
  history.pushState({ s: 1 }, "");
  addEventListener("popstate", () => {
    history.pushState({ s: 1 }, "");
    toast("Going back is not possible in this study. Please continue.");
  });
  let guardExit = false;
  addEventListener("beforeunload", e => { if (guardExit) { e.preventDefault(); e.returnValue = ""; } });

  function toast(msg) {
    const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
  }

  /* ---------------- generic screen helpers ---------------- */
  function screen(html, opts = {}) {
    app.innerHTML = `<section class="card ${opts.wide ? "wide" : ""}">${html}</section>`;
    app.scrollTop = 0; scrollTo(0, 0);
    return app.firstElementChild;
  }

  function waitClick(el, autofill) {
    return new Promise(resolve => {
      el.addEventListener("click", () => resolve(), { once: true });
      if (AUTOTEST) setTimeout(() => { if (autofill) autofill(); el.click(); }, 30);
    });
  }

  /** Render a list of question definitions into `container`; returns {values(), valid(), autofill()} */
  function renderQuestions(container, defs) {
    const getters = {};
    defs.forEach(d => {
      const w = document.createElement("div");
      w.className = "q"; w.dataset.qid = d.id;
      if (d.showIf) w.dataset.showIf = JSON.stringify(d.showIf);
      let inner = `<div class="q-text">${d.q}${d.required ? "" : " <span class='opt'>(optional)</span>"}</div>`;
      if (d.type === "radio") {
        const opts = d.shuffle ? shuffle(d.options) : d.options;
        inner += `<div class="choices">` + opts.map(o =>
          `<label class="choice"><input type="radio" name="${d.id}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join("") + `</div>`;
        getters[d.id] = () => { const c = w.querySelector("input:checked"); return c ? c.value : ""; };
      } else if (d.type === "number") {
        inner += `<input class="num" type="number" inputmode="numeric" min="${d.min}" max="${d.max}" name="${d.id}">`;
        getters[d.id] = () => { const v = w.querySelector("input").value; return v === "" ? "" : Number(v); };
      } else if (d.type === "scale") {
        inner += scaleRow(d.id, d.points, d.start || 1, d.left, d.right);
        getters[d.id] = () => { const c = w.querySelector("input:checked"); return c ? Number(c.value) : ""; };
      } else if (d.type === "percent3") {
        inner += `<div class="pct">` + d.labels.map((l, i) =>
          `<label>${l}<input type="number" min="0" max="100" inputmode="numeric" data-i="${i}">%</label>`).join("") +
          `<div class="pct-total">Total: <b>0</b>%</div></div>`;
        getters[d.id] = () => Array.from(w.querySelectorAll("input")).map(x => x.value === "" ? "" : Number(x.value));
      } else if (d.type === "text") {
        inner += d.long ? `<textarea rows="3" maxlength="600"></textarea>` : `<input type="text" maxlength="80">`;
        getters[d.id] = () => w.querySelector("textarea,input").value.trim();
      }
      w.innerHTML = inner;
      container.appendChild(w);
      if (d.type === "percent3") {
        w.addEventListener("input", () => {
          const tot = getters[d.id]().reduce((s, v) => s + (Number(v) || 0), 0);
          const b = w.querySelector(".pct-total b"); b.textContent = tot;
          b.parentElement.classList.toggle("bad", tot !== 100);
        });
      }
    });
    const refresh = () => {
      container.querySelectorAll("[data-show-if]").forEach(w => {
        const cond = JSON.parse(w.dataset.showIf);
        const show = Object.entries(cond).every(([k, v]) => getters[k] && getters[k]() === v);
        w.style.display = show ? "" : "none"; w.dataset.hidden = show ? "" : "1";
      });
    };
    container.addEventListener("change", refresh); refresh();

    function values() {
      const out = {};
      defs.forEach(d => {
        const el = container.querySelector(`[data-qid="${d.id}"]`);
        if (el.dataset.hidden === "1") { out[d.id] = ""; return; }
        const v = getters[d.id]();
        if (d.type === "percent3") d.labels.forEach((l, i) => out[`${d.id}_${l.split(" ")[0].toLowerCase()}`] = v[i]);
        else out[d.id] = v;
      });
      return out;
    }
    function valid() {
      let ok = true;
      defs.forEach(d => {
        const el = container.querySelector(`[data-qid="${d.id}"]`);
        if (el.dataset.hidden === "1" || !d.required) { el.classList.remove("missing"); return; }
        const v = getters[d.id]();
        let good = v !== "" && v !== null;
        if (d.type === "number") good = good && v >= d.min && v <= d.max;
        if (d.type === "percent3") good = v.every(x => x !== "") && v.reduce((s, x) => s + x, 0) === 100;
        el.classList.toggle("missing", !good); if (!good) ok = false;
      });
      return ok;
    }
    function autofill() {
      defs.forEach(d => {
        const el = container.querySelector(`[data-qid="${d.id}"]`);
        if (d.type === "radio") {
          const inputs = el.querySelectorAll("input");
          let pick = inputs[rnd(inputs.length)];
          if (d.correct) pick = Array.from(inputs).find(x => x.value === d.correct);
          if (d.id === "student") pick = inputs[0];
          if (d.id === "prior") pick = Array.from(inputs).find(x => x.value === "No");
          pick.checked = true;
        } else if (d.type === "number") el.querySelector("input").value = d.id === "age" ? 18 + rnd(8) : rnd(10);
        else if (d.type === "scale") { const i = el.querySelectorAll("input"); i[rnd(i.length)].checked = true; }
        else if (d.type === "percent3") { const a = 30 + rnd(40), b = Math.min(100 - a, 20 + rnd(40)); const v = [a, b, 100 - a - b]; el.querySelectorAll("input").forEach((x, i) => x.value = v[i]); }
        else if (d.type === "text") el.querySelector("textarea,input").value = "autotest";
      });
      container.dispatchEvent(new Event("change"));
    }
    return { values, valid, autofill };
  }

  function scaleRow(name, points, start, left, right) {
    let h = `<div class="scale" role="radiogroup"><span class="anchor l">${left}</span><div class="pts">`;
    for (let i = 0; i < points; i++) {
      const v = start + i;
      h += `<label class="pt"><input type="radio" name="${name}" value="${v}"><span>${v}</span></label>`;
    }
    return h + `</div><span class="anchor r">${right}</span></div>`;
  }

  async function questionPage(title, intro, defs, step, label) {
    progress(step, label);
    const card = screen(`<h2>${title}</h2>${intro ? `<p>${intro}</p>` : ""}<div class="qs"></div>
      <p class="err" hidden>Please answer the highlighted question(s).</p>
      <button class="btn primary next">Continue</button>`);
    const qs = renderQuestions(card.querySelector(".qs"), defs);
    const btn = card.querySelector(".next");
    while (true) {
      await waitClick(btn, qs.autofill);
      if (qs.valid()) return qs.values();
      card.querySelector(".err").hidden = false;
      const m = card.querySelector(".missing"); if (m) m.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  /* ================= 1. Information sheet & consent ================= */
  async function consent() {
    progress(STEPS.consent, "Information and consent");
    const c = cfg.contacts;
    const card = screen(`
      <h1>${cfg.title}</h1>
      <p class="lead">You are invited to take part in a research study at IIIT Hyderabad. Please read this information before deciding.</p>
      <h3>Purpose</h3>
      <p>We want to understand how people respond to social-media advertisements for new brands. You will see some ads more than once, worded differently. Some details of the study's purpose will be explained at the end, because knowing them in advance could change how people respond.</p>
      <h3>What will I do?</h3>
      <p>A single session of about <b>25 minutes</b>: answer a few eligibility questions; look at <b>24 short advertisements</b> (each stays on screen for 10 seconds) and rate each one, with an optional short break halfway; rate eight products; answer some questions about yourself and the languages you use; read a short explanation of the study.</p>
      <h3>Risks and benefits</h3>
      <p>Minimal risk — no more than everyday use of social media. You may feel slightly bored. None of the tasks tests your language ability and no scores are shown. There is no payment and no direct benefit; the study will improve our understanding of communication with people who use more than one language.</p>
      <h3>Confidentiality</h3>
      <p>Your answers are stored under a random participant ID, not your name. We do not collect your name, phone number, e-mail or contacts. Data are kept securely, accessible only to the research team and supervisors, and results are reported only as group averages. An anonymised dataset may be shared for research.</p>
      <h3>Voluntary participation</h3>
      <p>Participation is voluntary. You may stop at any time by closing this page, without giving a reason; incomplete sessions are not used. After the session you can withdraw your data by quoting the participant ID shown at the end, until ${esc(c.withdrawUntil)}.</p>
      <h3>Contact</h3>
      <p>${esc(c.pi)}; ${esc(c.coPi)}. Supervisors: ${esc(c.supervisors)}. Reviewed by the Institutional Review Board, IIIT Hyderabad.</p>
      <div class="consent-box">
        <label class="choice"><input type="checkbox" class="cc"><span>I am 18 years of age or older.</span></label>
        <label class="choice"><input type="checkbox" class="cc"><span>I have read and understood the information above.</span></label>
        <label class="choice"><input type="checkbox" class="cc"><span>I understand that participation is voluntary and that I can withdraw at any time without penalty.</span></label>
        <label class="choice"><input type="checkbox" class="cc"><span>I understand that my anonymised data may be used in reports and shared for research.</span></label>
        <label class="choice"><input type="checkbox" class="cc"><span>I agree to take part in this study.</span></label>
      </div>
      <p class="err" hidden>Please tick all boxes to take part. If you do not wish to take part, simply close this page.</p>
      <button class="btn primary next">I agree — start</button>`);
    const btn = card.querySelector(".next");
    while (true) {
      await waitClick(btn, () => card.querySelectorAll(".cc").forEach(x => x.checked = true));
      if (Array.from(card.querySelectorAll(".cc")).every(x => x.checked)) break;
      card.querySelector(".err").hidden = false;
    }
    S.session.consent_at = new Date().toISOString();
    S.session.consent_all = 1;
  }

  /* ================= 2. Screening ================= */
  async function screening() {
    const v = await questionPage("A few quick questions", "These questions check whether the study is suitable for you.",
      Q.screening, STEPS.screening, "Eligibility");
    Object.assign(S.session, prefix("scr_", v));
    const reasons = [];
    if (v.age < 18) reasons.push("under_18");
    if (v.student !== "Yes") reasons.push("not_student");
    if (v.deva_word !== "Water" || v.deva_sentence !== "I like tea.") reasons.push("devanagari_reading");
    if (v.prior === "Yes") reasons.push("prior_participation");
    S.session.eligible = reasons.length ? 0 : 1;
    S.session.screen_out_reason = reasons.join("|");
    return reasons.length === 0;
  }

  function prefix(p, obj) { const o = {}; Object.entries(obj).forEach(([k, v]) => o[p + k] = v); return o; }

  async function notEligible() {
    progress(100, "");
    STORE.logEvent({ event: "screened_out", participant_id: S.session.participant_id, version: VERSION,
                     reason: S.session.screen_out_reason, is_test: S.session.is_test });
    screen(`<h2>Thank you for your interest</h2>
      <p>This study is designed for college students aged 18 or above who can read both English and Hindi in Devanagari script, and who have not taken part in its earlier surveys. Based on your answers, the study is not suitable for you, so no further questions will be asked.</p>
      <p>None of your answers has been stored. You can now close this page.</p>`);
  }

  /* ================= 3. Instructions & brand introduction ================= */
  async function instructions() {
    progress(STEPS.intro, "Instructions");
    const brands = SLOTS.map(s => cfg.products[s]);
    const card = screen(`
      <h2>About the brands</h2>
      <p>Eight <b>international brands</b> are about to launch in India. Before launching, they want to know how young people in India respond to their advertisements.</p>
      <div class="brands">${shuffle(brands).map(b => `<div class="brand-card"><b>${b.brand}</b><span>${b.product}</span></div>`).join("")}</div>
      <h3>What you will do</h3>
      <ol class="steps">
        <li>You will see <b>24 advertisements</b> for these brands, one at a time. Each brand's ad is shown more than once with different wording.</li>
        <li>Each ad stays on the screen for <b>10 seconds</b> and then disappears by itself. You cannot skip it, so please look at it for the whole time.</li>
        <li>After each ad you rate it on a few short scales. There are no right or wrong answers — we want your honest first impression.</li>
      </ol>
      <div class="example">
        <p class="small">Example of a rating scale — the closer you click to a word, the more that word describes your reaction:</p>
        ${scaleRow("example", 7, 1, "Bad", "Good")}
      </div>
      <p class="small">Please keep this page open and avoid switching to other apps or tabs while the ads are shown.</p>
      ${S.session.device === "mobile" ? `<p class="small"><b>On a phone?</b> The ads are wide pictures — turn your phone sideways (landscape) to see them larger.</p>` : ""}
      <p class="small loadstate">Loading the ads…</p>
      <button class="btn primary next" disabled>Start the ads</button>`);
    const btn = card.querySelector(".next");
    const res = await adsReady;
    card.querySelector(".loadstate").textContent = res.ok ? "Ads loaded." : "Some ads could not be loaded — please check your connection and reload the page.";
    if (!res.ok) return false;
    btn.disabled = false;
    await waitClick(btn);
    return true;
  }

  /* Optional pause halfway through the 24 ads (fatigue control). Its length is logged. */
  async function halfwayBreak() {
    const t0 = performance.now();
    const card = screen(`<h2>Halfway there</h2>
      <p>You have rated half of the ads. Take a short break if you like — rest your eyes for a moment.</p>
      <p>When you are ready, continue with the remaining ads.</p>
      <button class="btn primary next">Continue</button>`);
    await waitClick(card.querySelector(".next"));
    S.session.break_s = Math.round((performance.now() - t0) / 1000);
  }

  /* ================= 4. Trials ================= */
  async function runTrials() {
    const seq = S.sequence;
    guardExit = true;
    const seen = {};
    const N = seq.trials.length;
    for (let i = 0; i < N; i++) {
      const t = seq.trials[i];
      const pr = cfg.products[t.product];
      progress(STEPS.intro + (STEPS.trials - STEPS.intro) * (i / N), `Ad ${i + 1} of ${N}`);
      if (i === N / 2) await halfwayBreak();
      seen[t.product] = (seen[t.product] || 0) + 1;

      // fixation / "next ad" screen
      app.innerHTML = `<section class="stage"><div class="fix">Ad ${i + 1} of ${N}</div></section>`;
      await wait(AUTOTEST ? 50 : cfg.fixationMs);

      const exp = await exposeAd(t.product, t.language);
      const ratings = await rate(i + 1, pr);

      const prev = i > 0 ? seq.trials[i - 1] : null;
      let lag = "";
      for (let k = i - 1; k >= 0; k--) if (seq.trials[k].product === t.product) { lag = i - k; break; }
      S.trials.push(Object.assign({
        row_type: "trial",
        participant_id: S.session.participant_id, version: VERSION, sequence_id: seq.sequence_id,
        is_test: S.session.is_test,
        position: t.position, round: t.round, product_slot: t.product, product: pr.product,
        category: pr.category, brand: pr.brand, language: t.language,
        language_label: cfg.languages[t.language].label, script: cfg.languages[t.language].script,
        ad_id: `${t.product}_${t.language}`, slogan: pr.slogans[t.language],
        language_order_product: seq.language_order_by_product[t.product],
        exposure_n_of_product: seen[t.product], lag_since_same_product: lag,
        prev_language: prev ? prev.language : "", prev_product_slot: prev ? prev.product : ""
      }, exp, ratings));
    }
    progress(STEPS.trials, "Ads complete");
  }

  /** Show one ad for exactly EXPOSURE_MS (frame-locked), log measured duration. */
  async function exposeAd(slot, lang) {
    const stage = document.createElement("section");
    stage.className = "stage";
    const ad = ADS.buildAd(slot, lang);
    ad.style.visibility = "hidden";
    stage.appendChild(ad);
    const timer = document.createElement("div"); timer.className = "exp-timer"; timer.innerHTML = "<i></i>";
    stage.appendChild(timer);
    app.innerHTML = ""; app.appendChild(stage);

    const im = ad.querySelector("img");
    try { await im.decode(); } catch (e) {}
    await nextFrame(); await nextFrame();
    const m = ADS.measure(ad);

    let hiddenCount = 0;
    const onVis = () => { if (document.hidden) hiddenCount++; };
    document.addEventListener("visibilitychange", onVis);

    // Onset: make visible inside a rAF callback; the rAF timestamp is the frame time.
    const onset = await new Promise(res => requestAnimationFrame(ts => { ad.style.visibility = "visible"; res(ts); }));
    timer.firstChild.style.animationDuration = EXPOSURE_MS + "ms";
    timer.classList.add("run");
    await wait(Math.max(0, EXPOSURE_MS - 40));
    // Offset: hide on the first frame at/after onset + EXPOSURE_MS - half a frame.
    const offset = await new Promise(res => {
      const step = ts => {
        if (ts - onset >= EXPOSURE_MS - 8) { ad.style.visibility = "hidden"; res(ts); }
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    document.removeEventListener("visibilitychange", onVis);
    stage.remove();
    return Object.assign({
      exposure_planned_ms: EXPOSURE_MS,
      exposure_ms: +(offset - onset).toFixed(1),
      hidden_during_exposure: hiddenCount > 0 ? 1 : 0,
      ad_cached: ADS.isCached(slot, lang) ? 1 : 0
    }, m);
  }

  function fontOK(family, sample) {
    try { return document.fonts.check(`700 32px "${family}"`, sample) ? 1 : 0; } catch (e) { return ""; }
  }

  /** Load both slogan fonts before the first ad so that every exposure uses the
      intended typeface (no late font swap during the 10 s). Logged per session. */
  async function preloadFonts() {
    const t0 = performance.now();
    try {
      await Promise.race([
        Promise.all([document.fonts.load('700 32px "Noto Sans Devanagari"', "हिंदी कपड़े"),
                     document.fonts.load('700 32px "Noto Sans"', "Absolutely")]),
        wait(8000)]);
    } catch (e) {}
    S.session.font_deva_loaded = fontOK("Noto Sans Devanagari", "हिंदी");
    S.session.font_latin_loaded = fontOK("Noto Sans", "Aa");
    S.session.font_load_ms = Math.round(performance.now() - t0);
  }

  /** Rating page after an ad. Ad is no longer visible (fixed exposure). */
  async function rate(pos, pr) {
    const t0 = performance.now();
    const card = screen(`
      <div class="rate-head"><span class="pill">Ad ${pos} of ${S.sequence.trials.length}</span><span class="small">Rate the ad you just saw</span></div>
      <div class="blocks"></div>
      <p class="err" hidden>Please answer every row.</p>
      <button class="btn primary next">Next</button>`, { wide: true });
    const blocks = card.querySelector(".blocks");
    const ids = [];
    cfg.ratingBlocks.forEach(b => {
      const div = document.createElement("div"); div.className = "rblock";
      let h = `<div class="rprompt">${b.prompt.replace("{PRODUCT}", pr.product).replace("{BRAND}", pr.brand)}</div>`;
      const items = b.items.slice();
      const ac = cfg.attentionChecks.find(a => a.position === pos);
      if (b.id === "trust" && ac) items.splice(1, 0, { id: ac.id, attention: true, text: ac.text });
      items.forEach(it => {
        ids.push(it.id);
        if (it.attention) h += `<div class="ritem attn"><div class="attn-text">${it.text}</div>${scaleRow(it.id, 7, 1, "", "")}</div>`;
        else h += `<div class="ritem">${scaleRow(it.id, 7, 1, it.left, it.right)}</div>`;
      });
      div.innerHTML = h; blocks.appendChild(div);
    });
    const btn = card.querySelector(".next");
    const val = id => { const c = card.querySelector(`input[name="${id}"]:checked`); return c ? Number(c.value) : null; };
    while (true) {
      await waitClick(btn, () => ids.forEach(id => {
        const inp = card.querySelectorAll(`input[name="${id}"]`);
        const ac = cfg.attentionChecks.find(a => a.id === id);
        (ac ? inp[ac.correct - 1] : inp[rnd(7)]).checked = true;
      }));
      const missing = ids.filter(id => val(id) === null);
      card.querySelectorAll(".ritem").forEach(r => r.classList.toggle("missing", !!r.querySelector("input") && !r.querySelector("input:checked")));
      if (!missing.length) break;
      card.querySelector(".err").hidden = false;
    }
    const out = { rating_rt_ms: Math.round(performance.now() - t0) };
    ids.forEach(id => out[id] = val(id));
    const acp = cfg.attentionChecks.find(a => a.position === pos);
    if (acp) out.attn_pass = out[acp.id] === acp.correct ? 1 : 0;
    return out;
  }

  /* ================= 5. Manipulation & cover-story checks ================= */
  async function manipulationCheck() {
    progress(STEPS.manip, "Almost done");
    const slots = shuffle(SLOTS);
    const defs = slots.map(s => ({ id: `luxnec_${s}`, type: "scale", points: cfg.luxNecScale.points, start: 1,
      left: "1 = " + cfg.luxNecScale.left, right: "6 = " + cfg.luxNecScale.right, required: true,
      q: `<b>${cfg.products[s].product[0].toUpperCase() + cfg.products[s].product.slice(1)}</b>` }));
    const v = await questionPage("The products", Q.luxNec.q, defs, STEPS.manip, "Products");
    Object.assign(S.session, v);
    S.session.luxnec_order = slots.join("|");
    const c = await questionPage("The brands", "", [Q.coverCheck], STEPS.manip + 2, "Brands");
    Object.assign(S.session, c);
  }

  /* ================= 6. Language background & favourability ================= */
  async function languageBackground() {
    const v = await questionPage("Your languages", "There are no right or wrong answers. These are not tests of your ability.",
      Q.language, STEPS.lang - 4, "Language background");
    Object.assign(S.session, v);
    const F = Q.favourability;
    const defs = [];
    F.langs.forEach(L => F.items.forEach(it => defs.push({
      id: it.id.replace("{L}", L.key), type: "scale", points: 7, start: 1, left: it.left, right: it.right, required: true,
      q: F.q.replace("{NAME}", L.name) })));
    const f = await questionPage("Your feelings about languages", "", defs, STEPS.lang, "Language attitudes");
    Object.assign(S.session, f);
  }

  /* ================= 7. Demographics & awareness ================= */
  async function demographics() {
    Object.assign(S.session, await questionPage("About you", "", Q.demographics, STEPS.demo, "About you"));
    Object.assign(S.session, await questionPage("Last question", "", Q.awareness, STEPS.demo + 2, "Last question"));
  }

  /* ================= 8. Submit ================= */
  async function finish() {
    progress(99, "Saving");
    S.session.completed_at = new Date().toISOString();
    S.session.duration_s = Math.round((performance.now() - S.t0) / 1000);
    S.session.completed = 1;
    const checks = S.trials.filter(t => t.attn_pass !== undefined);
    S.session.attn_n_passed = checks.filter(t => t.attn_pass === 1).length;
    S.session.attn_pass = checks.length === cfg.attentionChecks.length && checks.every(t => t.attn_pass === 1) ? 1 : 0;
    const card = screen(`<h2>Saving your responses…</h2><p class="status">Please keep this page open.</p>`);
    const res = await STORE.submit({ session: S.session, trials: S.trials },
      (i, n) => card.querySelector(".status").textContent = i > 1 ? `Retrying (${i}/${n})… please keep this page open.` : "Please keep this page open.");
    guardExit = false;
    S.saved = res.ok;
    try { localStorage.setItem("hs_completed_" + cfg.studyId, S.session.participant_id); } catch (e) {}
    return res;
  }

  /* ================= 9. Debrief ================= */
  function debrief(res) {
    progress(100, "Thank you");
    const pid = S.session.participant_id, c = cfg.contacts;
    const card = screen(`
      <h1>Thank you!</h1>
      ${res.ok ? `<p class="ok">Your responses have been saved.</p>` :
        `<div class="warn"><p><b>We could not reach our server.</b> Please download your response file and e-mail it to ${esc(c.pi)}. Your data are also kept in this browser.</p>
         <button class="btn dl">Download my responses (CSV)</button></div>`}
      <p>Your participant ID: <b class="pid">${pid}</b> — please note it if you may want to withdraw your data later.</p>
      <h3>What this study was about</h3>
      <p>This study is about the <b>language of advertisements</b>. Each ad's slogan was shown in <b>English</b>, in <b>Hindi</b> (Devanagari script) or in <b>Hinglish</b> (a mix of Hindi and English in Roman script). Every participant saw each ad in all three languages, in an order that differs between participants.</p>
      <p>We are testing whether the best language depends on the type of product: earlier research (Krishna &amp; Ahluwalia, 2008) found that English worked better for <b>luxuries</b> and Hindi for <b>necessities</b>, and that mixed Hindi–English slogans worked well for both. We also want to know whether this happens because English sounds more <i>sophisticated</i> and Hindi feels closer and more <i>personal</i>, and whether it depends on how much each person uses Hindi and English. That is why we asked about your languages.</p>
      <p>We did not explain this at the start because knowing it can change how people look at ads. <b>All eight brands were invented for this study</b>; they are not real companies.</p>
      <p>Please do not tell others who might take part what the study is about until data collection ends. Thank you!</p>
      <h3>Withdrawing</h3>
      <p>If you do not want your data to be used, click below (or e-mail us your participant ID until ${esc(c.withdrawUntil)}).</p>
      <button class="btn withdraw">Withdraw my data</button>
      <p class="small">Questions or concerns: ${esc(c.pi)}; ${esc(c.coPi)}; supervisors ${esc(c.supervisors)}; IRB, IIIT Hyderabad.</p>`);
    const dl = card.querySelector(".dl");
    if (dl) dl.onclick = () => STORE.download(`hinglish_${pid}.csv`,
      STORE.toCSV(S.trials.map(t => Object.assign({}, t, S.session))));
    card.querySelector(".withdraw").onclick = async (e) => {
      if (!confirm("Withdraw your data from this study? This cannot be undone.")) return;
      e.target.disabled = true;
      const r = await STORE.withdraw(pid, VERSION);
      e.target.textContent = r && r.ok ? "Your data have been withdrawn" : "Could not reach the server — please e-mail us your ID";
    };
    if (AUTOTEST) document.body.dataset.autotestDone = res.ok ? "saved" : "not_saved";
  }

  /* ================= main ================= */
  async function main() {
    try {
      const prior = localStorage.getItem("hs_completed_" + cfg.studyId);
      if (prior && !AUTOTEST) S.session.browser_completed_before = 1;
    } catch (e) {}
    if (!window.SEQUENCES || window.SEQUENCES.length !== 24 ||
        window.SEQUENCES.some(s => s.trials.length !== SLOTS.length * 3)) {
      screen("<h2>Configuration error</h2><p>Sequence file missing. Please contact the researchers.</p>"); return;
    }
    await consent();
    if (!(await screening())) return notEligible();
    const asg = await STORE.assign(S.session.participant_id, VERSION, S.session.is_test);
    S.sequence = window.SEQUENCES.find(s => s.sequence_id === asg.sequence_id);
    S.session.sequence_id = asg.sequence_id;
    S.session.assignment_method = asg.method;
    STORE.logEvent({ event: "started", participant_id: S.session.participant_id, version: VERSION,
                     sequence_id: asg.sequence_id, is_test: S.session.is_test });
    const fontsReady = preloadFonts();      // loads while participant reads the instructions
    adsReady = ADS.preloadAll().then(r => {
      S.session.ads_preload_ms = r.ms; S.session.ads_preload_failed = r.failed.join("|"); return r;
    });
    if (!(await instructions())) { guardExit = false; return; }
    await fontsReady;
    await runTrials();
    await manipulationCheck();
    await languageBackground();
    await demographics();
    debrief(await finish());
  }

  window.addEventListener("load", main);
})();
