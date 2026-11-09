/* =========================================================================
   Advertisement renderer (image ads).
   Each ad is a finished 16:9 image (assets/ads/ad_<slot>_<lang>.jpg). All 24
   images are downloaded and decoded before the first ad, so every exposure
   starts with the image fully painted and lasts exactly the planned time.
   All ads are displayed at the same size on a given screen.
   ========================================================================= */
(function () {
  "use strict";
  const cache = {};   // "N1_E" -> decoded HTMLImageElement

  function key(slot, lang) { return `${slot}_${lang}`; }

  /** Download + decode every ad. Resolves with {ok, failed:[ids], ms}. */
  async function preloadAll(onProgress) {
    const cfg = window.STUDY;
    const ids = [];
    Object.keys(cfg.products).forEach(s => Object.keys(cfg.languages).forEach(l => ids.push([s, l])));
    const t0 = performance.now();
    let done = 0;
    const failed = [];
    await Promise.all(ids.map(async ([s, l]) => {
      const img = new Image();
      img.decoding = "sync";
      img.src = cfg.adImage(s, l);
      try { await img.decode(); cache[key(s, l)] = img; }
      catch (e) {
        // one retry with cache-busting
        try { img.src = cfg.adImage(s, l) + "?r=" + Date.now(); await img.decode(); cache[key(s, l)] = img; }
        catch (e2) { failed.push(key(s, l)); }
      }
      done++; if (onProgress) onProgress(done, ids.length);
    }));
    return { ok: failed.length === 0, failed, ms: Math.round(performance.now() - t0) };
  }

  /**
   * Build the ad element for one trial.
   * @param {string} slot - N1..N4, L1..L4
   * @param {string} lang - E|H|X
   */
  function buildAd(slot, lang) {
    const cfg = window.STUDY;
    const pr = cfg.products[slot];
    const ad = document.createElement("div");
    ad.className = "ad";
    ad.setAttribute("data-ad-id", key(slot, lang));
    const img = document.createElement("img");
    img.src = (cache[key(slot, lang)] || {}).src || cfg.adImage(slot, lang);
    img.alt = `${pr.brand} ${pr.product} advertisement`;
    img.draggable = false;
    ad.appendChild(img);
    return ad;
  }

  /** Displayed size of the ad (logged per trial). */
  function measure(adEl) {
    const img = adEl.querySelector("img");
    const r = adEl.getBoundingClientRect();
    return {
      ad_width_px: Math.round(r.width), ad_height_px: Math.round(r.height),
      img_loaded: img && img.complete && img.naturalWidth > 0 ? 1 : 0,
      trial_viewport_w: window.innerWidth, trial_viewport_h: window.innerHeight
    };
  }

  window.ADS = { buildAd, measure, preloadAll, isCached: (s, l) => !!cache[key(s, l)] };
})();
