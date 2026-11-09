/* =========================================================================
   Storage / backend client.
   - assign():   asks the backend for the least-used sequence (balanced
                 assignment, per version). Falls back to a client-side random
                 draw if the backend is unreachable (flagged in the data).
   - submit():   sends the complete session once; retries with back-off; the
                 backend ignores duplicate participant IDs (idempotent).
   - withdraw(): flags a participant's data for deletion.
   No credentials or private keys are stored in this file.
   ========================================================================= */
(function () {
  "use strict";
  const cfg = window.STUDY;

  function backend() {
    const h = location.hostname;
    if (h === "localhost" || h === "127.0.0.1") return "/api";
    return cfg.backendUrl || "";
  }

  async function getJSON(url) {
    const r = await fetch(url, { method: "GET", cache: "no-store", redirect: "follow" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  // text/plain avoids a CORS pre-flight with Google Apps Script web apps.
  async function postJSON(url, body) {
    const r = await fetch(url, {
      method: "POST", redirect: "follow", cache: "no-store",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

  async function assign(pid, version, isTest) {
    const url = backend();
    const ids = window.SEQUENCES.map(s => s.sequence_id);
    if (url) {
      try {
        const q = `${url}${url.includes("?") ? "&" : "?"}action=assign&pid=${encodeURIComponent(pid)}` +
                  `&version=${encodeURIComponent(version)}&study=${encodeURIComponent(cfg.studyId)}` +
                  `&pending=${cfg.pendingWindowMin}&test=${isTest ? 1 : 0}`;
        const res = await getJSON(q);
        if (res && res.ok && ids.includes(res.sequence_id)) {
          return { sequence_id: res.sequence_id, method: "server_balanced" };
        }
      } catch (e) { console.warn("assign failed", e); }
    }
    // Fallback: uniform random draw (crypto RNG). Flagged so it can be audited.
    const buf = new Uint32Array(1); crypto.getRandomValues(buf);
    return { sequence_id: ids[buf[0] % ids.length], method: "client_random_fallback" };
  }

  async function submit(payload, onAttempt) {
    const url = backend();
    try { localStorage.setItem("hs_backup_" + payload.session.participant_id, JSON.stringify(payload)); } catch (e) {}
    if (!url) return { ok: false, reason: "no_backend" };
    const delays = [0, 1500, 3000, 6000, 10000];
    for (let i = 0; i < delays.length; i++) {
      await sleep(delays[i]);
      if (onAttempt) onAttempt(i + 1, delays.length);
      try {
        const res = await postJSON(url, { action: "submit", study: cfg.studyId, ...payload });
        if (res && (res.ok || res.duplicate)) {
          try { localStorage.removeItem("hs_backup_" + payload.session.participant_id); } catch (e) {}
          return { ok: true, duplicate: !!res.duplicate };
        }
      } catch (e) { console.warn("submit attempt failed", e); }
    }
    return { ok: false, reason: "network" };
  }

  async function logEvent(body) {           // screened-out / started records (no ratings)
    const url = backend();
    if (!url) return;
    try { await postJSON(url, { action: "event", study: cfg.studyId, ...body }); } catch (e) {}
  }

  async function withdraw(pid, version) {
    const url = backend();
    if (!url) return { ok: false };
    try { return await postJSON(url, { action: "withdraw", study: cfg.studyId, participant_id: pid, version }); }
    catch (e) { return { ok: false }; }
  }

  /** CSV download fallback (identical columns to the server export). */
  function toCSV(rows) {
    const cols = Array.from(rows.reduce((s, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set()));
    const esc = v => {
      if (v === null || v === undefined) return "";
      const t = String(v);
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    return [cols.join(",")].concat(rows.map(r => cols.map(c => esc(r[c])).join(","))).join("\n");
  }

  function download(filename, text) {
    const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  }

  window.STORE = { assign, submit, withdraw, logEvent, toCSV, download, backend };
})();
