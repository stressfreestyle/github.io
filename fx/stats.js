/* =====================================================================
 * stats.js — 統計検証エンジン
 * 暦カテゴリごとの日次リターン統計と、全期間平均に対する有意性(z, p)。
 * ===================================================================== */
(function () {
  'use strict';

  /* 日次対数リターン(bp単位)。returns[i] は dates[i-1]→dates[i] の変化。
   * returns[0] は null。 */
  function logReturns(closes) {
    const out = [null];
    for (let i = 1; i < closes.length; i++) {
      out.push(Math.log(closes[i] / closes[i - 1]) * 10000);
    }
    return out;
  }

  function normCdf(x) {
    // Abramowitz-Stegun 近似
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989422804 * Math.exp(-x * x / 2);
    let p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x > 0 ? 1 - p : p;
  }

  /* labels[i] (カテゴリ名 or null=対象外) と returns[i] から
   * カテゴリ別統計を計算。基準(全体)との差の z スコアと両側 p 値を付す。 */
  function groupStats(labels, returns) {
    let allN = 0, allSum = 0, allSq = 0;
    for (let i = 1; i < returns.length; i++) {
      if (returns[i] == null) continue;
      allN++; allSum += returns[i]; allSq += returns[i] * returns[i];
    }
    const allMean = allSum / allN;
    const allSd = Math.sqrt(allSq / allN - allMean * allMean);

    const g = new Map();
    for (let i = 1; i < returns.length; i++) {
      const lb = labels[i];
      if (lb == null || returns[i] == null) continue;
      if (!g.has(lb)) g.set(lb, { n: 0, sum: 0, sq: 0, up: 0, absSum: 0 });
      const o = g.get(lb);
      o.n++; o.sum += returns[i]; o.sq += returns[i] * returns[i];
      o.absSum += Math.abs(returns[i]);
      if (returns[i] > 0) o.up++;
    }
    const rows = [];
    for (const [label, o] of g) {
      const mean = o.sum / o.n;
      const sd = Math.sqrt(Math.max(o.sq / o.n - mean * mean, 0));
      const z = o.n > 1 ? (mean - allMean) / (allSd / Math.sqrt(o.n)) : 0;
      rows.push({
        label, n: o.n, mean, sd,
        upRate: o.up / o.n,
        meanAbs: o.absSum / o.n,
        z, p: 2 * (1 - normCdf(Math.abs(z)))
      });
    }
    return { rows, allMean, allSd, allN, allMeanAbs: null };
  }

  /* ---- 類似局面検索 ----
   * 直近 win 本のzスコア正規化系列と過去の全窓のピアソン相関。
   * 返り値: 上位 topN の {start, r, after: 続くafterN日の累積リターン%} */
  function znorm(arr) {
    const n = arr.length;
    let s = 0, sq = 0;
    for (const v of arr) { s += v; sq += v * v; }
    const m = s / n, sd = Math.sqrt(Math.max(sq / n - m * m, 1e-12));
    return arr.map(v => (v - m) / sd);
  }
  function pearson(a, b) {
    const n = a.length;
    let s = 0;
    for (let i = 0; i < n; i++) s += a[i] * b[i];
    return s / n; // 両方z正規化済み前提
  }
  function findSimilar(closes, win, afterN, topN) {
    const n = closes.length;
    if (n < win * 2 + afterN) return [];
    const target = znorm(closes.slice(n - win));
    const results = [];
    for (let s = 0; s + win + afterN <= n - win; s++) {
      const seg = znorm(closes.slice(s, s + win));
      const r = pearson(target, seg);
      results.push({ start: s, r });
    }
    // 近接窓の重複を除いて上位を選抜
    results.sort((a, b) => b.r - a.r);
    const picked = [];
    for (const c of results) {
      if (picked.some(p => Math.abs(p.start - c.start) < win / 2)) continue;
      const endIdx = c.start + win - 1;
      c.after = (closes[endIdx + afterN] / closes[endIdx] - 1) * 100;
      c.path = [];
      for (let k = 0; k <= afterN; k++) c.path.push(closes[endIdx + k] / closes[endIdx]);
      picked.push(c);
      if (picked.length >= topN) break;
    }
    return picked;
  }

  /* ---- 一目均衡表 時間論 ----
   * スイング(フラクタル)検出と基本数値。 */
  const ICHIMOKU_NUMBERS = [9, 17, 26, 33, 42, 52, 65, 76];
  function findSwings(closes, w) {
    w = w || 5;
    const swings = [];
    for (let i = w; i < closes.length - w; i++) {
      let hi = true, lo = true;
      for (let k = i - w; k <= i + w; k++) {
        if (closes[k] > closes[i]) hi = false;
        if (closes[k] < closes[i]) lo = false;
      }
      if (hi) swings.push({ idx: i, type: 'high' });
      else if (lo) swings.push({ idx: i, type: 'low' });
    }
    // 同型連続は極値のみ残す
    const out = [];
    for (const s of swings) {
      const last = out[out.length - 1];
      if (last && last.type === s.type) {
        if ((s.type === 'high' && closes[s.idx] >= closes[last.idx]) ||
            (s.type === 'low' && closes[s.idx] <= closes[last.idx])) out[out.length - 1] = s;
      } else out.push(s);
    }
    return out;
  }
  /* 各日について直近スイングからの経過本数(当日を1日目と数える一目式)が
   * 基本数値に一致するかのラベル */
  function ichimokuLabels(closes, swings) {
    const labels = new Array(closes.length).fill(null);
    let si = 0;
    let lastSwing = -1;
    for (let i = 0; i < closes.length; i++) {
      while (si < swings.length && swings[si].idx <= i) { lastSwing = swings[si].idx; si++; }
      if (lastSwing < 0) continue;
      const count = i - lastSwing + 1; // 一目流: スイング当日=1日目
      labels[i] = ICHIMOKU_NUMBERS.includes(count) ? '基本数値日' : '通常日';
    }
    return labels;
  }

  window.FXStats = { logReturns, groupStats, findSimilar, znorm, findSwings, ichimokuLabels, ICHIMOKU_NUMBERS, normCdf };
})();
