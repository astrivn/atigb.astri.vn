import { sb, toast, DIM_ORDER, fmtDate } from "./db.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

let DIMS = {}, QUESTIONS = [], OPENQ = [], DISTRICTS =
  ["TP Sơn La","Mộc Châu","Mai Sơn","Yên Châu","Sông Mã","Thuận Châu","Phù Yên","Bắc Yên","Mường La","Khác"];

// nav toggle
$("#navToggle").addEventListener("click", () => $("#navLinks").classList.toggle("open"));
$$("#navLinks a").forEach(a => a.addEventListener("click", () => $("#navLinks").classList.remove("open")));

// ---------- LOAD CONTENT ----------
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
  OPENQ = S.open_questions || [];

  renderHero(S);
  renderStats(S);
  renderIntro(S);
  renderNews(news || []);
  renderAtigb();
  renderSurvey();
  renderPubs(pubs || []);
  renderEvents(events || []);
}

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

function renderAtigb() {
  const g = $("#atigbGrid");
  if (!g) return;
  const byDim = {}; DIM_ORDER.forEach(d=>byDim[d]=0);
  QUESTIONS.forEach(q => byDim[q.dimension] = (byDim[q.dimension]||0)+1);
  const desc = {
    C:"Môi trường pháp lý, chính trị và kinh tế – xã hội định hình quản lý nhà nước về NNCNC.",
    I:"Nguồn lực đầu vào: tài chính, nhân lực, hạ tầng kỹ thuật, hạ tầng số và văn bản pháp quy.",
    O:"Cách bộ máy tổ chức thực thi: quy trình, phối hợp liên ngành, phân cấp và giám sát.",
    OC:"Kết quả đầu ra: diện tích CNC, năng suất, giá trị gia tăng, số doanh nghiệp/HTX tham gia.",
    IM:"Tác động dài hạn: phát triển bền vững, giảm nghèo, cạnh tranh và ứng phó CBAM 2026."
  };
  g.innerHTML = DIM_ORDER.map(d => {
    const c = DIMS[d]?.color || "#137A3A";
    return `<div class="atigb-card" style="--dc:${c}">
      <div class="code">${d}</div>
      <div class="full">${esc(DIMS[d]?.full || '')}</div>
      <h4>${esc(DIMS[d]?.name || d)}</h4>
      <p>${esc(desc[d]||'')}</p>
      <span class="qn">${byDim[d]} câu hỏi</span>
    </div>`;
  }).join("");
}

function renderHero(S) {
  if (S.hero) {
    $("#heroBadge").textContent = S.hero.badge || $("#heroBadge").textContent;
    $("#heroTitle").textContent = S.hero.title || $("#heroTitle").textContent;
    $("#heroSub").textContent = S.hero.subtitle || $("#heroSub").textContent;
  }
  const names = { C:"C — Bối cảnh chính sách", I:"I — Đầu vào thể chế", O:"O — Tổ chức thực hiện", OC:"OC — Tiêu chí kết quả", IM:"IM — Đo lường tác động" };
  $("#heroDims").innerHTML = DIM_ORDER.map(d => {
    const c = DIMS[d]?.color || "#2E7D5B";
    return `<div class="dim-chip" style="justify-content:flex-start"><span class="dim-dot" style="background:${c}"></span>${esc(DIMS[d] ? d+" — "+DIMS[d].name : names[d])}</div>`;
  }).join("");
}

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
    ["📊","Khoảng trống","Chưa có khung đánh giá đa chiều QLNN về NNCNC cho vùng núi phía Bắc — ATiGB lấp khoảng trống này."],
  ];
  $("#whyCards").innerHTML = why.map(([i,t,d]) =>
    `<div class="card"><div class="icon">${i}</div><h3 style="font-size:1.15rem">${t}</h3><p style="color:var(--ink-2);font-size:.95rem">${d}</p></div>`).join("");
}

function renderNews(news) {
  const g = $("#newsGrid");
  if (!news.length) { g.innerHTML = `<p style="color:var(--muted)">Chưa có tin tức.</p>`; return; }
  const icons = ["📰","🌱","📜","🏛️","📈","🚜"];
  g.innerHTML = news.map((n,i) => `
    <article class="news-card ${i===0?'feature':''}">
      <div class="thumb">${n.image_url ? `<img src="${esc(n.image_url)}" style="width:100%;height:100%;object-fit:cover" alt="">` : (icons[i%icons.length])}</div>
      <div class="news-body">
        <div class="meta"><span class="tag">${esc(n.source||'Tin tức')}</span>${n.published_at?`<span>· ${fmtDate(n.published_at)}</span>`:''}</div>
        <h3>${esc(n.title)}</h3>
        <p style="color:var(--ink-2);font-size:.95rem;flex:1">${esc(n.summary||'')}</p>
        ${n.source_url?`<a href="${esc(n.source_url)}" target="_blank" rel="noopener" style="font-weight:600;font-size:.9rem">Đọc thêm →</a>`:''}
      </div>
    </article>`).join("");
}

// ---------- SURVEY ----------
function renderSurvey() {
  // districts
  const dsel = $("#district");
  dsel.innerHTML = `<option value="">— Chọn địa bàn —</option>` + DISTRICTS.map(d=>`<option>${esc(d)}</option>`).join("");

  const byDim = {}; DIM_ORDER.forEach(d => byDim[d] = []);
  QUESTIONS.forEach(q => (byDim[q.dimension] ||= []).push(q));

  const names = { C:"Bối cảnh chính sách", I:"Đầu vào thể chế", O:"Tổ chức thực hiện", OC:"Tiêu chí kết quả", IM:"Đo lường tác động" };
  let html = "";
  DIM_ORDER.forEach((d, idx) => {
    const color = DIMS[d]?.color || "#2E7D5B";
    const qs = byDim[d] || [];
    html += `<div class="step" data-step="${idx+1}">
      <div class="step-head">
        <span class="badge" style="background:${color}">Bước ${idx+2} · Chiều ${d}</span>
        <h3 style="font-size:1.8rem">${esc(DIMS[d]?.name || names[d])}</h3>
        <p style="color:var(--ink-2)">Đánh giá ${qs.length} nội dung theo 2 mốc: Trước 2019 và Hiện nay.</p>
      </div>
      ${qs.map((q,i)=>qItem(q,i+1)).join("")}
      <div class="survey-nav">
        <button type="button" class="btn btn-ghost" data-prev>← Quay lại</button>
        <button type="button" class="btn btn-primary" data-next>Tiếp tục →</button>
      </div>
    </div>`;
  });
  $("#dimSteps").innerHTML = html;

  // open questions
  const oIdx = DIM_ORDER.length + 1;
  $("#openStep").innerHTML = `<div class="step" data-step="${oIdx}">
    <div class="step-head">
      <span class="badge" style="background:var(--gold);color:var(--forest)">Bước ${oIdx+1} · Câu hỏi mở</span>
      <h3 style="font-size:1.8rem">Ý kiến chuyên sâu</h3>
      <p style="color:var(--ink-2)">Anh/Chị vui lòng chia sẻ 2–5 câu theo kinh nghiệm thực tế (không bắt buộc).</p>
    </div>
    ${OPENQ.map(o=>`<div class="card open-q"><label>${esc(o.text)}</label><textarea rows="3" data-open="${esc(o.code)}" placeholder="Ý kiến của Anh/Chị..."></textarea></div>`).join("")}
    <div class="survey-nav">
      <button type="button" class="btn btn-ghost" data-prev>← Quay lại</button>
      <button type="button" class="btn btn-gold" id="submitBtn">Gửi khảo sát ✓</button>
    </div>
  </div>`;

  bindSurveyNav();
}

function qItem(q, num) {
  const mk = (side) => `<div class="likert ${side}">` +
    [1,2,3,4,5].map(v=>`<label><input type="radio" name="${q.code}_${side}" value="${v}"><span class="dot">${v}</span></label>`).join("") +
    `</div><div class="scale-hint"><span>Rất kém</span><span>Rất tốt</span></div>`;
  return `<div class="q-item" data-q="${q.code}">
    <div class="q-text"><span class="q-num">${q.code}.</span><span>${esc(q.text)}</span></div>
    <div class="q-cols">
      <div><div class="q-col-label before">A · Trước 2019</div>${mk("a")}</div>
      <div><div class="q-col-label now">B · Hiện nay</div>${mk("b")}</div>
    </div>
  </div>`;
}

let curStep = 0;
function steps() { return $$("#surveyForm .step"); }
function showStep(i) {
  const all = steps();
  i = Math.max(0, Math.min(i, all.length - 1));
  all.forEach((s,k)=>s.classList.toggle("active", k===i));
  curStep = i;
  updateProgress();
  const y = $("#khaosat").offsetTop - 60;
  window.scrollTo({ top: y, behavior: "smooth" });
}
function updateProgress() {
  const all = steps();
  const total = all.length - 1; // exclude thankyou
  const labels = ["Thông tin chung", ...DIM_ORDER.map(d=>`Chiều ${d} — ${DIMS[d]?.name||''}`), "Câu hỏi mở", "Hoàn thành"];
  const pct = Math.round((curStep/(total)) * 100);
  $("#progFill").style.width = Math.min(pct,100) + "%";
  $("#progCount").textContent = Math.min(pct,100) + "%";
  $("#progLabel").textContent = labels[curStep] || "";
}
function bindSurveyNav() {
  $$("#surveyForm [data-next]").forEach(b=>b.addEventListener("click", ()=>{
    if (curStep===0 && !$("#respType").value) { toast("Vui lòng chọn nhóm đối tượng", true); return; }
    showStep(curStep+1);
  }));
  $$("#surveyForm [data-prev]").forEach(b=>b.addEventListener("click", ()=>showStep(curStep-1)));
  $("#submitBtn").addEventListener("click", submitSurvey);
  updateProgress();
}

async function submitSurvey() {
  const answers = {};
  QUESTIONS.forEach(q => {
    const a = $(`input[name="${q.code}_a"]:checked`)?.value;
    const b = $(`input[name="${q.code}_b"]:checked`)?.value;
    if (a || b) answers[q.code] = { a: a?+a:null, b: b?+b:null };
  });
  const answered = Object.keys(answers).length;
  if (answered < QUESTIONS.length * 0.5) {
    toast(`Vui lòng trả lời thêm (${answered}/${QUESTIONS.length} câu)`, true); return;
  }
  const open = {};
  $$("[data-open]").forEach(t => { if (t.value.trim()) open[t.dataset.open] = t.value.trim(); });

  const payload = {
    respondent_type: $("#respType").value,
    district: $("#district").value || null,
    years_exp: $("#yearsExp").value ? +$("#yearsExp").value : null,
    organization: $("#org").value.trim() || null,
    answers, open_answers: open, status: "raw", is_test: false
  };

  const btn = $("#submitBtn");
  btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Đang gửi...`;
  const { error } = await sb.from("responses").insert(payload);
  if (error) {
    btn.disabled = false; btn.innerHTML = "Gửi khảo sát ✓";
    toast("Lỗi khi gửi: " + error.message, true); return;
  }
  showStep(steps().length - 1);
}

// ---------- RESULTS ----------
function renderPubs(pubs) {
  const kpis = [
    ["ATiGB tổng","3,41","/5 · +57% so với trước 2019"],
    ["Chuyên gia khảo sát","174","tỷ lệ phản hồi 87%"],
    ["Bài báo khoa học","7","2 đã viết · 5 kế hoạch"],
    ["Giải pháp đề xuất","11","tổng 225 tỷ đồng"],
  ];
  $("#resultKpis").innerHTML = kpis.map(([t,n,s])=>`
    <div class="card center"><div style="font-family:var(--serif);font-size:2.8rem;color:var(--forest);line-height:1">${n}</div>
    <div style="font-weight:600;margin:6px 0 2px">${t}</div><div style="color:var(--muted);font-size:.85rem">${s}</div></div>`).join("");

  $("#pubList").innerHTML = pubs.map(p=>`
    <div class="pub-item">
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
      .map(c=>`<div class="ph">🖼️<span class="cap">${c}</span></div>`).join("");
    return;
  }
  g.innerHTML = events.map(e=>`<div class="ph">${e.image_url?`<img src="${esc(e.image_url)}" style="width:100%;height:100%;object-fit:cover" alt="">`:'🖼️'}<span class="cap">${esc(e.title)}${e.event_date?' · '+fmtDate(e.event_date):''}</span></div>`).join("");
}

loadAll().catch(e => { console.error(e); toast("Không tải được dữ liệu. Kiểm tra kết nối.", true); });
