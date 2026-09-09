// ============================================================
// ATiGB Public Results Dashboard v2.0
// Real-time results visualization — auto-updates from Supabase.
// Renders: radar, grouped bar, heatmap, KPI cards, trend line.
// ============================================================

import { sb, DIM_ORDER, fmtDate } from "./db.js";
import * as Chart from "./charts.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[c]));

// Extended dimension order for v2.0
const DIM_ORDER_V2 = ["C", "I", "O", "OC", "IM", "D", "R"];

const DIM_NAMES = {
  C: "Bối cảnh", I: "Đầu vào", O: "Tổ chức", OC: "Kết quả",
  IM: "Tác động", D: "Chuyển đổi số", R: "Khả năng thích ứng"
};

const DIM_COLORS = {
  C: "#137A3A", I: "#2E7D5B", O: "#4E9A6B", OC: "#8DCB3F",
  IM: "#C77A34", D: "#0279EE", R: "#FD9BED"
};

// ---------- State ----------
let allResponses = [];
let allQuestions = [];
let settings = {};
let activeFilter = { group: '', district: '', round: '' };

// ---------- Load ----------
export async function loadDashboard() {
  const el = $('#dashboardRoot');
  if (!el) return;

  try {
    const [{ data: st }, { data: qs }, { data: rs }] = await Promise.all([
      sb.from("settings").select("*"),
      sb.from("questions").select("*").eq("is_active", true).order("sort_order"),
      sb.from("responses").select("*").neq("status", "excluded").order("created_at", { ascending: false }),
    ]);

    settings = Object.fromEntries((st || []).map(r => [r.key, r.value]));
    allQuestions = qs || [];
    allResponses = (rs || []).filter(r => !r.is_test);

    renderDashboard();
    setupFilters();
  } catch (e) {
    console.error('[Dashboard] Load failed:', e);
    el.innerHTML = `<p style="color:var(--muted);text-align:center;padding:40px">Không tải được dữ liệu. Vui lòng tải lại trang.</p>`;
  }
}

// ---------- Compute Stats ----------
function qByDim() {
  const m = {};
  [...DIM_ORDER_V2, ...DIM_ORDER].forEach(d => m[d] = []);
  allQuestions.forEach(q => (m[q.dimension] ||= []).push(q));
  return m;
}

function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

function dimMean(rows, dim, side) {
  const qs = qByDim()[dim]?.map(q => q.code) || [];
  const vals = [];
  rows.forEach(r => qs.forEach(c => {
    const v = r.answers?.[c]?.[side];
    if (v != null) vals.push(+v);
  }));
  return mean(vals);
}

function overallMean(rows, side) {
  const dims = getAvailableDims(rows);
  return mean(dims.map(d => dimMean(rows, d, side)).filter(x => x > 0));
}

function getAvailableDims(rows) {
  // Check which dimensions have data
  return DIM_ORDER_V2.filter(d => {
    const qs = qByDim()[d]?.map(q => q.code) || [];
    if (!qs.length) return false;
    return rows.some(r => qs.some(c => r.answers?.[c]?.b != null));
  });
}

function filteredRows() {
  let rows = allResponses.slice();
  if (activeFilter.group) rows = rows.filter(r => r.respondent_type === activeFilter.group);
  if (activeFilter.district) rows = rows.filter(r => r.district === activeFilter.district);
  if (activeFilter.round) rows = rows.filter(r => String(r.round || 1) === activeFilter.round);
  return rows;
}

// ---------- Render ----------
function renderDashboard() {
  const rows = filteredRows();
  const dims = getAvailableDims(rows);
  const nowAll = overallMean(rows, "b");
  const befAll = overallMean(rows, "a");
  const n = rows.length;

  // KPI Cards
  const kpis = [
    ["Phiếu hợp lệ", n, `tổng số phản hồi`, ""],
    ["ATiGB tổng (nay)", nowAll.toFixed(2), `trên thang 5,00`, befAll ? `+${((nowAll - befAll) / befAll * 100).toFixed(0)}% so với trước 2019` : ""],
    ["Số chiều đo", dims.length, dims.includes('D') ? "v2.0 (7 trụ)" : "v1.0 (5 trụ)", ""],
    ["Cải thiện trung bình", befAll ? `+${(nowAll - befAll).toFixed(2)}` : "—", "điểm Likert", befAll ? `từ ${befAll.toFixed(2)} → ${nowAll.toFixed(2)}` : ""],
  ];

  const kpiHtml = kpis.map(([t, n2, s, d]) =>
    `<div class="card center" style="padding:20px"><div style="font-family:var(--serif);font-size:2.4rem;color:var(--forest);line-height:1">${n2}</div><div style="font-weight:600;margin:6px 0 2px;font-size:.95rem">${t}</div><div style="color:var(--muted);font-size:.82rem">${s}</div>${d ? `<div style="color:var(--lime-bright);font-size:.82rem;margin-top:4px">${d}</div>` : ""}</div>`
  ).join("");

  // Radar chart
  const radarEl = $('#dashRadar');
  if (radarEl) {
    Chart.radar(radarEl, {
      labels: dims,
      series: [
        { name: "Trước 2019", color: "#C77A34", values: dims.map(d => dimMean(rows, d, "a")) },
        { name: "Hiện nay", color: "#16883F", values: dims.map(d => dimMean(rows, d, "b")) },
      ]
    });
  }

  // Grouped bar
  const barEl = $('#dashBar');
  if (barEl) {
    Chart.groupedBar(barEl, {
      labels: dims,
      series: [
        { name: "Trước 2019", color: "#E3B183", values: dims.map(d => dimMean(rows, d, "a")) },
        { name: "Hiện nay", color: "#16883F", values: dims.map(d => dimMean(rows, d, "b")) },
      ]
    });
  }

  // Heatmap by group × dimension
  const heatEl = $('#dashHeat');
  if (heatEl) {
    renderHeatmap(heatEl, rows, dims);
  }

  // Low/high indicators
  const indicatorStats = computeIndicatorStats(rows);
  const lowEl = $('#dashLow');
  const highEl = $('#dashHigh');
  if (lowEl) {
    lowEl.innerHTML = indicatorStats.low.slice(0, 5).map(([code, val]) =>
      `<div class="ind-row"><span class="ind-code">${esc(code)}</span><span class="ind-bar"><span style="width:${val / 5 * 100}%"></span></span><span class="ind-val">${val.toFixed(2)}</span></div>`
    ).join("");
  }
  if (highEl) {
    highEl.innerHTML = indicatorStats.high.slice(0, 5).map(([code, val]) =>
      `<div class="ind-row"><span class="ind-code">${esc(code)}</span><span class="ind-bar"><span style="width:${val / 5 * 100}%"></span></span><span class="ind-val">${val.toFixed(2)}</span></div>`
    ).join("");
  }

  // Assemble
  const el = $('#dashboardRoot');
  if (el) {
    el.innerHTML = `
      <div class="grid g-4" style="gap:16px;margin-bottom:32px">${kpiHtml}</div>

      <div class="grid g-2" style="gap:24px;margin-bottom:32px">
        <div class="card" style="padding:24px">
          <h3 style="font-size:1.15rem;margin-bottom:16px">Radar ATiGB — Trước 2019 vs Hiện nay</h3>
          <div id="dashRadar"></div>
        </div>
        <div class="card" style="padding:24px">
          <h3 style="font-size:1.15rem;margin-bottom:16px">So sánh theo chiều đo</h3>
          <div id="dashBar"></div>
        </div>
      </div>

      <div class="card" style="padding:24px;margin-bottom:32px">
        <h3 style="font-size:1.15rem;margin-bottom:16px">Bản đồ nhiệt — Nhóm đối tượng × Chiều đo (Hiện nay)</h3>
        <div id="dashHeat"></div>
      </div>

      <div class="grid g-2" style="gap:24px">
        <div class="card" style="padding:24px">
          <h3 style="font-size:1.15rem;margin-bottom:16px">5 chỉ báo thấp nhất</h3>
          <div id="dashLow"></div>
        </div>
        <div class="card" style="padding:24px">
          <h3 style="font-size:1.15rem;margin-bottom:16px">5 chỉ báo cao nhất</h3>
          <div id="dashHigh"></div>
        </div>
      </div>
    `;
    // Re-render charts after DOM update
    setTimeout(() => {
      const r = $('#dashRadar');
      const b = $('#dashBar');
      const h = $('#dashHeat');
      if (r) Chart.radar(r, {
        labels: dims,
        series: [
          { name: "Trước 2019", color: "#C77A34", values: dims.map(d => dimMean(rows, d, "a")) },
          { name: "Hiện nay", color: "#16883F", values: dims.map(d => dimMean(rows, d, "b")) },
        ]
      });
      if (b) Chart.groupedBar(b, {
        labels: dims,
        series: [
          { name: "Trước 2019", color: "#E3B183", values: dims.map(d => dimMean(rows, d, "a")) },
          { name: "Hiện nay", color: "#16883F", values: dims.map(d => dimMean(rows, d, "b")) },
        ]
      });
      if (h) renderHeatmap(h, rows, dims);
    }, 50);
  }
}

// ---------- Heatmap ----------
function heatColor(v) {
  const stops = [[1, "#B23A48"], [2.5, "#D08A2E"], [3.5, "#7FB03C"], [5, "#16883F"]];
  for (let i = 0; i < stops.length - 1; i++) {
    if (v <= stops[i + 1][0]) return stops[i + 1][1];
  }
  return "#16883F";
}

function renderHeatmap(el, rows, dims) {
  const types = [...new Set(rows.map(r => r.respondent_type).filter(Boolean))];
  const TYPE_LABEL = {
    QLNN: "Cán bộ QLNN", "DN-HTX": "DN / HTX", KHCN: "Chuyên gia KHCN",
    NhaKhoaHoc: "Nhà khoa học", NongDan: "Nông dân"
  };

  let html = `<table class="heat" style="width:100%;font-size:.85rem"><thead><tr><th style="text-align:left"></th>`;
  html += dims.map(d => `<th style="text-align:center;padding:6px 8px;font-weight:700;color:${DIM_COLORS[d] || '#137A3A'}">${d}</th>`).join("");
  html += `</tr></thead><tbody>`;

  types.forEach(t => {
    const sub = rows.filter(r => r.respondent_type === t);
    html += `<tr><td style="padding:6px 10px;font-weight:600;white-space:nowrap">${esc(TYPE_LABEL[t] || t)}</td>`;
    html += dims.map(d => {
      const v = dimMean(sub, d, "b");
      return `<td style="text-align:center;padding:8px;background:${heatColor(v)};color:#fff;font-weight:700;border-radius:4px">${v ? v.toFixed(2) : "–"}</td>`;
    }).join("");
    html += `</tr>`;
  });

  // Overall row
  html += `<tr><td style="padding:6px 10px;font-weight:700;background:var(--forest);color:#fff;border-radius:4px">Chung</td>`;
  html += dims.map(d => {
    const v = dimMean(rows, d, "b");
    return `<td style="text-align:center;padding:8px;background:${heatColor(v)};color:#fff;font-weight:700;border-radius:4px">${v.toFixed(2)}</td>`;
  }).join("");
  html += `</tr></tbody></table>`;

  el.innerHTML = html;
}

// ---------- Indicator Stats ----------
function computeIndicatorStats(rows) {
  const stats = [];
  allQuestions.forEach(q => {
    const vals = [];
    rows.forEach(r => {
      const v = r.answers?.[q.code]?.b;
      if (v != null) vals.push(+v);
    });
    if (vals.length > 0) {
      stats.push([q.code, mean(vals)]);
    }
  });
  stats.sort((a, b) => a[1] - b[1]);
  return {
    low: stats.slice(0, 5),
    high: stats.slice(-5).reverse()
  };
}

// ---------- Filters ----------
function setupFilters() {
  const filterBar = $('#dashFilters');
  if (!filterBar) return;

  const groups = [...new Set(allResponses.map(r => r.respondent_type).filter(Boolean))];
  const districts = [...new Set(allResponses.map(r => r.district).filter(Boolean))];
  const rounds = [...new Set(allResponses.map(r => String(r.round || 1)).filter(Boolean))];

  const TYPE_LABEL = {
    QLNN: "Cán bộ QLNN", "DN-HTX": "DN / HTX", KHCN: "Chuyên gia KHCN",
    NhaKhoaHoc: "Nhà khoa học", NongDan: "Nông dân"
  };

  filterBar.innerHTML = `
    <div class="dash-filter-row">
      <label>Nhóm đối tượng</label>
      <select id="fltGroup">
        <option value="">Tất cả</option>
        ${groups.map(g => `<option value="${esc(g)}">${esc(TYPE_LABEL[g] || g)}</option>`).join("")}
      </select>
      <label>Địa bàn</label>
      <select id="fltDistrict">
        <option value="">Tất cả</option>
        ${districts.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join("")}
      </select>
      <label>Đợt khảo sát</label>
      <select id="fltRound">
        <option value="">Tất cả</option>
        ${rounds.map(r => `<option value="${esc(r)}">Đợt ${esc(r)}</option>`).join("")}
      </select>
      <button class="btn btn-primary btn-sm" id="fltApply">Áp dụng</button>
      <button class="btn btn-ghost btn-sm" id="fltReset">Đặt lại</button>
    </div>
  `;

  $('#fltApply').addEventListener('click', () => {
    activeFilter.group = $('#fltGroup').value;
    activeFilter.district = $('#fltDistrict').value;
    activeFilter.round = $('#fltRound').value;
    renderDashboard();
  });

  $('#fltReset').addEventListener('click', () => {
    activeFilter = { group: '', district: '', round: '' };
    $('#fltGroup').value = '';
    $('#fltDistrict').value = '';
    $('#fltRound').value = '';
    renderDashboard();
  });
}
