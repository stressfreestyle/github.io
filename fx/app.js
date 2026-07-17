/* =====================================================================
 * app.js — 画面統合
 * タブ: チャート / 暦検証 / 類似局面 / 年表 / 解説・設定
 * ===================================================================== */
(function () {
  'use strict';
  const K = window.Koyomi, S = window.FXStats;

  const state = {
    data: null, source: null,
    pair: 'USD/JPY',
    rec: [],          // 暦レコード(dates と同順)
    returns: {},      // pair -> 対数リターン(bp)
    swings: {},       // pair -> スイング
    settings: { ayanamsa: 24, gojuonAnchor: '2000-02-04' }
  };

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  /* ---------- 初期化 ---------- */
  async function init() {
    loadSettings();
    const res = await window.FXData.load();
    state.data = res.data;
    state.source = res.source;
    buildDerived();
    setupHeader(res);
    setupTabs();
    renderChartTab();
    renderVerifyTab();
    renderSimilarTab();
    renderTimelineTab();
    renderKotodamaTab();
    renderDocsTab();
    $('#loading').style.display = 'none';
    $('#app').style.display = 'block';
  }

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('fxkoyomi-settings') || '{}');
      Object.assign(state.settings, s);
    } catch (e) { }
  }
  function saveSettings() {
    localStorage.setItem('fxkoyomi-settings', JSON.stringify(state.settings));
  }

  function buildDerived() {
    const { dates, pairs } = state.data;
    const anchorJ = K.jdnFromISO(state.settings.gojuonAnchor);
    state.rec = dates.map(d => K.record(d, { ayanamsa: state.settings.ayanamsa, gojuonAnchor: anchorJ }));
    for (const p of Object.keys(pairs)) {
      state.returns[p] = S.logReturns(pairs[p]);
      state.swings[p] = S.findSwings(pairs[p], 5);
    }
  }

  function setupHeader(res) {
    const sel = $('#pair-select');
    sel.innerHTML = window.FXData.PAIRS.map(p => `<option>${p}</option>`).join('');
    sel.value = state.pair;
    sel.addEventListener('change', () => {
      state.pair = sel.value;
      renderChartTab(); renderVerifyTab(); renderSimilarTab(); renderTimelineTab();
    });
    const banner = $('#source-banner');
    if (res.source === 'sample') {
      banner.textContent = '⚠ 為替APIに接続できないため擬似サンプルデータを表示中です。検証結果に意味はありません。ネットワーク接続後に再読込してください。';
      banner.style.display = 'block';
    } else {
      const n = state.data.dates.length;
      $('#data-info').textContent =
        `${state.data.dates[0]} 〜 ${state.data.dates[n - 1]} (${n}営業日 / ECB日次レート${res.source === 'cache' ? '・キャッシュ' : ''})`;
    }
  }

  function setupTabs() {
    $$('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $('#' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'tab-chart' && chart) chart.draw();
    }));
  }

  /* ---------- 共通ヘルパ ---------- */
  function koyomiSummary(r) {
    return `${r.weekday}曜 / ${r.moonPhase}(月齢${r.moonAge.toFixed(1)}) / ${r.sekkiTerm}` +
      (r.sekkiDay ? `【${r.sekkiDay}入り】` : '') +
      ` / ${r.shuku}宿 / ${r.ganzhi}(${r.element}${r.kasui ? '・' + r.kasui + 'の日' : ''})` +
      ` / 数秘${r.numerology} / 言霊「${r.kana}」(${r.rei})` +
      ` / 水星${r.retro ? '逆行' : '順行'}${r.gotobi ? ' / 五十日' : ''}`;
  }
  function idxOfDate(dateISO) {
    const { dates } = state.data;
    let lo = 0, hi = dates.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      dates[mid] < dateISO ? lo = mid + 1 : hi = mid;
    }
    return lo;
  }
  function fmtBp(v) { return (v >= 0 ? '+' : '') + v.toFixed(1); }
  function fmtPct(v) { return (v * 100).toFixed(1) + '%'; }

  /* ---------- タブ1: チャート ---------- */
  let chart = null;
  function renderChartTab() {
    const { dates, pairs } = state.data;
    if (!chart) {
      chart = new window.FXChart($('#chart-canvas'), $('#chart-tooltip'));
      chart.hoverInfo = idx => `<div class="tip-koyomi">${koyomiSummary(state.rec[idx])}</div>`;
      $$('#overlay-controls input').forEach(cb => cb.addEventListener('change', applyOverlays));
      $('#btn-fullrange').addEventListener('click', () => chart.showAll());
    }
    chart.setData(dates, pairs[state.pair]);
    applyOverlays();
    renderHenkabi();
  }

  function applyOverlays() {
    const on = id => $('#' + id).checked;
    const vlines = [], bands = [], markers = [];
    const rec = state.rec;

    if (on('ov-events')) {
      for (const ev of window.FXEvents) {
        if (ev.date < state.data.dates[0]) continue;
        vlines.push({ idx: idxOfDate(ev.date), color: window.FXEventCats[ev.cat].color + 'aa', label: ev.title });
      }
    }
    if (on('ov-moon')) {
      for (let i = 1; i < rec.length; i++) {
        if (rec[i].moonAge < rec[i - 1].moonAge) markers.push({ idx: i, color: '#8a93a8', shape: '●' });        // 朔
        const half = K.SYNODIC / 2;
        if (rec[i - 1].moonAge < half && rec[i].moonAge >= half) markers.push({ idx: i, color: '#e8d76a', shape: '○' }); // 望
      }
    }
    if (on('ov-sekki')) {
      for (let i = 0; i < rec.length; i++) {
        if (rec[i].sekkiDay) vlines.push({ idx: i, color: '#3a6e57aa', label: rec[i].sekkiDay, dash: true });
      }
    }
    if (on('ov-retro')) {
      let start = null;
      for (let i = 0; i < rec.length; i++) {
        if (rec[i].retro && start == null) start = i;
        if ((!rec[i].retro || i === rec.length - 1) && start != null) {
          bands.push({ i0: start, i1: i, color: 'rgba(224,140,90,0.10)' });
          start = null;
        }
      }
    }
    if (on('ov-ichimoku')) {
      const swings = state.swings[state.pair];
      const last = swings[swings.length - 1];
      if (last) {
        for (const b of S.ICHIMOKU_NUMBERS) {
          const idx = last.idx + b - 1;
          if (idx < state.data.dates.length) {
            vlines.push({ idx, color: '#b06ee0aa', label: `一目${b}`, dash: true });
          }
        }
      }
    }
    chart.setOverlays({ vlines, bands, markers });
  }

  /* 直近スイングから将来の変化日候補(暦日で営業日を延長して計算) */
  function renderHenkabi() {
    const { dates } = state.data;
    const swings = state.swings[state.pair];
    const el = $('#henkabi');
    if (!swings.length) { el.innerHTML = ''; return; }
    const last = swings[swings.length - 1];
    const lastDate = dates[dates.length - 1];
    // 営業日カレンダーを未来へ延長
    const future = [];
    let t = new Date(lastDate + 'T12:00:00Z');
    while (future.length < 90) {
      t.setUTCDate(t.getUTCDate() + 1);
      const dow = t.getUTCDay();
      if (dow !== 0 && dow !== 6) future.push(t.toISOString().slice(0, 10));
    }
    const items = [];
    for (const b of S.ICHIMOKU_NUMBERS) {
      const target = last.idx + b - 1;             // 一目流: スイング当日=1本目
      const offset = target - (dates.length - 1);  // 未来なら正
      if (offset > 0 && offset <= future.length) {
        const d = future[offset - 1];
        const r = K.record(d, { ayanamsa: state.settings.ayanamsa, gojuonAnchor: K.jdnFromISO(state.settings.gojuonAnchor) });
        items.push(`<li><b>${d}</b> (基本数値${b}) — ${r.weekday}曜・${r.moonPhase}・${r.shuku}宿・${r.ganzhi}${r.kasui ? '・' + r.kasui + 'の日' : ''}・言霊「${r.kana}」(${r.rei})</li>`);
      }
    }
    el.innerHTML =
      `<h3>一目時間論による次の変化日候補 <span class="mini">(直近スイング ${dates[last.idx]} の${last.type === 'high' ? '高値' : '安値'}から基本数値を投影)</span></h3>` +
      (items.length ? `<ul>${items.join('')}</ul>` : '<p class="mini">90営業日以内に基本数値日はありません。</p>') +
      `<p class="mini">※変化日は「トレンドが加速または反転しやすいとされる日」の候補にすぎず、方向は示しません。</p>`;
  }

  /* ---------- タブ2: 暦検証 ---------- */
  function featureDefs() {
    const rec = state.rec;
    return [
      { name: '曜日', desc: '曜日ごとの平均日次リターン(曜日効果)', labels: rec.map(r => r.weekday + '曜') },
      { name: '月内位置', desc: '月初(1〜3日)・月中・月末(残り3日)', labels: rec.map(r => r.monthPos) },
      { name: '五十日(ゴトー日)', desc: '5・10日と月末(実需フローのアノマリー)', labels: rec.map(r => r.gotobi ? '五十日' : '通常日') },
      { name: '月相(月齢)', desc: '新月・上弦・満月・下弦(各±1日)とその間の期間', labels: rec.map(r => r.moonPhase) },
      { name: '二十四節気(節気入り日)', desc: '節気の入り日 vs それ以外', labels: rec.map(r => r.sekkiDay ? '節気日' : '通常日') },
      { name: '二十四節気(区間別)', desc: 'その日が属する節気の区間ごと(約15日間×24)', labels: rec.map(r => r.sekkiTerm) },
      { name: '二十七宿(宿曜)', desc: '月の黄経による27宿(天文学的定法・設定で調整可)', labels: rec.map(r => r.shuku + '宿') },
      { name: '日干五行(火水の法則)', desc: '日の十干の五行。火=丙丁、水=壬癸', labels: rec.map(r => r.element), highlight: ['火', '水'] },
      { name: '陰陽(日干)', desc: '日干の陰陽', labels: rec.map(r => r.yinyang) },
      { name: '数秘(1〜9)', desc: '年月日の全桁和を1桁に還元', labels: rec.map(r => '数秘' + r.numerology) },
      { name: '水星の順逆', desc: '水星逆行期間 vs 順行期間', labels: rec.map(r => r.retro ? '逆行' : '順行') },
      { name: '言霊五十連(靈別)', desc: '言霊一言法則の各音の靈の分類(正火・空中の水・水火・濁水・影の火・煇火・昇る水・水中の火・火中の水…) ※基準日は設定タブ', labels: rec.map(r => r.rei) },
      { name: '言霊五十連(火水大別)', desc: '靈分類を火性・水性・火水性に大別(参考: アプリ側の分類であり原本の記載ではない)', labels: rec.map(r => r.kasui50), highlight: ['火性', '水性'] },
      { name: '言霊五十連(音別・50音)', desc: 'ホに起こりマに終わる五十連の各音。1カテゴリあたりの標本数は少なめなので参考程度に', labels: rec.map(r => '「' + r.kana + '」') },
      {
        name: '一目均衡表・基本数値日', desc: 'スイングから9,17,26,33,42,52,65,76本目に当たる日(変動率も参照)',
        labels: S.ichimokuLabels(state.data.pairs[state.pair], state.swings[state.pair]), showAbs: true
      }
    ];
  }

  function renderVerifyTab() {
    const returns = state.returns[state.pair];
    const host = $('#verify-tables');
    const feats = featureDefs();
    let html = `<p class="note">対象: <b>${state.pair}</b> ・ 日次対数リターン(bp=0.01%)。
      <b>z</b>は全期間平均との差の標準化値、<b>p</b>は両側p値。|z|≥2 を強調表示。<br>
      ⚠ 約100カテゴリを同時検定しているため、偶然だけでも数個は |z|≥2 になります(多重検定)。
      単発の有意より「複数ペアで同方向に出るか」「期間を分けても再現するか」を重視してください。</p>`;
    for (const f of feats) {
      const gs = S.groupStats(f.labels, returns);
      gs.rows.sort((a, b) => b.mean - a.mean);
      const maxAbs = Math.max(...gs.rows.map(r => Math.abs(r.mean)), 1);
      html += `<div class="stat-block"><h3>${f.name}</h3><p class="mini">${f.desc}</p>
        <table class="stat-table"><thead><tr>
        <th>カテゴリ</th><th>n</th><th>平均(bp)</th><th></th><th>勝率</th>${f.showAbs ? '<th>平均変動幅</th>' : ''}<th>z</th><th>p</th>
        </tr></thead><tbody>`;
      for (const r of gs.rows) {
        const sig = Math.abs(r.z) >= 2;
        const hl = f.highlight && f.highlight.includes(r.label);
        const barW = Math.abs(r.mean) / maxAbs * 60;
        const bar = `<span class="bar ${r.mean >= 0 ? 'pos' : 'neg'}" style="width:${barW}px"></span>`;
        html += `<tr class="${sig ? 'sig' : ''} ${hl ? 'hl' : ''}">
          <td>${r.label}</td><td>${r.n}</td><td class="num">${fmtBp(r.mean)}</td><td>${bar}</td>
          <td class="num">${fmtPct(r.upRate)}</td>${f.showAbs ? `<td class="num">${r.meanAbs.toFixed(1)}bp</td>` : ''}
          <td class="num">${r.z.toFixed(2)}</td><td class="num">${r.p < 0.001 ? '<0.001' : r.p.toFixed(3)}</td></tr>`;
      }
      html += `</tbody></table>
        <p class="mini">全期間: 平均 ${fmtBp(gs.allMean)}bp / 標準偏差 ${gs.allSd.toFixed(1)}bp / n=${gs.allN}</p></div>`;
    }
    host.innerHTML = html;
  }

  /* ---------- タブ3: 類似局面 ---------- */
  function renderSimilarTab() {
    const btn = $('#btn-similar');
    btn.onclick = runSimilar;
    runSimilar();
  }
  function runSimilar() {
    const win = +$('#similar-window').value;
    const afterN = 30, topN = 5;
    const closes = state.data.pairs[state.pair];
    const dates = state.data.dates;
    const matches = S.findSimilar(closes, win, afterN, topN);
    const host = $('#similar-results');
    if (!matches.length) { host.innerHTML = '<p>データ不足です。</p>'; return; }

    // 概況: 上位20件でその後30日に上昇した割合
    const wide = S.findSimilar(closes, win, afterN, 20);
    const upN = wide.filter(m => m.after > 0).length;

    let html = `<p class="note">直近 <b>${win}営業日</b> の ${state.pair} の形状(z正規化)と最も相関が高い過去の局面。
      類似上位${wide.length}件のうち、その後30営業日で上昇したのは <b>${upN}件 (${Math.round(upN / wide.length * 100)}%)</b>。
      ⚠ 形が似ていても背景が同じとは限りません。参考情報であり予測ではありません。</p>`;

    for (const m of matches) {
      const endIdx = m.start + win - 1;
      const r = state.rec[endIdx];
      const evs = window.FXEvents.filter(ev =>
        ev.date >= dates[Math.max(m.start - 10, 0)] && ev.date <= dates[Math.min(endIdx + afterN, dates.length - 1)]);
      html += `<div class="match-block">
        <h3>${dates[m.start]} 〜 ${dates[endIdx]} <span class="mini">相関 r=${m.r.toFixed(3)}</span></h3>
        <p>その後30営業日: <b class="${m.after >= 0 ? 'up' : 'down'}">${m.after >= 0 ? '+' : ''}${m.after.toFixed(2)}%</b></p>
        <p class="mini">終端日の暦: ${koyomiSummary(r)}</p>
        ${evs.length ? `<p class="mini">当時の社会現象: ${evs.map(e => `<span class="ev-chip" style="border-color:${window.FXEventCats[e.cat].color}">${e.date.slice(0, 7)} ${e.title}</span>`).join(' ')}</p>` : ''}
        <canvas class="match-canvas" data-start="${m.start}" width="600" height="120"></canvas>
      </div>`;
    }
    host.innerHTML = html;

    // ミニチャート描画: 過去窓+その後(実線) vs 現在窓(点線)
    const target = S.znorm(closes.slice(closes.length - win));
    $$('.match-canvas').forEach(cv => {
      const start = +cv.dataset.start;
      const seg = closes.slice(start, start + win + afterN);
      const segN = S.znorm(seg);
      const ctx = cv.getContext('2d');
      const W = cv.width, H = cv.height;
      ctx.fillStyle = '#12151c'; ctx.fillRect(0, 0, W, H);
      let lo = Math.min(...segN, ...target), hi = Math.max(...segN, ...target);
      const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
      const x = (i, n) => i / (n - 1) * (W - 10) + 5;
      const y = v => (hi - v) / (hi - lo) * (H - 10) + 5;
      // 過去窓とその後
      ctx.strokeStyle = '#5dc08a'; ctx.lineWidth = 1.3; ctx.beginPath();
      segN.forEach((v, i) => i ? ctx.lineTo(x(i, win + afterN), y(v)) : ctx.moveTo(x(0, win + afterN), y(v)));
      ctx.stroke();
      // 「現在」との境界
      ctx.strokeStyle = '#556070'; ctx.setLineDash([3, 3]); ctx.beginPath();
      ctx.moveTo(x(win - 1, win + afterN), 0); ctx.lineTo(x(win - 1, win + afterN), H); ctx.stroke();
      // 現在の窓(点線・重ね描き)
      ctx.strokeStyle = '#4fa3e8'; ctx.beginPath();
      target.forEach((v, i) => i ? ctx.lineTo(x(i, win + afterN), y(v)) : ctx.moveTo(x(0, win + afterN), y(v)));
      ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#8892a4'; ctx.font = '10px sans-serif';
      ctx.fillText('青点線=現在の形 / 緑=過去の類似局面とその後30日', 8, H - 6);
    });
  }

  /* ---------- タブ4: 年表 ---------- */
  function renderTimelineTab() {
    const { dates, pairs } = state.data;
    const closes = pairs[state.pair];
    let html = `<p class="note">各イベント当日の暦と、<b>${state.pair}</b> の反応(前日終値→5営業日後の変化率)。
      「当時の暦 × 社会現象 × 値動き」を横断で見るための表です。</p>
      <table class="stat-table timeline"><thead><tr>
      <th>日付</th><th>分類</th><th>出来事</th><th>暦</th><th>反応(±5日)</th></tr></thead><tbody>`;
    for (const ev of window.FXEvents) {
      if (ev.date < dates[0]) continue;
      const idx = idxOfDate(ev.date);
      const r = state.rec[idx];
      const i0 = Math.max(idx - 1, 0), i1 = Math.min(idx + 5, closes.length - 1);
      const chg = (closes[i1] / closes[i0] - 1) * 100;
      const cat = window.FXEventCats[ev.cat];
      html += `<tr>
        <td>${ev.date}</td>
        <td><span class="ev-chip" style="border-color:${cat.color}">${cat.label}</span></td>
        <td>${ev.title}</td>
        <td class="mini">${r.moonPhase}・${r.sekkiTerm}・${r.shuku}宿・${r.ganzhi}${r.kasui ? '(' + r.kasui + ')' : ''}・数秘${r.numerology}・水星${r.retro ? '逆' : '順'}</td>
        <td class="num ${chg >= 0 ? 'up' : 'down'}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</td></tr>`;
    }
    html += '</tbody></table>';
    $('#timeline-content').innerHTML = html;
  }

  /* ---------- タブ5: 言霊法則 ---------- */
  function renderKotodamaTab() {
    const anchorJ = K.jdnFromISO(state.settings.gojuonAnchor);
    const todayIdx = K.mod(K.jdnFromISO(new Date().toISOString().slice(0, 10)) - anchorJ, 50);
    let html = `<p class="note">言霊一言法則(稲荷古伝・五十連)の各音の定義。定義行は原本の記載を<b>一字一句そのまま</b>収録しています(要約・改変なし)。
      並び順も原本どおり、ホに起こりマに終わる五十連の順です。この順を1日1音・50日周期の暦として用いています(基準日=ホ、設定タブで変更可)。
      本日の音は <b>「${window.Kotodama.SOUNDS[todayIdx].label}」</b> です。</p>
      <table class="stat-table kotodama"><thead><tr>
      <th>順</th><th>音</th><th>靈</th><th>定義(原文)</th></tr></thead><tbody>`;
    window.Kotodama.SOUNDS.forEach((s, i) => {
      html += `<tr class="${i === todayIdx ? 'sig' : ''}">
        <td>${i + 1}</td><td><b>『${s.label}』</b></td>
        <td class="mini">${s.rei}</td><td class="def">${s.def}</td></tr>`;
    });
    html += `</tbody></table>
      <p class="mini">出典: 利用者所蔵の「言霊一言法則」写本テキスト(安政己未・温知堂謄写の系統)。本日の行をハイライト表示。</p>`;
    $('#kotodama-content').innerHTML = html;
  }

  /* ---------- タブ6: 解説・設定 ---------- */
  function renderDocsTab() {
    $('#set-ayanamsa').value = state.settings.ayanamsa;
    $('#set-gojuon').value = state.settings.gojuonAnchor;
    $('#btn-save-settings').onclick = () => {
      state.settings.ayanamsa = +$('#set-ayanamsa').value || 24;
      const v = $('#set-gojuon').value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) state.settings.gojuonAnchor = v;
      saveSettings();
      buildDerived();
      renderChartTab(); renderVerifyTab(); renderSimilarTab(); renderTimelineTab(); renderKotodamaTab();
      $('#settings-saved').textContent = '保存して再計算しました (' + new Date().toLocaleTimeString() + ')';
    };
  }

  init();
})();
