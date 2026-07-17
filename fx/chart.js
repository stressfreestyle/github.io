/* =====================================================================
 * chart.js — Canvas ラインチャート
 * ドラッグでパン、ホイールでズーム、ホバーでツールチップ。
 * オーバーレイ: 縦線(vlines)、背景帯(bands)、マーカー(markers)。
 * ===================================================================== */
(function () {
  'use strict';

  const COLORS = {
    bg: '#12151c', grid: '#232833', axis: '#8892a4',
    line: '#4fa3e8', crosshair: '#556070'
  };

  class Chart {
    constructor(canvas, tooltipEl) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.tooltip = tooltipEl;
      this.dates = [];
      this.values = [];
      this.vlines = [];   // {idx, color, label, dash}
      this.bands = [];    // {i0, i1, color, label}
      this.markers = [];  // {idx, color, label, shape:'▲'|'▼'|'●'}
      this.view = [0, 0]; // [i0, i1] 表示範囲
      this.hoverInfo = null; // idx → 追加HTML を返す関数
      this.pad = { l: 64, r: 16, t: 10, b: 26 };
      this._bind();
    }

    setData(dates, values) {
      this.dates = dates;
      this.values = values;
      const n = values.length;
      this.view = [Math.max(0, n - 500), n - 1];
      this.draw();
    }
    setOverlays(o) {
      this.vlines = o.vlines || [];
      this.bands = o.bands || [];
      this.markers = o.markers || [];
      this.draw();
    }
    showAll() {
      this.view = [0, this.values.length - 1];
      this.draw();
    }

    _bind() {
      const c = this.canvas;
      let dragging = false, dragX = 0, dragView = null;
      c.addEventListener('mousedown', e => {
        dragging = true; dragX = e.offsetX; dragView = [...this.view];
      });
      window.addEventListener('mouseup', () => { dragging = false; });
      c.addEventListener('mousemove', e => {
        if (dragging) {
          const w = c.clientWidth - this.pad.l - this.pad.r;
          const span = dragView[1] - dragView[0];
          const shift = Math.round((dragX - e.offsetX) / w * span);
          let i0 = dragView[0] + shift, i1 = dragView[1] + shift;
          if (i0 < 0) { i1 -= i0; i0 = 0; }
          if (i1 > this.values.length - 1) { i0 -= i1 - (this.values.length - 1); i1 = this.values.length - 1; }
          this.view = [Math.max(0, i0), i1];
          this.draw();
        }
        this._hover(e.offsetX, e.offsetY);
      });
      c.addEventListener('mouseleave', () => { this._hideTip(); this.draw(); });
      c.addEventListener('wheel', e => {
        e.preventDefault();
        const [i0, i1] = this.view;
        const span = i1 - i0;
        const w = c.clientWidth - this.pad.l - this.pad.r;
        const frac = Math.min(Math.max((e.offsetX - this.pad.l) / w, 0), 1);
        const factor = e.deltaY > 0 ? 1.25 : 0.8;
        let newSpan = Math.round(span * factor);
        newSpan = Math.min(Math.max(newSpan, 20), this.values.length - 1);
        const center = i0 + span * frac;
        let n0 = Math.round(center - newSpan * frac);
        let n1 = n0 + newSpan;
        if (n0 < 0) { n1 -= n0; n0 = 0; }
        if (n1 > this.values.length - 1) { n0 -= n1 - (this.values.length - 1); n1 = this.values.length - 1; }
        this.view = [Math.max(0, n0), n1];
        this.draw();
      }, { passive: false });
      // タッチ簡易対応
      let touchX = null, touchView = null;
      c.addEventListener('touchstart', e => {
        if (e.touches.length === 1) { touchX = e.touches[0].clientX; touchView = [...this.view]; }
      }, { passive: true });
      c.addEventListener('touchmove', e => {
        if (e.touches.length === 1 && touchX != null) {
          const w = c.clientWidth - this.pad.l - this.pad.r;
          const span = touchView[1] - touchView[0];
          const shift = Math.round((touchX - e.touches[0].clientX) / w * span);
          let i0 = touchView[0] + shift, i1 = touchView[1] + shift;
          if (i0 < 0) { i1 -= i0; i0 = 0; }
          if (i1 > this.values.length - 1) { i0 -= i1 - (this.values.length - 1); i1 = this.values.length - 1; }
          this.view = [Math.max(0, i0), i1];
          this.draw();
        }
      }, { passive: true });
      new ResizeObserver(() => this.draw()).observe(c);
    }

    _xy() {
      const dpr = window.devicePixelRatio || 1;
      const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
      if (this.canvas.width !== W * dpr) { this.canvas.width = W * dpr; this.canvas.height = H * dpr; }
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const [i0, i1] = this.view;
      let lo = Infinity, hi = -Infinity;
      for (let i = i0; i <= i1; i++) {
        if (this.values[i] < lo) lo = this.values[i];
        if (this.values[i] > hi) hi = this.values[i];
      }
      const margin = (hi - lo) * 0.06 || 1;
      lo -= margin; hi += margin;
      const { l, r, t, b } = this.pad;
      const x = i => l + (i - i0) / Math.max(i1 - i0, 1) * (W - l - r);
      const y = v => t + (hi - v) / (hi - lo) * (H - t - b);
      return { W, H, i0, i1, lo, hi, x, y };
    }

    draw() {
      if (!this.values.length) return;
      const g = this._xy();
      const ctx = this.ctx;
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, g.W, g.H);

      // 背景帯
      for (const bd of this.bands) {
        if (bd.i1 < g.i0 || bd.i0 > g.i1) continue;
        const x0 = g.x(Math.max(bd.i0, g.i0)), x1 = g.x(Math.min(bd.i1, g.i1));
        ctx.fillStyle = bd.color;
        ctx.fillRect(x0, this.pad.t, Math.max(x1 - x0, 1), g.H - this.pad.t - this.pad.b);
      }

      // グリッドとY軸
      ctx.strokeStyle = COLORS.grid; ctx.fillStyle = COLORS.axis;
      ctx.font = '11px sans-serif'; ctx.textAlign = 'right'; ctx.lineWidth = 1;
      const steps = 6;
      for (let k = 0; k <= steps; k++) {
        const v = g.lo + (g.hi - g.lo) * k / steps;
        const yy = g.y(v);
        ctx.beginPath(); ctx.moveTo(this.pad.l, yy); ctx.lineTo(g.W - this.pad.r, yy); ctx.stroke();
        ctx.fillText(v >= 10 ? v.toFixed(2) : v.toFixed(4), this.pad.l - 6, yy + 4);
      }
      // X軸ラベル
      ctx.textAlign = 'center';
      const span = g.i1 - g.i0;
      const tickN = Math.min(8, Math.floor((g.W - 80) / 90));
      for (let k = 0; k <= tickN; k++) {
        const i = Math.round(g.i0 + span * k / tickN);
        const lbl = span > 750 ? this.dates[i].slice(0, 7) : this.dates[i].slice(2);
        ctx.fillText(lbl, g.x(i), g.H - 8);
      }

      // 縦線
      for (const vl of this.vlines) {
        if (vl.idx < g.i0 || vl.idx > g.i1) continue;
        const xx = g.x(vl.idx);
        ctx.strokeStyle = vl.color;
        ctx.setLineDash(vl.dash ? [4, 4] : []);
        ctx.beginPath(); ctx.moveTo(xx, this.pad.t); ctx.lineTo(xx, g.H - this.pad.b); ctx.stroke();
        ctx.setLineDash([]);
        if (vl.label && span < 900) {
          ctx.save();
          ctx.fillStyle = vl.color; ctx.textAlign = 'left';
          ctx.translate(xx + 3, this.pad.t + 4);
          ctx.rotate(Math.PI / 2);
          ctx.fillText(vl.label, 0, 0);
          ctx.restore();
        }
      }

      // 価格ライン
      ctx.strokeStyle = COLORS.line; ctx.lineWidth = 1.4;
      ctx.beginPath();
      const step = Math.max(1, Math.floor(span / (g.W * 2)));
      for (let i = g.i0; i <= g.i1; i += step) {
        const xx = g.x(i), yy = g.y(this.values[i]);
        i === g.i0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
      }
      ctx.stroke();

      // マーカー
      ctx.textAlign = 'center'; ctx.font = '12px sans-serif';
      for (const mk of this.markers) {
        if (mk.idx < g.i0 || mk.idx > g.i1) continue;
        ctx.fillStyle = mk.color;
        ctx.fillText(mk.shape || '●', g.x(mk.idx), g.y(this.values[mk.idx]) - 10);
      }
      this._g = g;
    }

    _hover(px, py) {
      if (!this._g || !this.values.length) return;
      const g = this._g;
      if (px < this.pad.l || px > g.W - this.pad.r) { this._hideTip(); return; }
      const frac = (px - this.pad.l) / (g.W - this.pad.l - this.pad.r);
      const idx = Math.round(g.i0 + (g.i1 - g.i0) * frac);
      if (idx < 0 || idx >= this.values.length) { this._hideTip(); return; }
      this.draw();
      const ctx = this.ctx;
      ctx.strokeStyle = COLORS.crosshair;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(g.x(idx), this.pad.t); ctx.lineTo(g.x(idx), g.H - this.pad.b); ctx.stroke();
      ctx.setLineDash([]);
      if (this.tooltip) {
        let html = `<b>${this.dates[idx]}</b>  ${this.values[idx].toFixed(this.values[idx] >= 10 ? 3 : 5)}`;
        if (this.hoverInfo) html += this.hoverInfo(idx);
        this.tooltip.innerHTML = html;
        this.tooltip.style.display = 'block';
        const rect = this.canvas.getBoundingClientRect();
        const tw = this.tooltip.offsetWidth;
        let left = px + 14;
        if (left + tw > rect.width - 8) left = px - tw - 14;
        this.tooltip.style.left = left + 'px';
        this.tooltip.style.top = Math.min(py + 10, rect.height - this.tooltip.offsetHeight - 8) + 'px';
      }
    }
    _hideTip() { if (this.tooltip) this.tooltip.style.display = 'none'; }
  }

  window.FXChart = Chart;
})();
