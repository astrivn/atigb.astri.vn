// ============================================================
// ATiGB App v2.0 — Main application logic
// Features: PWA, adaptive survey, auto-save, offline queue,
// real-time dashboard, 7-construct framework (C-I-O-OC-IM-D-R)
// ============================================================

import { sb, toast, DIM_ORDER, fmtDate } from "./db.js";
import { initPWA, saveDraft, getDraft, clearDraft, queueResponse, AutoSave } from "./pwa.js";
import { loadDashboard } from "./dashboard.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[c]));
const R2_BASE = (window.ATIGB_CONFIG.R2_PUBLIC_BASE||"").replace(/\/$/,"");
const mediaUrl = (u) => !u ? "" : (/^https?:\/\//.test(u) ? u : (R2_BASE ? R2_BASE+"/"+u.replace(/^\//,"") : u));

// v2.0: Extended dimensions
const DIM_ORDER_V2 = ["C", "I", "O", "OC", "IM", "D", "R"];

const DIM_NAMES_V2 = {
  C: "Bối cảnh chính sách", I: "Đầu vào thể chế", O: "Tổ chức thực hiện",
  OC: "Tiêu chí kết quả", IM: "Đo lường tác động",
  D: "Chuyển đổi số", R: "Khả năng thích ứng"
};

const DIM_DESC_V2 = {
  C: "Môi trường pháp lý, chính trị và kinh tế – xã hội định hình quản lý nhà nước về NNCNC.",
  I: "Nguồn lực đầu vào: tài chính, nhân lực, hạ tầng kỹ thuật, hạ tầng số và văn bản pháp quy.",
  O: "Cách bộ máy tổ chức thực thi: quy trình, phối hợp liên ngành, phân cấp và giám sát.",
  OC: "Kết quả đầu ra: diện tích CNC, năng suất, giá trị gia tăng, số doanh nghiệp/HTX tham gia.",
  IM: "Tác động dài hạn: phát triển bền vững, giảm nghèo, cạnh tranh và ứng phó CBAM 2026.",
  D: "Chuyển đổi số nông nghiệp: IoT, AI, dữ liệu, thương mại điện tử, truy xuất nguồn gốc số.",
  R: "Khả năng thích ứng: CBAM/EUDR readiness, nông nghiệp thông minh khí hậu, quản lý rủi ro."
};

const DIM_COLORS_V2 = {
  C: "#137A3A", I: "#2E7D5B", O: "#4E9A6B", OC: "#8DCB3F",
  IM: "#C77A34", D: "#0279EE", R: "#FD9BED"
};

// Adaptive questions by group
const ADAPTIVE_QUESTIONS = {
  QLNN: [
    { code: "QL1", text: "Đánh giá hiệu quả phân bổ ngân sách cho NNCNC theo kết quả (performance-based budgeting)?" },
    { code: "QL2", text: "Mức độ hoàn thiện hệ thống chỉ tiêu đánh giá (KPI) quản lý NNCNC?" },
    { code: "QL3", text: "Hiệu quả cơ chế phối hợp liên ngành trong giải quyết vướng mắc NNCNC?" },
  ],
  "DN-HTX": [
    { code: "DN1", text: "Mức độ thuận lợi khi tiếp cận các chính sách hỗ trợ NNCNC?" },
    { code: "DN2", text: "Hiệu quả của các chương trình xúc tiến thương mại nông sản công nghệ cao?" },
    { code: "DN3", text: "Khả năng đáp ứng tiêu chuẩn chất lượng cho xuất khẩu?" },
  ],
  NongDan: [
    { code: "ND1", text: "Mức độ tiếp cận đào tạo, tập huấn về NNCNC?" },
    { code: "ND2", text: "Hiệu quả hỗ trợ kỹ thuật từ cán bộ khuyến nông?" },
    { code: "ND3", text: "Mức độ cải thiện thu nhập từ áp dụng công nghệ cao?" },
  ],
  KHCN: [
    { code: "KH1", text: "Hiệu quả cơ chế hợp tác nghiên cứu - chuyển giao công nghệ NNCNC?" },
    { code: "KH2", text: "Mức độ đáp ứng nguồn lực R&D cho NNCNC tại địa phương?" },
    { code: "KH3", text: "Hiệu quả thương mại hóa kết quả nghiên cứu NNCNC?" },
  ],
  NhaKhoaHoc: [
    { code: "KH1", text: "Hiệu quả cơ chế hợp tác nghiên cứu - chuyển giao công nghệ NNCNC?" },
    { code: "KH2", text: "Mức độ đáp ứng nguồn lực R&D cho NNCNC tại địa phương?" },
    { code: "KH3", text: "Hiệu quả thương mại hóa kết quả nghiên cứu NNCNC?" },
  ],
};

// Scenario questions
const SCENARIO_QUESTIONS = [
  { code: "SC1", text: "Nếu CBAM áp dụng đầy đủ từ 2026, mức sẵn sàng của đơn vị/địa bàn anh/chị?", hint: "1 = Chưa sẵn sàng, 5 = Sẵn sàng hoàn toàn" },
  { code: "SC2", text: "Nếu EUDR yêu cầu truy xuất 100% nguồn gốc không phá rừng, tỷ lệ nông sản Sơn La đáp ứng được?", hint: "1 = Dưới 20%, 5 = Trên 80%" },
  { code: "SC3", text: "Nếu đầu tư chuyển đổi số nông nghiệp tăng gấp đôi, thời gian cần thiết để thấy tác động rõ rệt?", hint: "1 = Dưới 1 năm, 5 = Trên 5 năm" },
];

// Open questions v2.0
const OPEN_QUESTIONS_V2 = [
  { code: "OQ1", text: "Theo anh/chị, điểm nghẽn lớn nhất trong quản lý nhà nước về NNCNC tại Sơn La hiện nay là gì?" },
  { code: "OQ2", text: "Anh/chị đề xuất giải pháp ưu tiên nào trong 3 năm tới để thúc đẩy NNCNC?" },
  { code: "OQ3", text: "Anh/chị kỳ vọng gì về chuyển đổi số trong nông nghiệp tại địa bàn mình?" },
  { code: "OQ4", text: "Thách thức lớn nhất của địa bàn anh/chị khi đối mặt với CBAM/EUDR là gì?" },
  { code: "OQ5", text: "Mô hình NNCNC thành công nhất mà anh/chị biết tại địa bàn là gì?" },
  { code: "OQ6", text: "Anh/chị đề xuất gì để cải thiện phối hợp giữa \"4 nhà\" (Nhà nước - Khoa học - Doanh nghiệp - Nông dân)?" },
];

let DIMS = {}, QUESTIONS = [], OPENQ = [], DISTRICTS =
 ["TP Sơn La","Mộc Châu","Mai Sơn","Yên Châu","Sông Mã","Thuận Châu","Phù Yên","Bắc Yên","Mường La","Khác"];

let curStep = 0;
let autoSave = null;

// ============================================================
// INIT
// ============================================================
// Initialize PWA
initPWA();

// Nav toggle
$("#navToggle").addEventListener("click", () => $("#navLinks").classList.toggle("open"));
$$("#navLinks a").forEach(a => a.addEventListener("click", () => $("#navLinks").classList.remove("open")));

// Offline indicator
window.addEventListener('online', () => $("#offlineBar").style.display = 'none');
window.addEventListener('offline', () => $("#offlineBar").style.display = 'block');
if (!navigator.onLine) $("#offlineBar").style.display = 'block';

// ============================================================
// LOAD CONTENT
// ============================================================
async function loadAll() {
  const [{ data: settings }, { data: qs }, { data: news }, { data: pubs }, { data: events }] = await Promise.all([
    sb.from("settings").select("*"),
    sb.from("questions").select("*").eq("is_active", true).order("sort_order"),
    sb.from("news").select("*").eq("is_published", true).order("sort_order"),
    sb.from("publications").select("*").eq("is_published", true).order("sort_order"),
    sb.from("events").select("*").eq("is_published", true).order("sort_order"),
  ]);

  const S = Object.fromEntries((settings || []).map(r => [r.key, r.value]));
  DIMS = S.dimensions || {};
  QUESTIONS = qs || [];
  OPENQ = S.open_questions || OPEN_QUESTIONS_V2;

  renderHero(S);
  renderStats(S);
  renderIntro(S);
  renderNews(news || []);
  renderAtigb();
  renderSurvey();
  renderPubs(pubs || []);
  renderEvents(events || []);

  // Load real-time dashboard
  loadDashboard().catch(e => console.warn('[Dashboard] Load failed:', e));

  // Restore draft if exists
  restoreDraft();
}

// ============================================================
// RENDER: HERO
// ============================================================
function renderHero(S) {
  if (S.hero) {
    $("#heroBadge").textContent = S.hero.badge || $("#heroBadge").textContent;
    $("#heroTitle").textContent = S.hero.title || $("#heroTitle").textContent;
    $("#heroSub").textContent = S.hero.subtitle || $("#heroSub").textContent;
  }

  // v2.0: Show all 7 dimensions
  const allDims = [...DIM_ORDER_V2];
  $("#heroDims").innerHTML = allDims.map(d => {
    const c = DIM_COLORS_V2[d] || "#2E7D5B";
    const name = DIMS[d]?.name || DIM_NAMES_V2[d] || d;
    return `<div class="dim-chip" style="justify-content:flex-start"><span class="dim-dot" style="background:${c}"></span>${d} — ${esc(name)}</div>`;
  }).join("");

  // Update question count
  const qCount = $("#heroQCount");
  if (qCount) qCount.textContent = QUESTIONS.length || 58;
}

// ============================================================
// RENDER: STATS
// ============================================================
function renderStats(S) {
  const stats = S.stats || [];
  const g = $("#statGrid");
  if (!g) return;
  g.innerHTML = stats.map(s => `
  <div class="stat">
  <div><span class="sn">${esc(s.n)}</span><span class="su">${esc(s.unit||'')}</span></div>
  <div class="sl">${esc(s.label)}</div>
  <div class="ss">${esc(s.sub||'')}</div>
  </div>`).join("");
}

// ============================================================
// RENDER: INTRO
// ============================================================
function renderIntro(S) {
  if (S.intro) {
    $("#introHeading").textContent = S.intro.heading || "Giới thiệu & Ý nghĩa";
    $("#introBody").textContent = S.intro.body || "";
    $("#introMeaning").textContent = S.intro.meaning || "";
  }
  const why = [
    ["📜","Chính sách mới","Nghị quyết 57 & Kế hoạch 02-KH/BCĐTW mở hành lang cho chuyển đổi số và NNCNC — Sơn La đang tăng tốc triển khai."],
    ["🌍","Hội nhập & CBAM","Xuất khẩu nông sản đạt 218,4 triệu USD (2025) nhưng CBAM 2026 của EU đặt hàng rào carbon khắt khe."],
    ["🏔️","Đặc thù vùng núi","Tỉnh có 9 vùng NNCNC, hướng tới 25 vùng — tiềm năng lớn song còn nghẽn về thể chế, vốn, nhân lực."],
    ["📊","Khoảng trống","Chưa có khung đánh giá đa chiều QLNN về NNCNC cho vùng núi phía Bắc — ATiGB v2.0 lấp khoảng trống này."],
  ];
  $("#whyCards").innerHTML = why.map(([i,t,d]) =>
    `<div class="card"><div class="icon">${i}</div><h3 style="font-size:1.15rem">${t}</h3><p style="color:var(--ink-2);font-size:.95rem">${d}</p></div>`).join("");
}

// ============================================================
// RENDER: NEWS
// ============================================================
function renderNews(news) {
  const g = $("#newsGrid");
  if (!news.length) { g.innerHTML = `<p style="color:var(--muted)">Chưa có tin tức.</p>`; return; }
  const icons = ["📰","🌱","📜","🏛️","📈","🚜"];
  g.innerHTML = news.map((n,i) => `
  <article class="news-card ${i===0?'feature':''}">
  <div class="thumb">${n.image_url ? `<img src="${esc(mediaUrl(n.image_url))}" style="width:100%;height:100%;object-fit:cover" alt="">` : (icons[i%icons.length])}</div>
  <div class="news-body">
  <div class="meta"><span class="tag">${esc(n.source||'Tin tức')}</span>${n.published_at?`<span>· ${fmtDate(n.published_at)}</span>`:''}</div>
  <h3>${esc(n.title)}</h3>
  <p style="color:var(--ink-2);font-size:.95rem;flex:1">${esc(n.summary||'')}</p>
  ${n.source_url?`<a href="${esc(n.source_url)}" target="_blank" rel="noopener" style="font-weight:600;font-size:.9rem">Đọc thêm →</a>`:''}
  </div>
  </article>`).join("");
}

// ============================================================
// RENDER: ATiGB FRAMEWORK (v2.0 — 7 dimensions)
// ============================================================
function renderAtigb() {
  const g = $("#atigbGrid");
  if (!g) return;
  const byDim = {};
  DIM_ORDER_V2.forEach(d => byDim[d] = 0);
  QUESTIONS.forEach(q => byDim[q.dimension] = (byDim[q.dimension]||0)+1);

  g.innerHTML = DIM_ORDER_V2.map(d => {
    const c = DIM_COLORS_V2[d] || "#137A3A";
    const name = DIMS[d]?.name || DIM_NAMES_V2[d] || d;
    const desc = DIM_DESC_V2[d] || "";
    const isNew = (d === "D" || d === "R") ? '<span class="badge-new">MỚI v2.0</span>' : '';
    return `<div class="atigb-card" style="--dc:${c}">
    <div class="code">${d}</div>
    <div class="full">${esc(name)}</div>
    ${isNew}
    <h4>${esc(name)}</h4>
    <p>${esc(desc)}</p>
    <span class="qn">${byDim[d]} câu hỏi</span>
    </div>`;
  }).join("");
}

// ============================================================
// RENDER: SURVEY (v2.0 — adaptive, auto-save, offline)
// ============================================================
function renderSurvey() {
  // Districts
  const dsel = $("#district");
  dsel.innerHTML = `<option value="">— Chọn địa bàn —</option>` + DISTRICTS.map(d=>`<option>${esc(d)}</option>`).join("");

  // Adaptive: show farm fields for NongDan and DN-HTX
  $("#respType").addEventListener("change", (e) => {
    const showFarm = (e.target.value === "NongDan" || e.target.value === "DN-HTX");
    $("#farmFields").style.display = showFarm ? "flex" : "none";
  });

  // Group questions by dimension
  const byDim = {};
  DIM_ORDER_V2.forEach(d => byDim[d] = []);
  QUESTIONS.forEach(q => (byDim[q.dimension] ||= []).push(q));

  let html = "";
  DIM_ORDER_V2.forEach((d, idx) => {
    const color = DIM_COLORS_V2[d] || "#2E7D5B";
    const qs = byDim[d] || [];
    if (!qs.length) return; // Skip dimensions with no questions (e.g., D/R in v1.0 data)
    const name = DIMS[d]?.name || DIM_NAMES_V2[d] || d;
    const isNew = (d === "D" || d === "R") ? ' <span class="badge-new">MỚI</span>' : '';

    html += `<div class="step" data-step="${idx+1}">
    <div class="step-head">
    <span class="badge" style="background:${color}">Bước ${idx+2} · Chiều ${d}${isNew}</span>
    <h3 style="font-size:1.8rem">${esc(name)}</h3>
    <p style="color:var(--ink-2)">${esc(DIM_DESC_V2[d]||'')} — Đánh giá ${qs.length} nội dung theo 2 mốc.</p>
    </div>
    ${qs.map((q,i) => qItem(q, i+1)).join("")}

    <!-- Adaptive questions for this group after specific dimensions -->
    ${idx === 2 ? renderAdaptive("QLNN", "QLNN", color) : ''}
    ${idx === 1 ? renderAdaptive("KHCN", "KHCN", color) : ''}
    ${idx === 1 ? renderAdaptive("NhaKhoaHoc", "NhaKhoaHoc", color) : ''}
    ${idx === 3 ? renderAdaptive("DN-HTX", "DN-HTX", color) : ''}
    ${idx === 4 ? renderAdaptive("NongDan", "NongDan", color) : ''}

    <div class="survey-nav">
    <button type="button" class="btn btn-ghost" data-prev>← Quay lại</button>
    <button type="button" class="btn btn-primary" data-next>Tiếp tục →</button>
    </div>
    </div>`;
  });
  $("#dimSteps").innerHTML = html;

  // Scenario questions step
  const scIdx = DIM_ORDER_V2.filter(d => byDim[d]?.length > 0).length + 1;
  $("#scenarioStep").innerHTML = `<div class="step" data-step="${scIdx}">
    <div class="step-head">
    <span class="badge" style="background:var(--gold);color:var(--forest)">Bước ${scIdx+1} · Câu hỏi kịch bản</span>
    <h3 style="font-size:1.8rem">Đánh giá theo kịch bản</h3>
    <p style="color:var(--ink-2)">Anh/chị vui lòng đánh giá theo các kịch bản giả định dưới đây.</p>
    </div>
    ${SCENARIO_QUESTIONS.map((s,i) => `
    <div class="q-item" data-q="${s.code}">
    <div class="q-text"><span class="q-num">${s.code}.</span><span>${esc(s.text)}</span></div>
    <div class="q-cols"><div><div class="q-col-label now">Đánh giá</div>
    <div class="likert b">${[1,2,3,4,5].map(v=>`<label><input type="radio" name="${s.code}" value="${v}"><span class="dot">${v}</span></label>`).join("")}</div>
    <div class="scale-hint"><span>${esc(s.hint||'1 = Rất kém')}</span><span>5 = Rất tốt</span></div>
    </div></div>
    </div>`).join("")}
    <div class="survey-nav">
    <button type="button" class="btn btn-ghost" data-prev>← Quay lại</button>
    <button type="button" class="btn btn-primary" data-next>Tiếp tục →</button>
    </div>
    </div>`;

  // Open questions step
  const oIdx = scIdx + 1;
  const openQs = OPENQ.length ? OPENQ : OPEN_QUESTIONS_V2;
  $("#openStep").innerHTML = `<div class="step" data-step="${oIdx}">
    <div class="step-head">
    <span class="badge" style="background:var(--gold);color:var(--forest)">Bước ${oIdx+1} · Câu hỏi mở</span>
    <h3 style="font-size:1.8rem">Ý kiến chuyên sâu</h3>
    <p style="color:var(--ink-2)">Anh/chị vui lòng chia sẻ 2–5 câu theo kinh nghiệm thực tế (không bắt buộc).</p>
    </div>
    ${openQs.map(o=>`<div class="card open-q"><label>${esc(o.text)}</label><textarea rows="3" data-open="${esc(o.code)}" placeholder="Ý kiến của Anh/Chị..."></textarea></div>`).join("")}
    <div class="survey-nav">
    <button type="button" class="btn btn-ghost" data-prev>← Quay lại</button>
    <button type="button" class="btn btn-gold" id="submitBtn">Gửi khảo sát ✓</button>
    </div>
    </div>`;

  bindSurveyNav();

  // Setup auto-save
  autoSave = new AutoSave('survey-draft', 30000);
  autoSave.start(collectSurveyData);
  window.addEventListener('atigb:autosaved', () => {
    const ind = $("#autoSaveIndicator");
    const txt = $("#autoSaveText");
    if (ind && txt) {
      ind.style.display = 'block';
      txt.textContent = 'Đã tự động lưu ' + new Date().toLocaleTimeString('vi-VN');
      setTimeout(() => ind.style.display = 'none', 5000);
    }
  });
}

function renderAdaptive(groupCode, groupLabel, color) {
  const aqs = ADAPTIVE_QUESTIONS[groupCode];
  if (!aqs) return '';
  return `<div class="adaptive-block" data-for-group="${groupCode}" style="display:none">
    <div style="margin:16px 0 8px;padding:10px 14px;background:var(--cream-2);border-radius:8px;font-size:.85rem;color:var(--ink-2)">
    <b>Câu hỏi chuyên biệt cho ${esc(groupLabel)}:</b>
    </div>
    ${aqs.map((q,i) => qItem(q, i+1, true)).join("")}
  </div>`;
}

function qItem(q, num, isAdaptive = false) {
  const mk = (side) => `<div class="likert ${side}">` +
    [1,2,3,4,5].map(v=>`<label><input type="radio" name="${q.code}_${side}" value="${v}"><span class="dot">${v}</span></label>`).join("") +
    `</div><div class="scale-hint"><span>Rất kém</span><span>Rất tốt</span></div>`;
  return `<div class="q-item ${isAdaptive?'adaptive-q':''}" data-q="${q.code}">
  <div class="q-text"><span class="q-num">${q.code}.</span><span>${esc(q.text)}</span></div>
  <div class="q-cols">
  <div><div class="q-col-label before">A · Trước 2019</div>${mk("a")}</div>
  <div><div class="q-col-label now">B · Hiện nay</div>${mk("b")}</div>
  </div>
  </div>`;
}

// ============================================================
// SURVEY NAVIGATION
// ============================================================
function steps() { return $$("#surveyForm .step"); }

function showStep(i) {
  const all = steps();
  i = Math.max(0, Math.min(i, all.length - 1));

  // Show/hide adaptive blocks based on selected group
  const group = $("#respType").value;
  all.forEach(s => {
    s.classList.toggle("active", false);
    // Show adaptive questions for selected group
    s.querySelectorAll('.adaptive-block').forEach(b => {
      b.style.display = (b.dataset.forGroup === group) ? 'block' : 'none';
    });
  });
  all[i].classList.add("active");
  curStep = i;
  updateProgress();
  const y = $("#khaosat").offsetTop - 60;
  window.scrollTo({ top: y, behavior: "smooth" });
}

function updateProgress() {
  const all = steps();
  const total = all.length - 1;
  const activeDims = DIM_ORDER_V2.filter(d => {
    const qs = QUESTIONS.filter(q => q.dimension === d);
    return qs.length > 0;
  });
  const labels = ["Thông tin chung", ...activeDims.map(d => `Chiều ${d}`), "Kịch bản", "Câu hỏi mở", "Hoàn thành"];
  const pct = Math.round((curStep / total) * 100);
  $("#progFill").style.width = Math.min(pct,100) + "%";
  $("#progCount").textContent = Math.min(pct,100) + "%";
  $("#progLabel").textContent = labels[curStep] || "";
}

function bindSurveyNav() {
  $$("#surveyForm [data-next]").forEach(b => b.addEventListener("click", () => {
    if (curStep === 0 && !$("#respType").value) {
      toast("Vui lòng chọn nhóm đối tượng", true);
      return;
    }
    showStep(curStep + 1);
  }));
  $$("#surveyForm [data-prev]").forEach(b => b.addEventListener("click", () => showStep(curStep - 1)));
  $("#submitBtn").addEventListener("click", submitSurvey);
  updateProgress();
}

// ============================================================
// COLLECT SURVEY DATA
// ============================================================
function collectSurveyData() {
  const answers = {};
  QUESTIONS.forEach(q => {
    const a = $(`input[name="${q.code}_a"]:checked`)?.value;
    const b = $(`input[name="${q.code}_b"]:checked`)?.value;
    if (a || b) answers[q.code] = { a: a ? +a : null, b: b ? +b : null };
  });

  // Adaptive questions
  const group = $("#respType").value;
  const aqs = ADAPTIVE_QUESTIONS[group] || [];
  aqs.forEach(q => {
    const a = $(`input[name="${q.code}_a"]:checked`)?.value;
    const b = $(`input[name="${q.code}_b"]:checked`)?.value;
    if (a || b) answers[q.code] = { a: a ? +a : null, b: b ? +b : null };
  });

  // Scenario questions
  SCENARIO_QUESTIONS.forEach(s => {
    const v = $(`input[name="${s.code}"]:checked`)?.value;
    if (v) answers[s.code] = { a: null, b: +v };
  });

  return {
    respondent_type: $("#respType").value,
    district: $("#district").value || null,
    years_exp: $("#yearsExp").value ? +$("#yearsExp").value : null,
    organization: $("#org").value.trim() || null,
    ethnicity: $("#ethnicity").value || null,
    education: $("#education").value || null,
    farm_size: $("#farmSize").value ? +$("#farmSize").value : null,
    main_crop: $("#mainCrop").value || null,
    digital_usage: $("#digitalUsage").value || null,
    answers,
    step: curStep
  };
}

// ============================================================
// SUBMIT SURVEY
// ============================================================
async function submitSurvey() {
  const data = collectSurveyData();
  const answered = Object.keys(data.answers).length;
  const totalQs = QUESTIONS.length;
  if (answered < totalQs * 0.5) {
    toast(`Vui lòng trả lời thêm (${answered}/${totalQs} câu)`, true);
    return;
  }

  const open = {};
  $$("[data-open]").forEach(t => { if (t.value.trim()) open[t.dataset.open] = t.value.trim(); });

  const payload = {
    respondent_type: data.respondent_type,
    district: data.district,
    years_exp: data.years_exp,
    organization: data.organization,
    ethnicity: data.ethnicity,
    education: data.education,
    farm_size: data.farm_size,
    main_crop: data.main_crop,
    digital_usage: data.digital_usage,
    answers: data.answers,
    open_answers: open,
    status: "raw",
    is_test: false,
    round: 2  // v2.0 = round 2
  };

  const btn = $("#submitBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Đang gửi...`;

  // Check if online
  if (!navigator.onLine) {
    // Queue for later sync
    await queueResponse(payload);
    btn.disabled = false;
    btn.innerHTML = "Gửi khảo sát ✓";
    toast("Đã lưu ngoại tuyến. Sẽ tự động gửi khi có mạng.", false);
    showStep(steps().length - 1);
    if (autoSave) autoSave.stop();
    clearDraft('survey-draft');
    return;
  }

  // Try online submit
  const { error } = await sb.from("responses").insert(payload);
  if (error) {
    // Fallback: queue for retry
    await queueResponse(payload);
    btn.disabled = false;
    btn.innerHTML = "Gửi khảo sát ✓";
    toast("Lỗi mạng — đã lưu tạm, sẽ tự gửi lại.", false);
    showStep(steps().length - 1);
    return;
  }

  showStep(steps().length - 1);
  if (autoSave) autoSave.stop();
  clearDraft('survey-draft');

  // Refresh dashboard
  loadDashboard().catch(() => {});
}

// ============================================================
// DRAFT RESTORE
// ============================================================
async function restoreDraft() {
  const draft = await getDraft('survey-draft');
  if (!draft || !draft.answers || Object.keys(draft.answers).length === 0) return;

  // Show restore prompt
  const wrap = $(".survey-wrap");
  if (!wrap) return;
  const banner = document.createElement('div');
  banner.className = 'card';
  banner.style.cssText = 'padding:16px;margin-bottom:16px;background:var(--cream-2);display:flex;align-items:center;justify-content:space-between;gap:12px';
  banner.innerHTML = `
    <div><b>📝 Có bản nháp chưa hoàn thành</b><br><span style="font-size:.85rem;color:var(--ink-2)">Anh/chị có muốn tiếp tục từ nơi đã dừng?</span></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary btn-sm" id="restoreYes">Tiếp tục</button>
      <button class="btn btn-ghost btn-sm" id="restoreNo">Bắt đầu lại</button>
    </div>
  `;
  wrap.insertBefore(banner, wrap.firstChild);

  $("#restoreYes").addEventListener("click", () => {
    // Restore answers
    Object.entries(draft.answers).forEach(([code, vals]) => {
      if (vals.a) $(`input[name="${code}_a"][value="${vals.a}"]`)?.click();
      if (vals.b) $(`input[name="${code}_b"][value="${vals.b}"]`)?.click();
    });
    // Restore demographics
    if (draft.respondent_type) $("#respType").value = draft.respondent_type;
    if (draft.district) $("#district").value = draft.district;
    if (draft.years_exp) $("#yearsExp").value = draft.years_exp;
    if (draft.organization) $("#org").value = draft.organization;
    if (draft.ethnicity) $("#ethnicity").value = draft.ethnicity;
    if (draft.education) $("#education").value = draft.education;
    if (draft.farm_size) $("#farmSize").value = draft.farm_size;
    if (draft.main_crop) $("#mainCrop").value = draft.main_crop;
    if (draft.digital_usage) $("#digitalUsage").value = draft.digital_usage;
    // Trigger farm fields display
    if (draft.respondent_type === "NongDan" || draft.respondent_type === "DN-HTX") {
      $("#farmFields").style.display = "flex";
    }
    banner.remove();
    toast("Đã khôi phục bản nháp", false);
  });

  $("#restoreNo").addEventListener("click", () => {
    clearDraft('survey-draft');
    banner.remove();
  });
}

// ============================================================
// RESULTS (publications + events)
// ============================================================
function renderPubs(pubs) {
  const kpis = [
    ["ATiGB tổng","3,34","/5 · Mức 3 — Tích hợp · +50% so với trước 2019"],
    ["Phiếu khảo sát","360","phát 420 · thu 385 · hợp lệ 93,5%"],
    ["Bài báo khoa học","7","2 đã viết · 5 kế hoạch"],
    ["Giải pháp đề xuất","11","tổng 225 tỷ đồng"],
  ];
  $("#resultKpis").innerHTML = kpis.map(([t,n,s]) =>
    `<div class="card center"><div style="font-family:var(--serif);font-size:2.8rem;color:var(--forest);line-height:1">${n}</div>
    <div style="font-weight:600;margin:6px 0 2px">${t}</div><div style="color:var(--muted);font-size:.85rem">${s}</div></div>`).join("");

  $("#pubList").innerHTML = pubs.map(p =>
    `<div class="pub-item">
    <div class="pub-code">${esc(p.code||'BB')}</div>
    <div style="flex:1">
    <h3 style="font-size:1.12rem;line-height:1.3">${esc(p.title)}</h3>
    <div class="pub-meta">
    ${p.journal?`<span class="pill">${esc(p.journal)}</span>`:''}
    ${p.paper_type?`<span class="pill q">${esc(p.paper_type)}</span>`:''}
    ${p.status?`<span class="pill">${esc(p.status)}</span>`:''}
    </div>
    </div>
    </div>`).join("");
}

function renderEvents(events) {
  const g = $("#eventGallery");
  if (!events.length) {
    g.innerHTML = ["Khảo sát thực địa","Hội thảo chuyên đề","Phỏng vấn chuyên gia","Vùng NNCNC Sơn La","Làm việc với Sở NN","Mô hình HTX"]
    .map(c => `<div class="ph">🖼️<span class="cap">${c}</span></div>`).join("");
    return;
  }
  g.innerHTML = events.map(e => `<div class="ph">${e.image_url?`<img src="${esc(mediaUrl(e.image_url))}" style="width:100%;height:100%;object-fit:cover" alt="">`:'🖼️'}<span class="cap">${esc(e.title)}${e.event_date?' · '+fmtDate(e.event_date):''}</span></div>`).join("");
}

// ============================================================
// START
// ============================================================
loadAll().catch(e => { console.error(e); toast("Không tải được dữ liệu. Kiểm tra kết nối.", true); });
