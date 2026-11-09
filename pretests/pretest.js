/* =========================================================================
   Minimal survey engine shared by the two pretests (no timing control needed).
   Pages are arrays of question definitions; answers are flattened into rows
   and posted with action "pretest" (same backend as the main study).
   ========================================================================= */
window.PRETEST = (function () {
  "use strict";
  const app = document.getElementById("app");
  const params = new URLSearchParams(location.search);
  const AUTOTEST = params.get("autotest") === "1";
  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pid = (() => { const a = new Uint8Array(6); crypto.getRandomValues(a);
    return "P" + Array.from(a, b => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join(""); })();

  function scale(name, n, start, l, r) {
    let h = `<div class="scale"><span class="anchor l">${l}</span><div class="pts">`;
    for (let i = 0; i < n; i++) h += `<label class="pt"><input type="radio" name="${name}" value="${start + i}"><span>${start + i}</span></label>`;
    return h + `</div><span class="anchor r">${r}</span></div>`;
  }

  /** defs: [{id, type:'scale'|'radio'|'text', q, n, start, l, r, options, required}] */
  function page(title, intro, defs, progressPct) {
    document.getElementById("progress-fill").style.width = progressPct + "%";
    app.innerHTML = `<section class="card wide"><h2>${title}</h2>${intro || ""}<div class="qs"></div>
      <p class="err" hidden>Please answer the highlighted question(s).</p><button class="btn primary next">Continue</button></section>`;
    scrollTo(0, 0);
    const qs = app.querySelector(".qs");
    defs.forEach(d => {
      const w = document.createElement("div"); w.className = "q"; w.dataset.qid = d.id;
      let h = `<div class="q-text">${d.q}${d.required === false ? " <span class='opt'>(optional)</span>" : ""}</div>`;
      if (d.type === "scale") h += scale(d.id, d.n, d.start ?? 1, d.l, d.r);
      if (d.type === "radio") h += `<div class="choices">` + d.options.map(o => `<label class="choice"><input type="radio" name="${d.id}" value="${o}"><span>${o}</span></label>`).join("") + `</div>`;
      if (d.type === "text") h += `<input type="text" maxlength="200">`;
      w.innerHTML = h; qs.appendChild(w);
    });
    const val = d => {
      const w = qs.querySelector(`[data-qid="${d.id}"]`);
      if (d.type === "text") return w.querySelector("input").value.trim();
      const c = w.querySelector("input:checked"); return c ? c.value : "";
    };
    return new Promise(resolve => {
      const btn = app.querySelector(".next");
      const go = () => {
        let ok = true;
        defs.forEach(d => {
          const miss = d.required !== false && val(d) === "";
          qs.querySelector(`[data-qid="${d.id}"]`).classList.toggle("missing", miss); if (miss) ok = false;
        });
        if (!ok) { app.querySelector(".err").hidden = false; return; }
        const out = {}; defs.forEach(d => out[d.id] = val(d)); resolve(out);
      };
      btn.addEventListener("click", go);
      if (AUTOTEST) setTimeout(() => {
        defs.forEach(d => {
          const w = qs.querySelector(`[data-qid="${d.id}"]`);
          if (d.type === "text") w.querySelector("input").value = "autotest";
          else { const i = w.querySelectorAll("input"); (d.autotestPick ? i[d.autotestPick(i.length)] : i[rnd(i.length)]).checked = true; }
        });
        go();
      }, 20);
    });
  }

  async function consentPage(title, what, minutes) {
    const r = await page(title, `<p>This short survey is part of a student research project at IIIT Hyderabad (BRED course; supervisors Prof. Vinoo Alluri and Prof. Bapi Raju). ${what} It takes about <b>${minutes} minutes</b>. Participation is voluntary and anonymous (no name, e-mail or phone number is collected); you can stop at any time by closing the page. Minimal risk. Contact: ritama.sanyal@research.iiit.ac.in, priyanshi.jain@research.iiit.ac.in.</p>`,
      [{ id: "consent", type: "radio", q: "Do you agree to take part? You must be 18 or older.", options: ["Yes, I am 18+ and I agree", "No"] ,
         autotestPick: () => 0 },
       { id: "student", type: "radio", q: "Are you currently a college or university student?", options: ["Yes", "No"], autotestPick: () => 0 }], 3);
    return r.consent.startsWith("Yes") && r.student === "Yes";
  }

  async function submit(pretest, rows) {
    const h = location.hostname, url = (h === "localhost" || h === "127.0.0.1") ? "/api" : (window.STUDY && STUDY.backendUrl) || "";
    rows.forEach(r => { r.is_test = AUTOTEST ? 1 : 0; r.user_agent = navigator.userAgent; });
    app.innerHTML = `<section class="card"><h2>Saving…</h2></section>`;
    for (let i = 0; i < 4 && url; i++) {
      try {
        const res = await (await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "pretest", pretest, participant_id: pid, rows }) })).json();
        if (res.ok) { done(true); return; }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
    done(false, rows);
  }

  function done(ok, rows) {
    document.getElementById("progress-fill").style.width = "100%";
    app.innerHTML = `<section class="card"><h2>Thank you!</h2>${ok ? "<p class='ok'>Your answers have been saved.</p>" :
      "<p class='err'>We could not reach the server. Please download your answers and e-mail them to the researchers.</p><button class='btn dl'>Download</button>"}
      <p>These answers help us choose products and wording for a later study. All brand names shown are invented. Please do not take part in the later main study of this project.</p></section>`;
    if (!ok) app.querySelector(".dl").onclick = () => {
      const cols = Object.keys(rows[0]);
      const csv = [cols.join(",")].concat(rows.map(r => cols.map(c => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))).join("\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
      a.download = `pretest_${pid}.csv`; a.click();
    };
    document.body.dataset.autotestDone = ok ? "saved" : "not_saved";
  }

  function notEligible() {
    app.innerHTML = `<section class="card"><h2>Thank you</h2><p>This survey is only for college students aged 18+ who agree to take part. You can close this page.</p></section>`;
    document.body.dataset.autotestDone = "ineligible";
  }

  return { page, consentPage, submit, notEligible, shuffle, pid, rnd };
})();
