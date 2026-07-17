/* =====================================================================
 * data.js — 為替データ取得層
 * Frankfurter API (欧州中銀の日次参照レート, 1999年〜, CORS対応・無料)
 * EUR基準の1リクエストから主要6ペアを導出し localStorage にキャッシュ。
 * 取得失敗時は決定論的な擬似データにフォールバック(バナーで明示)。
 * ===================================================================== */
(function () {
  'use strict';

  const API = 'https://api.frankfurter.dev/v1';
  const START = '1999-01-04';
  const CACHE_KEY = 'fxkoyomi-data-v1';
  const PAIRS = ['USD/JPY', 'EUR/USD', 'EUR/JPY', 'GBP/USD', 'AUD/USD', 'GBP/JPY'];

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  /* EUR基準レート {date: {USD,JPY,GBP,AUD}} から各ペアを導出 */
  function derivePairs(rates) {
    const dates = Object.keys(rates).sort();
    const out = { dates: [], pairs: {} };
    for (const p of PAIRS) out.pairs[p] = [];
    for (const dt of dates) {
      const r = rates[dt];
      if (!r || !r.USD || !r.JPY || !r.GBP || !r.AUD) continue;
      out.dates.push(dt);
      out.pairs['USD/JPY'].push(r.JPY / r.USD);
      out.pairs['EUR/USD'].push(r.USD);
      out.pairs['EUR/JPY'].push(r.JPY);
      out.pairs['GBP/USD'].push(r.USD / r.GBP);
      out.pairs['AUD/USD'].push(r.USD / r.AUD);
      out.pairs['GBP/JPY'].push(r.JPY / r.GBP);
    }
    return out;
  }

  async function fetchAll() {
    const url = `${API}/${START}..?base=EUR&symbols=USD,JPY,GBP,AUD`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('API error ' + res.status);
    const json = await res.json();
    return derivePairs(json.rates);
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj.fetched || !obj.data || !obj.data.dates || obj.data.dates.length < 100) return null;
      return obj;
    } catch (e) { return null; }
  }
  function saveCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fetched: todayISO(), data }));
    } catch (e) { /* 容量超過などは無視 */ }
  }

  /* ---- フォールバック用の決定論的擬似データ ---- */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeSampleData() {
    const rnd = mulberry32(20260717);
    const start = new Date(Date.UTC(1999, 0, 4));
    const end = new Date();
    const dates = [];
    const base = { 'USD/JPY': 113, 'EUR/USD': 1.17, 'EUR/JPY': 132, 'GBP/USD': 1.66, 'AUD/USD': 0.63, 'GBP/JPY': 188 };
    const vol = { 'USD/JPY': 0.006, 'EUR/USD': 0.005, 'EUR/JPY': 0.007, 'GBP/USD': 0.006, 'AUD/USD': 0.007, 'GBP/JPY': 0.008 };
    const pairs = {};
    for (const p of PAIRS) pairs[p] = [];
    const level = Object.assign({}, base);
    const drift = {};
    for (const p of PAIRS) drift[p] = 0;
    for (let t = new Date(start); t <= end; t.setUTCDate(t.getUTCDate() + 1)) {
      const dow = t.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      dates.push(t.toISOString().slice(0, 10));
      for (const p of PAIRS) {
        if (rnd() < 0.01) drift[p] = (rnd() - 0.5) * 0.002; // レジーム転換
        const shock = (rnd() + rnd() + rnd() - 1.5) * vol[p];
        level[p] *= Math.exp(drift[p] + shock);
        pairs[p].push(level[p]);
      }
    }
    return { dates, pairs };
  }

  /* ---- エントリポイント ----
   * 返り値: { data:{dates,pairs}, source:'api'|'cache'|'sample', fetched } */
  async function load() {
    const cache = loadCache();
    if (cache && cache.fetched === todayISO()) {
      return { data: cache.data, source: 'cache', fetched: cache.fetched };
    }
    try {
      const data = await fetchAll();
      saveCache(data);
      return { data, source: 'api', fetched: todayISO() };
    } catch (e) {
      if (cache) return { data: cache.data, source: 'cache', fetched: cache.fetched };
      return { data: makeSampleData(), source: 'sample', fetched: null };
    }
  }

  window.FXData = { load, PAIRS };
})();
