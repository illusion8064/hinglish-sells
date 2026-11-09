/**
 * Hinglish Sells? — Google Apps Script backend (bound to a Google Sheet).
 *
 * Deploy: Extensions ▸ Apps Script in the data Sheet, paste this file, then
 *   Deploy ▸ New deployment ▸ Web app ▸ Execute as: Me ▸ Who has access: Anyone.
 * Paste the resulting /exec URL into experiment/js/config.js (backendUrl).
 *
 * Tabs created automatically: sessions, trials, assignments, events.
 * Security notes:
 *   - No secrets live in the frontend; the web-app URL only allows the four
 *     actions below. Payloads are validated; duplicates are ignored.
 *   - Data stay in the researchers' own Google account / Sheet.
 *   - The Sheet must NOT be shared publicly.
 */

const N_SEQUENCES = 24;
const N_TRIALS = 24;            // 8 products x 3 languages
const SEQ_IDS = Array.from({ length: N_SEQUENCES }, (_, i) => 'S' + String(i + 1).padStart(2, '0'));
const PID_RE = /^P[A-Z2-9]{6}$/;
const VERSIONS = ['lab', 'online'];

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

/** Append objects as rows; header row grows automatically when new keys appear. */
function appendObjects_(name, objs) {
  if (!objs.length) return;
  const sh = sheet_(name);
  let header = sh.getLastRow() > 0 ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  const keys = new Set(header);
  objs.forEach(o => Object.keys(o).forEach(k => { if (!keys.has(k)) { keys.add(k); header.push(k); } }));
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  const rows = objs.map(o => header.map(k => (o[k] === undefined || o[k] === null) ? '' : o[k]));
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, header.length).setValues(rows);
}

function readObjects_(name) {
  const sh = sheet_(name);
  if (sh.getLastRow() < 2) return [];
  const v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const h = v[0];
  return v.slice(1).map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}

/* ------------------------------------------------------------------ GET */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'ping') return json_({ ok: true, time: new Date().toISOString() });
  if (p.action !== 'assign') return json_({ ok: false, error: 'unknown action' });
  if (!PID_RE.test(p.pid || '') || VERSIONS.indexOf(p.version) < 0) return json_({ ok: false, error: 'bad request' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const isTest = p.test === '1' ? 1 : 0;
    const pendingMin = Math.min(Math.max(Number(p.pending) || 40, 5), 180);
    const now = Date.now();
    const sessions = readObjects_('sessions');
    const completedPids = new Set(sessions.map(s => s.participant_id));
    // completed, non-withdrawn sessions per sequence for this version & test flag
    const counts = Object.fromEntries(SEQ_IDS.map(id => [id, 0]));
    sessions.forEach(s => {
      if (s.version === p.version && Number(s.is_test) === isTest && Number(s.withdrawn || 0) !== 1 && counts[s.sequence_id] !== undefined)
        counts[s.sequence_id] += 1;
    });
    // recently assigned but not yet completed = pending (prevents over-assignment)
    readObjects_('assignments').forEach(a => {
      if (a.version === p.version && Number(a.is_test) === isTest && !completedPids.has(a.participant_id) &&
          now - new Date(a.assigned_at).getTime() < pendingMin * 60000 && counts[a.sequence_id] !== undefined)
        counts[a.sequence_id] += 1;
    });
    const min = Math.min.apply(null, SEQ_IDS.map(id => counts[id]));
    const pool = SEQ_IDS.filter(id => counts[id] === min);
    const seq = pool[Math.floor(Math.random() * pool.length)];
    appendObjects_('assignments', [{ participant_id: p.pid, version: p.version, is_test: isTest,
                                     sequence_id: seq, assigned_at: new Date().toISOString() }]);
    return json_({ ok: true, sequence_id: seq });
  } finally {
    lock.releaseLock();
  }
}

/* ----------------------------------------------------------------- POST */
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (body.action === 'submit') return json_(submit_(body));
    if (body.action === 'event') return json_(event_(body));
    if (body.action === 'withdraw') return json_(withdraw_(body));
    if (body.action === 'pretest') return json_(pretest_(body));
    return json_({ ok: false, error: 'unknown action' });
  } finally {
    lock.releaseLock();
  }
}

function submit_(body) {
  const s = body.session || {}, trials = body.trials || [];
  if (!PID_RE.test(s.participant_id || '')) return { ok: false, error: 'bad participant id' };
  if (SEQ_IDS.indexOf(s.sequence_id) < 0) return { ok: false, error: 'bad sequence id' };
  if (trials.length !== N_TRIALS) return { ok: false, error: 'expected ' + N_TRIALS + ' trials' };
  if (trials.some(t => t.participant_id !== s.participant_id)) return { ok: false, error: 'id mismatch' };
  const already = readObjects_('sessions').some(r => r.participant_id === s.participant_id);
  if (already) return { ok: true, duplicate: true };          // idempotent: duplicate ignored
  const received = new Date().toISOString();
  appendObjects_('sessions', [Object.assign({ server_received_at: received, withdrawn: 0 }, s)]);
  appendObjects_('trials', trials.map(t => Object.assign({ server_received_at: received }, t)));
  return { ok: true };
}

function event_(body) {
  if (!PID_RE.test(body.participant_id || '')) return { ok: false };
  appendObjects_('events', [{ event: String(body.event || '').slice(0, 30), participant_id: body.participant_id,
    version: body.version || '', sequence_id: body.sequence_id || '', reason: String(body.reason || '').slice(0, 120),
    is_test: body.is_test ? 1 : 0, at: new Date().toISOString() }]);
  return { ok: true };
}

/** Pretest submissions (product pretest, slogan pretest) go to their own tabs. */
function pretest_(body) {
  const name = { products: 'pretest_products', slogans: 'pretest_slogans' }[body.pretest];
  const rows = body.rows || [];
  if (!name || !PID_RE.test(body.participant_id || '') || !rows.length || rows.length > 200) return { ok: false };
  const sh = sheet_(name);
  if (sh.getLastRow() > 1) {
    const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const ci = h.indexOf('participant_id');
    if (ci >= 0 && sh.getRange(2, ci + 1, sh.getLastRow() - 1, 1).getValues().some(r => r[0] === body.participant_id))
      return { ok: true, duplicate: true };
  }
  const t = new Date().toISOString();
  appendObjects_(name, rows.map(r => Object.assign({ server_received_at: t, participant_id: body.participant_id }, r)));
  return { ok: true };
}

function withdraw_(body) {
  const pid = body.participant_id || '';
  if (!PID_RE.test(pid)) return { ok: false };
  const sh = sheet_('sessions');
  if (sh.getLastRow() < 2) return { ok: false };
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const ci = header.indexOf('participant_id'), wi = header.indexOf('withdrawn');
  const ids = sh.getRange(2, ci + 1, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === pid) {
      sh.getRange(i + 2, wi + 1).setValue(1);
      appendObjects_('events', [{ event: 'withdrawn', participant_id: pid, at: new Date().toISOString() }]);
      return { ok: true };
    }
  }
  return { ok: false };
}
