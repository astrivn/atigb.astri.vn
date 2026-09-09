// ============================================================
// ATiGB Admin v2.0 — Upgraded admin panel
// Features: 7-construct support, enumerator management,
// data quality dashboard, multi-round comparison.
// ============================================================

import { sb, toast, DIM_ORDER, fmtDate } from "./db.js";
import * as Chart from "./charts.js";

const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const esc = (s)=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

const TYPE_LABEL = { QLNN:"Cán bộ QLNN", "DN-HTX":"DN / HTX", KHCN:"Chuyên gia KHCN", NhaKhoaHoc:"Nhà khoa học", NongDan:"Nông dân" };

// v2.0: Extended dimensions
const DIM_ORDER_V2 = ["C", "I", "O", "OC", "IM", "D", "R"];
const DIM_NAME_V2 = {
  C:"Bối cảnh (C)", I:"Đầu vào (I)", O:"Tổ chức (O)", OC:"Kết quả (OC)",
  IM:"Tác động (IM)", D:"Chuyển đổi số (D)", R:"Khả năng thích ứng (R)"
};
const DIM_COLORS_V2 = {
  C:"#137A3A", I:"#2E7D5B", O:"#4E9A6B", OC:"#8DCB3F",
  IM:"#C77A34", D:"#0279EE", R:"#FD9BED"
};

let DIMS = {}, QUESTIONS = [], RESPONSES = [], SETTINGS = {};
let ENUMERATORS = [];
let activeDims = DIM_ORDER; // auto-detected

// ============ AUTH ============
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#loginBtn"); btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Đang đăng nhập...`;
  $("#loginErr").textContent = "";
  const { error } = await sb.auth.signInWithPassword({ email: $("#email").value, password: $("#password").value });
  btn.disabled = false; btn.textContent = "Đăng nhập";
  if (error) { $("#loginErr").textContent = "Sai email hoặc mật khẩu."; return; }
  boot();
});
$("#logoutBtn").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });

async function checkAuth() {
  const { data } = await sb.auth.getSession();
  if (data.session) boot();
}
async function boot() {
  const { data } = await sb.auth.getUser();
  $("#userEmail").textContent = data.user?.email || "";
  $("#loginView").classList.add("hidden");
  $("#adminView").classList.remove("hidden");
  await loadData();
}

// ============ NAV ============
$$(".side-nav button").forEach(b => b.addEventListener("click", () => {
  $$(".side-nav button").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  $$(".view").forEach(v=>v.classList.remove("active"));
  $("#view-"+b.dataset.view).classList.add("active");
  // Lazy-load views
  const v = b.dataset.view;
  if (v === "enumerators") renderEnumerators();
  if (v === "quality") renderDataQuality();
  if (v === "rounds") renderMultiRound();
}));

// ============ LOAD ============
async function loadData() {
  const [{ data: st }, { data: qs }, { data: rs }, { data: enums }] = await Promise.all([
    sb.from("settings").select("*"),
    sb.from("questions").select("*").order("sort_order"),
    sb.from("responses").select("*").order("created_at", { ascending: false }),
    sb.from("enumerators").select("*").order("created_at", { ascending: false }).catch(() => ({ data: null })),
  ]);
  SETTINGS = Object.fromEntries((st||[]).map(r=>[r.key,r.value]));
  DIMS = SETTINGS.dimensions || {};
  QUESTIONS = qs || [];
  RESPONSES = rs || [];
  ENUMERATORS = enums || [];

  // Auto-detect available dimensions
  activeDims = getAvailableDims(RESPONSES);

  // populate filters
  const types = [...new Set(RESPONSES.map(r=>r.respondent_type).filter(Boolean))];
  $("#fltType").innerHTML = `<option value="">Mọi nhóm</option>` + types.map(t=>`<option value="${t}">${esc(TYPE_LABEL[t]||t)}</option>`).join("");

  // Update dashboard title to reflect version
  const dashTitle = $("#view-dashboard .page-head h1");
  if (dashTitle) dashTitle.textContent = `Dashboard ${activeDims.length > 5 ? 'v2.0 (7 chiều)' : 'v1.0 (5 chiều)'}`;

  renderDashboard();
  renderTable();
  renderContentAdmin();
}

// ============ DIMENSION DETECTION ============
function getAvailableDims(rows) {
  const qDims = new Set(QUESTIONS.map(q => q.dimension));
  return DIM_ORDER_V2.filter(d => qDims.has(d));
}

function qByDim(){
  const m = {};
  activeDims.forEach(d => m[d] = []);
  QUESTIONS.forEach(q => { if (m[q.dimension]) m[q.dimension].push(q); });
  return m;
}

// ============ STATS ============
function filterSet(){
  let rows = RESPONSES.slice();
  if (!$("#inclTest").checked) rows = rows.filter(r=>!r.is_test);
  const f = $("#dashFilter").value;
  if (f!=="all") rows = rows.filter(r=>r.status===f);
  return rows.filter(r=>r.status!=="excluded");
}
function mean(arr){ return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function dimMean(rows, dim, side){
  const qs = qByDim()[dim]?.map(q=>q.code) || []; const vals=[];
  rows.forEach(r=>qs.forEach(c=>{ const v=r.answers?.[c]?.[side]; if(v!=null) vals.push(+v); }));
  return mean(vals);
}
function qMean(rows, code, side){ const vals=[]; rows.forEach(r=>{const v=r.answers?.[code]?.[side]; if(v!=null)vals.push(+v);}); return mean(vals); }
function overallMean(rows, side){ return mean(activeDims.map(d=>dimMean(rows,d,side)).filter(x=>x>0)); }

// ============ DASHBOARD ============
function renderDashboard() {
  const rows = filterSet();
  const nowAll = overallMean(rows,"b"), befAll = overallMean(rows,"a");
  const im5now = qMean(rows,"IM5","b");
  const r1Count = rows.filter(r => !r.round || r.round === 1).length;
  const r2Count = rows.filter(r => r.round === 2).length;
  const hasV2 = activeDims.length > 5;

  const kpis = [
    ["ATiGB tổng (nay)", nowAll.toFixed(2), `trên thang 5,00 · ${activeDims.length} chiều`, `+${(nowAll-befAll).toFixed(2)} so với trước 2019`],
    ["Số phản hồi", rows.length, `${r1Count} đợt 1 · ${r2Count} đợt 2`, `${rows.filter(r=>!r.is_test).length} thật · ${rows.filter(r=>r.is_test).length} mẫu`],
    ["Cải thiện", befAll?`+${Math.round((nowAll-befAll)/befAll*100)}%`:"–", "so với trước 2019", `từ ${befAll.toFixed(2)} → ${nowAll.toFixed(2)}`],
    [hasV2 ? "D · Chuyển đổi số" : "IM5 · CBAM 2026", hasV2 ? dimMean(rows,"D","b").toFixed(2) : im5now.toFixed(2), hasV2 ? "chiều mới v2.0" : "chỉ số thấp nhất", hasV2 ? "đang đo lường" : "cần ưu tiên ứng phó"],
  ];
  $("#kpis").innerHTML = kpis.map(([t,n,s,d])=>`<div class="kpi"><div class="n">${n}</div><div class="t">${t}</div><div class="s">${s}</div><div class="delta">${d}</div></div>`).join("");

  // radar — use activeDims
  Chart.radar($("#chartRadar"), {
    labels: activeDims,
    series: [
      { name:"Trước 2019", color:"#C77A34", values: activeDims.map(d=>dimMean(rows,d,"a")) },
      { name:"Hiện nay", color:"#16883F", values: activeDims.map(d=>dimMean(rows,d,"b")) },
    ]
  });
  // grouped bar
  Chart.groupedBar($("#chartBar"), {
    labels: activeDims,
    series: [
      { name:"Trước 2019", color:"#E3B183", values: activeDims.map(d=>dimMean(rows,d,"a")) },
      { name:"Hiện nay", color:"#16883F", values: activeDims.map(d=>dimMean(rows,d,"b")) },
    ]
  });
  // line IM
  const imQ = qByDim()["IM"] || [];
  if (imQ.length) {
    Chart.lineChart($("#chartLine"), {
      labels: imQ.map(q=>q.code),
      values: imQ.map(q=>qMean(rows,q.code,"b")),
      color:"#16883F", highlight:[imQ.findIndex(q=>q.code==="IM5")].filter(i=>i>=0)
    });
  }
  // donut
  const typeCounts = {};
  rows.forEach(r=>{ const t=r.respondent_type||"Khác"; typeCounts[t]=(typeCounts[t]||0)+1; });
  const palette = { QLNN:"#0C5A29", "DN-HTX":"#8DCB3F", KHCN:"#2FA457", NhaKhoaHoc:"#4E9A6B", NongDan:"#C77A34", "Khác":"#9AA893" };
  Chart.donut($("#chartDonut"), { data: Object.entries(typeCounts).map(([k,v])=>({ name:TYPE_LABEL[k]||k, value:v, color:palette[k]||"#8A938D" })) });
  // heat table
  renderHeat(rows);
}

function heatColor(v){
  const stops = [[1,"#B23A48"],[2.5,"#D08A2E"],[3.5,"#7FB03C"],[5,"#16883F"]];
  for (let i=0;i<stops.length-1;i++){ if(v<=stops[i+1][0]){ return stops[i+1][1]; } }
  return "#16883F";
}
function renderHeat(rows){
  const types = [...new Set(rows.map(r=>r.respondent_type).filter(Boolean))];
  let html = `<table class="heat"><thead><tr><th></th>${activeDims.map(d=>`<th style="text-align:center;font-size:.72rem;color:${DIM_COLORS_V2[d]||'#137A3A'}">${d}</th>`).join("")}</tr></thead><tbody>`;
  types.forEach(t=>{
    const sub = rows.filter(r=>r.respondent_type===t);
    html += `<tr><td class="lbl">${esc(TYPE_LABEL[t]||t)}</td>` + activeDims.map(d=>{
      const v = dimMean(sub,d,"b"); return `<td style="background:${heatColor(v)}">${v?v.toFixed(2):"–"}</td>`;
    }).join("") + `</tr>`;
  });
  html += `<tr><td class="lbl" style="background:var(--forest);color:#fff">Chung</td>` + activeDims.map(d=>{
    const v=dimMean(rows,d,"b"); return `<td style="background:${heatColor(v)}">${v.toFixed(2)}</td>`;
  }).join("")+`</tr></tbody></table>`;
  $("#heatTable").innerHTML = html;
}
$("#dashFilter").addEventListener("change", renderDashboard);
$("#inclTest").addEventListener("change", renderDashboard);

// ============ RESPONSES TABLE ============
function currentRows(){
  let rows = RESPONSES.slice();
  const t=$("#fltType").value, s=$("#fltStatus").value, tt=$("#fltTest").value, q=$("#fltSearch").value.toLowerCase().trim();
  const rd=$("#fltRound")?.value;
  if(t) rows=rows.filter(r=>r.respondent_type===t);
  if(s) rows=rows.filter(r=>r.status===s);
  if(tt) rows=rows.filter(r=>String(r.is_test)===tt);
  if(rd) rows=rows.filter(r=>String(r.round||1)===rd);
  if(q) rows=rows.filter(r=>(r.district||"").toLowerCase().includes(q)||(r.organization||"").toLowerCase().includes(q));
  return rows;
}
function renderTable(){
  const rows = currentRows();
  $("#rowCount").textContent = `${rows.length} phản hồi`;
  $("#respBody").innerHTML = rows.map(r=>{
    const answered = Object.keys(r.answers||{}).length;
    const nm = overallMean([r],"b");
    const round = r.round || 1;
    const enumName = r.enumerator_id ? (ENUMERATORS.find(e=>e.id===r.enumerator_id)?.name || '—') : '—';
    return `<tr>
      <td>${fmtDate(r.created_at)}${r.is_test?' <span class="pill" style="font-size:.65rem">mẫu</span>:''}</td>
      <td>${esc(TYPE_LABEL[r.respondent_type]||r.respondent_type||'–')}</td>
      <td>${esc(r.district||'–')}</td>
      <td>${answered}/${QUESTIONS.length}</td>
      <td><b>${nm?nm.toFixed(2):'–'}</b></td>
      <td><span class="badge-status st-${r.status}">${statusLabel(r.status)}</span></td>
      <td style="font-size:.8rem">${round === 2 ? 'v2.0' : 'v1.0'}</td>
      <td style="font-size:.8rem">${esc(enumName)}</td>
      <td style="white-space:nowrap">
        <button class="icon-btn" data-edit="${r.id}">✎</button>
        <button class="icon-btn" data-del="${r.id}">🗑</button>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:30px">Không có dữ liệu.</td></tr>`;
  $$("[data-edit]").forEach(b=>b.addEventListener("click",()=>editResponse(b.dataset.edit)));
  $$("[data-del]").forEach(b=>b.addEventListener("click",()=>delResponse(b.dataset.del)));
}
const statusLabel=(s)=>({raw:"Thô",cleaned:"Đã sạch",flagged:"Gắn cờ",excluded:"Loại trừ"}[s]||s);
["fltType","fltStatus","fltTest","fltSearch"].forEach(id=>{ const el=$("#"+id); if(el) el.addEventListener("input",renderTable); });
const fltRoundEl = $("#fltRound"); if (fltRoundEl) fltRoundEl.addEventListener("change", renderTable);

function openModal(html){ $("#modal").innerHTML=html; $("#modalBg").classList.add("show"); }
function closeModal(){ $("#modalBg").classList.remove("show"); }
$("#modalBg").addEventListener("click",e=>{ if(e.target.id==="modalBg") closeModal(); });

function editResponse(id){
  const r = RESPONSES.find(x=>x.id===id); if(!r) return;
  const qrows = QUESTIONS.map(q=>{
    const a=r.answers?.[q.code]?.a??"", b=r.answers?.[q.code]?.b??"";
    return `<tr><td style="font-weight:600">${q.code}</td><td style="font-size:.82rem">${esc(q.text)}</td>
      <td><input type="number" min="1" max="5" value="${a}" data-a="${q.code}" style="width:60px;padding:6px"></td>
      <td><input type="number" min="1" max="5" value="${b}" data-b="${q.code}" style="width:60px;padding:6px"></td></tr>`;
  }).join("");
  openModal(`
    <div class="modal-head"><h3>Chỉnh sửa phản hồi</h3><button class="icon-btn" id="mClose">✕</button></div>
    <div class="modal-body">
      <div class="field-row">
        <div class="field"><label>Nhóm đối tượng</label>
          <select id="mType">${Object.entries(TYPE_LABEL).map(([k,v])=>`<option value="${k}" ${r.respondent_type===k?'selected':''}>${v}</option>`).join("")}</select></div>
        <div class="field"><label>Trạng thái</label>
          <select id="mStatus">${["raw","cleaned","flagged","excluded"].map(s=>`<option value="${s}" ${r.status===s?'selected':''}>${statusLabel(s)}</option>`).join("")}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Địa bàn</label><input type="text" id="mDistrict" value="${esc(r.district||'')}"></div>
        <div class="field"><label>Số năm KN</label><input type="number" id="mYears" value="${r.years_exp??''}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Đợt khảo sát</label>
          <select id="mRound"><option value="1" ${(r.round||1)===1?'selected':''}>Đợt 1 (v1.0)</option><option value="2" ${r.round===2?'selected':''}>Đợt 2 (v2.0)</option></select></div>
        <div class="field"><label>Điều tra viên</label>
          <select id="mEnum"><option value="">— Không —</option>${ENUMERATORS.map(e=>`<option value="${e.id}" ${r.enumerator_id===e.id?'selected':''}>${esc(e.name)}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label>Ghi chú admin</label><input type="text" id="mNote" value="${esc(r.admin_note||'')}"></div>
      <details style="margin:12px 0"><summary style="cursor:pointer;font-weight:600;color:var(--forest)">Chỉnh điểm từng câu (${QUESTIONS.length})</summary>
        <div class="table-scroll" style="max-height:40vh;margin-top:10px"><table><thead><tr><th>Mã</th><th>Nội dung</th><th>Trước</th><th>Nay</th></tr></thead><tbody>${qrows}</tbody></table></div>
      </details>
      ${Object.keys(r.open_answers||{}).length?`<div class="field"><label>Câu trả lời mở</label>${Object.entries(r.open_answers).map(([k,v])=>`<p style="font-size:.85rem;margin:4px 0"><b>${k}:</b> ${esc(v)}</p>`).join("")}</div>`:''}
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-ghost" id="mCancel">Hủy</button>
        <button class="btn btn-primary" id="mSave">Lưu thay đổi</button>
      </div>
    </div>`);
  $("#mClose").onclick=closeModal; $("#mCancel").onclick=closeModal;
  $("#mSave").onclick=async()=>{
    const answers={...(r.answers||{})};
    $$("[data-a]").forEach(inp=>{ const c=inp.dataset.a; answers[c]=answers[c]||{}; answers[c].a=inp.value?+inp.value:null; });
    $$("[data-b]").forEach(inp=>{ const c=inp.dataset.b; answers[c]=answers[c]||{}; answers[c].b=inp.value?+inp.value:null; });
    const upd={ respondent_type:$("#mType").value, status:$("#mStatus").value, district:$("#mDistrict").value||null,
      years_exp:$("#mYears").value?+$("#mYears").value:null, admin_note:$("#mNote").value||null,
      round: +$("#mRound").value, enumerator_id: $("#mEnum").value ? +$("#mEnum").value : null, answers };
    const { error } = await sb.from("responses").update(upd).eq("id",id);
    if(error){ toast("Lỗi: "+error.message,true); return; }
    Object.assign(r,upd); closeModal(); renderTable(); renderDashboard(); toast("Đã lưu thay đổi");
  };
}
async function delResponse(id){
  if(!confirm("Xóa phản hồi này? Hành động không thể hoàn tác.")) return;
  const { error } = await sb.from("responses").delete().eq("id",id);
  if(error){ toast("Lỗi: "+error.message,true); return; }
  RESPONSES = RESPONSES.filter(r=>r.id!==id); renderTable(); renderDashboard(); toast("Đã xóa");
}

// ============================================================
// ENUMERATOR MANAGEMENT (NEW v2.0)
// ============================================================
async function renderEnumerators() {
  // Reload enumerators in case of changes
  const { data: enums } = await sb.from("enumerators").select("*").order("created_at", { ascending: false }).catch(() => ({ data: [] }));
  ENUMERATORS = enums || [];

  const el = $("#enumBody");
  if (!el) return;

  // Compute per-enumerator stats
  const stats = {};
  RESPONSES.forEach(r => {
    if (r.enumerator_id) {
      if (!stats[r.enumerator_id]) stats[r.enumerator_id] = { count: 0, cleaned: 0, flagged: 0, excluded: 0 };
      stats[r.enumerator_id].count++;
      if (r.status === 'cleaned') stats[r.enumerator_id].cleaned++;
      if (r.status === 'flagged') stats[r.enumerator_id].flagged++;
      if (r.status === 'excluded') stats[r.enumerator_id].excluded++;
    }
  });

  if (!ENUMERATORS.length) {
    el.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:30px">Chưa có điều tra viên. Bấm "+ Thêm điều tra viên" để bắt đầu.</td></tr>`;
  } else {
    el.innerHTML = ENUMERATORS.map(e => {
      const s = stats[e.id] || { count: 0, cleaned: 0, flagged: 0, excluded: 0 };
      const qualityRate = s.count > 0 ? Math.round((s.cleaned / s.count) * 100) : 0;
      const statusBadge = e.is_active
        ? '<span class="badge-status st-cleaned">Đang hoạt động</span>'
        : '<span class="badge-status st-excluded">Tạm dừng</span>';
      return `<tr>
        <td><b>${esc(e.name)}</b></td>
        <td>${esc(e.phone || '–')}</td>
        <td>${esc(e.district || '–')}</td>
        <td style="text-align:center"><b>${s.count}</b></td>
        <td style="text-align:center">${s.flagged}</td>
        <td style="text-align:center"><b>${qualityRate}%</b></td>
        <td>${statusBadge}</td>
        <td style="white-space:nowrap">
          <button class="icon-btn" data-enum-edit="${e.id}">✎</button>
          <button class="icon-btn" data-enum-del="${e.id}">🗑</button>
        </td>
      </tr>`;
    }).join("");
  }

  $$("[data-enum-edit]").forEach(b => b.addEventListener("click", () => enumForm(ENUMERATORS.find(x => x.id == b.dataset.enumEdit))));
  $$("[data-enum-del]").forEach(b => b.addEventListener("click", () => delEnumerator(b.dataset.enumDel)));
}

$("#addEnum")?.addEventListener("click", () => enumForm(null));

function enumForm(e) {
  e = e || {};
  openModal(`<div class="modal-head"><h3>${e.id?'Sửa':'Thêm'} điều tra viên</h3><button class="icon-btn" id="mClose">✕</button></div>
    <div class="modal-body">
      <div class="field"><label>Họ và tên <span style="color:var(--danger)">*</span></label><input type="text" id="enumName" value="${esc(e.name||'')}" placeholder="VD: Nguyễn Văn A"></div>
      <div class="field-row">
        <div class="field"><label>Số điện thoại</label><input type="text" id="enumPhone" value="${esc(e.phone||'')}" placeholder="VD: 0912345678"></div>
        <div class="field"><label>Email</label><input type="email" id="enumEmail" value="${esc(e.email||'')}" placeholder="VD: nvana@tlu.edu.vn"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Địa bàn phụ trách</label>
          <select id="enumDistrict">
            <option value="">— Tất cả —</option>
            ${["TP Sơn La","Mộc Châu","Mai Sơn","Yên Châu","Sông Mã","Thuận Châu","Phù Yên","Bắc Yên","Mường La","Khác"].map(d=>`<option value="${d}" ${e.district===d?'selected':''}>${d}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Đợt khảo sát</label>
          <select id="enumRound"><option value="2" ${(e.round||2)===2?'selected':''}>Đợt 2 (v2.0)</option><option value="1" ${e.round===1?'selected':''}>Đợt 1 (v1.0)</option></select>
        </div>
      </div>
      <div class="field"><label>Trạng thái</label>
        <select id="enumActive"><option value="true" ${e.is_active!==false?'selected':''}>Đang hoạt động</option><option value="false" ${e.is_active===false?'selected':''}>Tạm dừng</option></select>
      </div>
      <div class="field"><label>Ghi chú</label><textarea id="enumNote" rows="2">${esc(e.note||'')}</textarea></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-ghost" id="mCancel">Hủy</button>
        <button class="btn btn-primary" id="mSave">Lưu</button>
      </div>
    </div>`);
  $("#mClose").onclick=closeModal; $("#mCancel").onclick=closeModal;
  $("#mSave").onclick=async()=>{
    const row={
      name: $("#enumName").value.trim(),
      phone: $("#enumPhone").value || null,
      email: $("#enumEmail").value || null,
      district: $("#enumDistrict").value || null,
      round: +$("#enumRound").value,
      is_active: $("#enumActive").value === "true",
      note: $("#enumNote").value || null
    };
    if(!row.name){ toast("Nhập họ tên điều tra viên",true); return; }
    const q = e.id ? sb.from("enumerators").update(row).eq("id",e.id) : sb.from("enumerators").insert(row);
    const {error}=await q;
    if(error){ toast("Lỗi: "+error.message,true); return; }
    closeModal(); renderEnumerators(); toast("Đã lưu điều tra viên");
  };
}

async function delEnumerator(id) {
  if(!confirm("Xóa điều tra viên này? Các phản hồi đã thu thập vẫn được giữ.")) return;
  const { error } = await sb.from("enumerators").delete().eq("id",id);
  if(error){ toast("Lỗi: "+error.message,true); return; }
  renderEnumerators(); toast("Đã xóa điều tra viên");
}

// ============================================================
// DATA QUALITY DASHBOARD (NEW v2.0)
// ============================================================
function renderDataQuality() {
  const rows = RESPONSES.filter(r => r.status !== "excluded" && !r.is_test);
  const el = $("#qualityRoot");
  if (!el) return;

  // Compute quality metrics per response
  const metrics = rows.map(r => {
    const answers = r.answers || {};
    const answeredCodes = Object.keys(answers).filter(c => answers[c]?.a != null || answers[c]?.b != null);
    const completionRate = QUESTIONS.length > 0 ? (answeredCodes.length / QUESTIONS.length) * 100 : 0;

    // Check for straight-lining (all same values in a dimension)
    let straightLineCount = 0;
    activeDims.forEach(d => {
      const qs = qByDim()[d] || [];
      const bVals = qs.map(q => answers[q.code]?.b).filter(v => v != null);
      if (bVals.length >= 3 && new Set(bVals).size === 1) straightLineCount++;
    });

    // Check for extreme responses (all 1s or all 5s)
    const allBVals = Object.values(answers).map(a => a?.b).filter(v => v != null);
    const allSame = allBVals.length >= 10 && new Set(allBVals).size === 1;

    // Response time (if available)
    const respTime = r.response_time_sec || r.duration_sec || null;

    // Quality score
    let qScore = 100;
    if (completionRate < 80) qScore -= 20;
    if (completionRate < 50) qScore -= 20;
    if (straightLineCount > 2) qScore -= 15;
    if (allSame) qScore -= 25;
    if (r.status === "flagged") qScore -= 20;

    return {
      id: r.id, type: r.respondent_type, district: r.district,
      completion: completionRate, straightLine: straightLineCount,
      allSame, respTime, qScore, status: r.status,
      answered: answeredCodes.length, total: QUESTIONS.length,
      round: r.round || 1
    };
  });

  // Summary KPIs
  const totalN = metrics.length;
  const avgCompletion = mean(metrics.map(m => m.completion));
  const flaggedCount = metrics.filter(m => m.qScore < 60).length;
  const straightLineN = metrics.filter(m => m.straightLine > 0).length;
  const allSameN = metrics.filter(m => m.allSame).length;
  const avgQuality = mean(metrics.map(m => m.qScore));

  // Quality distribution
  const highQ = metrics.filter(m => m.qScore >= 80).length;
  const medQ = metrics.filter(m => m.qScore >= 60 && m.qScore < 80).length;
  const lowQ = metrics.filter(m => m.qScore < 60).length;

  el.innerHTML = `
    <div class="kpi-grid" id="qualityKpis">
      <div class="kpi"><div class="n">${totalN}</div><div class="t">Tổng phiếu</div><div class="s">đang đánh giá</div></div>
      <div class="kpi"><div class="n">${avgCompletion.toFixed(0)}%</div><div class="t">Hoàn thành TB</div><div class="s">tỷ lệ điền đủ</div></div>
      <div class="kpi"><div class="n" style="color:${avgQuality >= 75 ? 'var(--forest)' : 'var(--danger)'}">${avgQuality.toFixed(0)}</div><div class="t">Điểm chất lượng TB</div><div class="s">trên 100</div></div>
      <div class="kpi"><div class="n" style="color:var(--danger)">${flaggedCount}</div><div class="t">Phiếu cần kiểm tra</div><div class="s">điểm &lt; 60</div></div>
    </div>

    <div class="panel-grid" style="margin-top:20px">
      <div class="panel">
        <h3>Phân bố chất lượng</h3>
        <p class="ph-sub">Phân loại theo điểm chất lượng</p>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:16px">
          <div style="text-align:center">
            <div style="font-size:2rem;font-weight:700;color:var(--forest)">${highQ}</div>
            <div style="font-size:.85rem;color:var(--ink-2)">Chất lượng cao (≥80)</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:2rem;font-weight:700;color:#D08A2E">${medQ}</div>
            <div style="font-size:.85rem;color:var(--ink-2)">Trung bình (60-79)</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:2rem;font-weight:700;color:var(--danger)">${lowQ}</div>
            <div style="font-size:.85rem;color:var(--ink-2)">Thấp (&lt;60)</div>
          </div>
        </div>
      </div>
      <div class="panel">
        <h3>Cảnh báo chất lượng</h3>
        <p class="ph-sub">Các vấn đề phát hiện được</p>
        <table style="margin-top:12px">
          <tr><td>Straight-lining (cùng điểm trong 1 chiều)</td><td style="text-align:right;font-weight:700">${straightLineN} phiếu</td></tr>
          <tr><td>Extreme responding (tất cả cùng giá trị)</td><td style="text-align:right;font-weight:700">${allSameN} phiếu</td></tr>
          <tr><td>Hoàn thành &lt; 50%</td><td style="text-align:right;font-weight:700">${metrics.filter(m=>m.completion<50).length} phiếu</td></tr>
          <tr><td>Đã gắn cờ (flagged)</td><td style="text-align:right;font-weight:700">${metrics.filter(m=>m.status==="flagged").length} phiếu</td></tr>
        </table>
      </div>
    </div>

    <div class="panel" style="margin-top:20px">
      <h3>Chi tiết phiếu cần kiểm tra</h3>
      <p class="ph-sub">Sắp xếp theo điểm chất lượng tăng dần</p>
      <div class="table-scroll" style="max-height:50vh;margin-top:12px">
        <table>
          <thead><tr>
            <th>ID</th><th>Nhóm</th><th>Địa bàn</th><th>Đợt</th><th>Hoàn thành</th><th>Straight-line</th><th>Điểm CL</th><th>Trạng thái</th><th></th>
          </tr></thead>
          <tbody>
            ${metrics.sort((a,b)=>a.qScore-b.qScore).slice(0,30).map(m => `
              <tr style="${m.qScore < 60 ? 'background:rgba(178,58,72,0.05)' : ''}">
                <td>${m.id}</td>
                <td>${esc(TYPE_LABEL[m.type]||m.type||'–')}</td>
                <td>${esc(m.district||'–')}</td>
                <td>${m.round === 2 ? 'v2.0' : 'v1.0'}</td>
                <td>${m.answered}/${m.total} (${m.completion.toFixed(0)}%)</td>
                <td style="color:${m.straightLine > 2 ? 'var(--danger)' : 'var(--ink-2)'}">${m.straightLine}</td>
                <td><b style="color:${m.qScore >= 80 ? 'var(--forest)' : m.qScore >= 60 ? '#D08A2E' : 'var(--danger)'}">${m.qScore.toFixed(0)}</b></td>
                <td><span class="badge-status st-${m.status}">${statusLabel(m.status)}</span></td>
                <td><button class="icon-btn" data-qedit="${m.id}">✎</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $$("[data-qedit]").forEach(b => b.addEventListener("click", () => editResponse(b.dataset.qedit)));
}

// ============================================================
// MULTI-ROUND COMPARISON (NEW v2.0)
// ============================================================
function renderMultiRound() {
  const el = $("#roundsRoot");
  if (!el) return;

  const r1Rows = RESPONSES.filter(r => (!r.round || r.round === 1) && r.status !== "excluded" && !r.is_test);
  const r2Rows = RESPONSES.filter(r => r.round === 2 && r.status !== "excluded" && !r.is_test);

  // Detect dims per round
  const r1Dims = DIM_ORDER.filter(d => {
    const qs = QUESTIONS.filter(q => q.dimension === d);
    return qs.length > 0 && r1Rows.some(r => qs.some(q => r.answers?.[q.code]?.b != null));
  });
  const r2Dims = DIM_ORDER_V2.filter(d => {
    const qs = QUESTIONS.filter(q => q.dimension === d);
    return qs.length > 0 && r2Rows.some(r => qs.some(q => r.answers?.[q.code]?.b != null));
  });

  const commonDims = r1Dims.filter(d => r2Dims.includes(d));
  const newDims = r2Dims.filter(d => !r1Dims.includes(d));

  // Compute means
  const r1Now = overallMean(r1Rows, "b");
  const r2Now = overallMean(r2Rows, "b");
  const r1Bef = overallMean(r1Rows, "a");
  const r2Bef = overallMean(r2Rows, "a");

  // Per-dimension comparison
  const dimComparison = commonDims.map(d => ({
    dim: d,
    name: DIM_NAME_V2[d] || d,
    r1: dimMean(r1Rows, d, "b"),
    r2: dimMean(r2Rows, d, "b"),
    delta: dimMean(r2Rows, d, "b") - dimMean(r1Rows, d, "b")
  }));

  // Per-group comparison
  const allTypes = [...new Set([...r1Rows, ...r2Rows].map(r => r.respondent_type).filter(Boolean))];
  const groupComparison = allTypes.map(t => ({
    group: t,
    label: TYPE_LABEL[t] || t,
    r1n: r1Rows.filter(r => r.respondent_type === t).length,
    r2n: r2Rows.filter(r => r.respondent_type === t).length,
    r1Mean: overallMean(r1Rows.filter(r => r.respondent_type === t), "b"),
    r2Mean: overallMean(r2Rows.filter(r => r.respondent_type === t), "b"),
  }));

  el.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi"><div class="n">${r1Rows.length}</div><div class="t">Đợt 1 (v1.0)</div><div class="s">${r1Dims.length} chiều · ATiGB ${r1Now.toFixed(2)}</div></div>
      <div class="kpi"><div class="n">${r2Rows.length}</div><div class="t">Đợt 2 (v2.0)</div><div class="s">${r2Dims.length} chiều · ATiGB ${r2Now.toFixed(2)}</div></div>
      <div class="kpi"><div class="n" style="color:${r2Now > r1Now ? 'var(--forest)' : 'var(--danger)'}">${r2Now > r1Now ? '+' : ''}${(r2Now - r1Now).toFixed(2)}</div><div class="t">Chênh lệch</div><div class="s">đợt 2 vs đợt 1</div></div>
      <div class="kpi"><div class="n">${newDims.length}</div><div class="t">Chiều mới</div><div class="s">${newDims.map(d=>d).join(", ") || "không"}</div></div>
    </div>

    <div class="panel-grid" style="margin-top:20px">
      <div class="panel">
        <h3>So sánh theo chiều đo (đợt 1 vs đợt 2)</h3>
        <p class="ph-sub">Chỉ so sánh các chiều chung giữa hai đợt</p>
        <div id="roundChartBar" style="margin-top:16px"></div>
      </div>
      <div class="panel">
        <h3>Radar so sánh</h3>
        <p class="ph-sub">Đợt 1 vs đợt 2 (hiện nay)</p>
        <div id="roundChartRadar" style="margin-top:16px"></div>
      </div>
    </div>

    <div class="panel" style="margin-top:20px">
      <h3>Bảng so sánh chi tiết theo chiều</h3>
      <table style="margin-top:12px">
        <thead><tr><th>Chiều đo</th><th style="text-align:right">Đợt 1 (n=${r1Rows.length})</th><th style="text-align:right">Đợt 2 (n=${r2Rows.length})</th><th style="text-align:right">Chênh lệch</th><th style="text-align:right">Thay đổi %</th></tr></thead>
        <tbody>
          ${dimComparison.map(c => `
            <tr>
              <td><b style="color:${DIM_COLORS_V2[c.dim]||'var(--forest)'}">${c.dim}</b> — ${esc(c.name)}</td>
              <td style="text-align:right">${c.r1 ? c.r1.toFixed(2) : '–'}</td>
              <td style="text-align:right">${c.r2 ? c.r2.toFixed(2) : '–'}</td>
              <td style="text-align:right;color:${c.delta > 0 ? 'var(--forest)' : c.delta < 0 ? 'var(--danger)' : 'var(--ink-2)'}">${c.delta > 0 ? '+' : ''}${c.delta ? c.delta.toFixed(2) : '–'}</td>
              <td style="text-align:right">${c.r1 > 0 ? `${c.delta > 0 ? '+' : ''}${(c.delta/c.r1*100).toFixed(0)}%` : '–'}</td>
            </tr>
          `).join("")}
          ${newDims.map(d => `
            <tr style="background:rgba(2,121,238,0.04)">
              <td><b style="color:${DIM_COLORS_V2[d]}">${d}</b> — ${esc(DIM_NAME_V2[d])} <span class="badge-new">MỚI</span></td>
              <td style="text-align:right;color:var(--muted)">—</td>
              <td style="text-align:right">${dimMean(r2Rows, d, "b").toFixed(2)}</td>
              <td style="text-align:right;color:var(--muted)">—</td>
              <td style="text-align:right;color:var(--muted)">—</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div class="panel" style="margin-top:20px">
      <h3>So sánh theo nhóm đối tượng</h3>
      <table style="margin-top:12px">
        <thead><tr><th>Nhóm</th><th style="text-align:right">Đợt 1 (n)</th><th style="text-align:right">Đợt 1 (điểm)</th><th style="text-align:right">Đợt 2 (n)</th><th style="text-align:right">Đợt 2 (điểm)</th><th style="text-align:right">Chênh lệch</th></tr></thead>
        <tbody>
          ${groupComparison.map(g => `
            <tr>
              <td>${esc(g.label)}</td>
              <td style="text-align:right">${g.r1n}</td>
              <td style="text-align:right">${g.r1Mean ? g.r1Mean.toFixed(2) : '–'}</td>
              <td style="text-align:right">${g.r2n}</td>
              <td style="text-align:right">${g.r2Mean ? g.r2Mean.toFixed(2) : '–'}</td>
              <td style="text-align:right;color:${(g.r2Mean - g.r1Mean) > 0 ? 'var(--forest)' : 'var(--ink-2)'}">${g.r1Mean && g.r2Mean ? ((g.r2Mean - g.r1Mean) > 0 ? '+' : '') + (g.r2Mean - g.r1Mean).toFixed(2) : '–'}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  // Render charts
  setTimeout(() => {
    const barEl = $("#roundChartBar");
    const radarEl = $("#roundChartRadar");
    if (barEl) {
      Chart.groupedBar(barEl, {
        labels: commonDims,
        series: [
          { name: `Đợt 1 (n=${r1Rows.length})`, color: "#E3B183", values: commonDims.map(d => dimMean(r1Rows, d, "b")) },
          { name: `Đợt 2 (n=${r2Rows.length})`, color: "#16883F", values: commonDims.map(d => dimMean(r2Rows, d, "b")) },
        ]
      });
    }
    if (radarEl) {
      Chart.radar(radarEl, {
        labels: commonDims,
        series: [
          { name: `Đợt 1`, color: "#C77A34", values: commonDims.map(d => dimMean(r1Rows, d, "b")) },
          { name: `Đợt 2`, color: "#16883F", values: commonDims.map(d => dimMean(r2Rows, d, "b")) },
        ]
      });
    }
  }, 50);
}

// ============ CONTENT ADMIN ============
const R2_BASE = (window.ATIGB_CONFIG.R2_PUBLIC_BASE||"").replace(/\/$/,"");
const UPLOAD_URL = window.ATIGB_CONFIG.WORKER_UPLOAD_URL||"";
function mediaUrl(u){ if(!u) return ""; return /^https?:\/\//.test(u) ? u : (R2_BASE ? R2_BASE+"/"+u.replace(/^\//,"") : u); }

async function uploadImage(file, folder){
  if(!UPLOAD_URL) throw new Error("Chưa cấu hình WORKER_UPLOAD_URL");
  const { data } = await sb.auth.getSession();
  const token = data?.session?.access_token;
  if(!token) throw new Error("Chưa đăng nhập");
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder||"su-kien");
  const res = await fetch(UPLOAD_URL, { method:"POST", headers:{ Authorization:"Bearer "+token }, body:fd });
  const out = await res.json().catch(()=>({error:"phản hồi không hợp lệ"}));
  if(!res.ok || !out.ok) throw new Error(out.error||("HTTP "+res.status));
  return out;
}
function wireUploader(fileInputId, targetInputId, folder, statusId){
  const fi=$("#"+fileInputId); if(!fi) return;
  fi.addEventListener("change", async ()=>{
    const f=fi.files[0]; if(!f) return;
    const st=$("#"+statusId);
    if(!UPLOAD_URL){ if(st){st.textContent="⚠ Chưa bật upload — hãy dán URL ảnh thủ công."; st.style.color="var(--danger)";} return; }
    if(st){ st.textContent="⏳ Đang tải ảnh lên R2..."; st.style.color="var(--ink-2)"; }
    try{
      const r=await uploadImage(f, folder);
      $("#"+targetInputId).value = r.key;
      if(st){ st.innerHTML=`✅ Đã tải: <code>${esc(r.key)}</code>`; st.style.color="var(--ok)"; }
      toast("Tải ảnh thành công");
    }catch(e){ if(st){ st.textContent="✕ "+e.message; st.style.color="var(--danger)"; } toast("Lỗi upload: "+e.message,true); }
  });
}

async function renderContentAdmin(){
  const [{data:news},{data:pubs},{data:events}] = await Promise.all([
    sb.from("news").select("*").order("sort_order"),
    sb.from("publications").select("*").order("sort_order"),
    sb.from("events").select("*").order("sort_order"),
  ]);
  $("#eventAdmin").innerHTML = (events||[]).map(e=>`
    <div style="border:1px solid var(--line);border-radius:12px;overflow:hidden">
      <div style="aspect-ratio:4/3;background:linear-gradient(135deg,var(--forest-3),var(--forest));display:grid;place-items:center;color:var(--gold-2);font-size:1.6rem">
        ${e.image_url?`<img src="${esc(mediaUrl(e.image_url))}" style="width:100%;height:100%;object-fit:cover" alt="" onerror="this.style.display='none';this.parentNode.textContent='⚠️ ảnh lỗi'">`:'🖼️'}
      </div>
      <div style="padding:10px">
        <b style="font-size:.86rem;display:block;line-height:1.3">${esc(e.title)}</b>
        <span style="color:var(--muted);font-size:.75rem">${e.event_date?fmtDate(e.event_date):''}${e.location?' · '+esc(e.location):''}</span>
        <div style="margin-top:8px;white-space:nowrap"><button class="icon-btn" data-ev-edit="${e.id}">✎</button> <button class="icon-btn" data-ev-del="${e.id}">🗑</button></div>
      </div>
    </div>`).join("") || `<p style="color:var(--muted)">Chưa có ảnh sự kiện. Bấm "+ Thêm sự kiện".</p>`;
  $$("[data-ev-edit]").forEach(b=>b.onclick=()=>eventForm((events||[]).find(x=>x.id==b.dataset.evEdit)));
  $$("[data-ev-del]").forEach(b=>b.onclick=()=>delRow("events",b.dataset.evDel));
  $("#newsAdmin").innerHTML = (news||[]).map(n=>`
    <div style="padding:12px;border:1px solid var(--line);border-radius:12px;margin-bottom:8px;display:flex;justify-content:space-between;gap:10px">
      <div><b style="font-size:.92rem">${esc(n.title)}</b><br><span style="color:var(--muted);font-size:.8rem">${esc(n.source||'')} ${n.published_at?'· '+fmtDate(n.published_at):''}</span></div>
      <div style="white-space:nowrap"><button class="icon-btn" data-news-edit="${n.id}">✎</button> <button class="icon-btn" data-news-del="${n.id}">🗑</button></div>
    </div>`).join("") || `<p style="color:var(--muted)">Chưa có tin.</p>`;
  $("#pubAdmin").innerHTML = (pubs||[]).map(p=>`
    <div style="padding:12px;border:1px solid var(--line);border-radius:12px;margin-bottom:8px;display:flex;justify-content:space-between;gap:10px">
      <div><b style="font-size:.92rem">${esc(p.code)} · ${esc(p.title.slice(0,60))}${p.title.length>60?'…':''}</b><br><span style="color:var(--muted);font-size:.8rem">${esc(p.status||'')}</span></div>
      <div style="white-space:nowrap"><button class="icon-btn" data-pub-edit="${p.id}">✎</button> <button class="icon-btn" data-pub-del="${p.id}">🗑</button></div>
    </div>`).join("") || `<p style="color:var(--muted)">Chưa có bài báo.</p>`;
  $$("[data-news-edit]").forEach(b=>b.onclick=()=>newsForm((news||[]).find(x=>x.id==b.dataset.newsEdit)));
  $$("[data-news-del]").forEach(b=>b.onclick=()=>delRow("news",b.dataset.newsDel));
  $$("[data-pub-edit]").forEach(b=>b.onclick=()=>pubForm((pubs||[]).find(x=>x.id==b.dataset.pubEdit)));
  $$("[data-pub-del]").forEach(b=>b.onclick=()=>delRow("publications",b.dataset.pubDel));
}
$("#addNews").onclick=()=>newsForm(null);
$("#addPub").onclick=()=>pubForm(null);
$("#addEvent").onclick=()=>eventForm(null);
function eventForm(e){
  e=e||{}; openModal(`<div class="modal-head"><h3>${e.id?'Sửa':'Thêm'} ảnh sự kiện</h3><button class="icon-btn" id="mClose">✕</button></div>
    <div class="modal-body">
      <div class="field"><label>Tiêu đề / mô tả ảnh</label><input type="text" id="eTitle" value="${esc(e.title||'')}" placeholder="VD: Khảo sát thực địa tại Mộc Châu"></div>
      <div class="field-row">
        <div class="field"><label>Ngày (YYYY-MM-DD)</label><input type="text" id="eDate" value="${esc(e.event_date||'')}"></div>
        <div class="field"><label>Địa điểm</label><input type="text" id="eLoc" value="${esc(e.location||'')}"></div>
      </div>
      <div class="field">
        <label>Tải ảnh lên (R2)</label>
        <input type="file" id="eFile" accept="image/*">
        <div id="eUpStatus" style="font-size:.8rem;margin-top:6px;color:var(--muted)"></div>
      </div>
      <div class="field"><label>Hoặc dán URL / tên file ảnh</label><input type="text" id="eImg" value="${esc(e.image_url||'')}" placeholder="su-kien/khao-sat.jpg"></div>
      <div class="field"><label>Mô tả (tuỳ chọn)</label><textarea id="eDesc" rows="2">${esc(e.description||'')}</textarea></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn btn-ghost" id="mCancel">Hủy</button><button class="btn btn-primary" id="mSave">Lưu</button></div>
    </div>`);
  $("#mClose").onclick=closeModal;$("#mCancel").onclick=closeModal;
  wireUploader("eFile","eImg","su-kien","eUpStatus");
  $("#mSave").onclick=async()=>{
    const row={ title:$("#eTitle").value, event_date:$("#eDate").value||null, location:$("#eLoc").value||null,
      image_url:$("#eImg").value||null, description:$("#eDesc").value||null };
    if(!row.title){ toast("Nhập tiêu đề ảnh",true); return; }
    const q = e.id ? sb.from("events").update(row).eq("id",e.id) : sb.from("events").insert(row);
    const {error}=await q; if(error){toast("Lỗi: "+error.message,true);return;}
    closeModal(); renderContentAdmin(); toast("Đã lưu sự kiện");
  };
}
function newsForm(n){
  n=n||{}; openModal(`<div class="modal-head"><h3>${n.id?'Sửa':'Thêm'} tin tức</h3><button class="icon-btn" id="mClose">✕</button></div>
    <div class="modal-body">
      <div class="field"><label>Tiêu đề</label><input type="text" id="nTitle" value="${esc(n.title||'')}"></div>
      <div class="field"><label>Tóm tắt</label><textarea id="nSum" rows="3">${esc(n.summary||'')}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Nguồn</label><input type="text" id="nSrc" value="${esc(n.source||'')}"></div>
        <div class="field"><label>Ngày (YYYY-MM-DD)</label><input type="text" id="nDate" value="${esc(n.published_at||'')}"></div>
      </div>
      <div class="field"><label>Link nguồn</label><input type="text" id="nUrl" value="${esc(n.source_url||'')}"></div>
      <div class="field"><label>Tải ảnh minh hoạ (R2)</label><input type="file" id="nFile" accept="image/*"><div id="nUpStatus" style="font-size:.8rem;margin-top:6px;color:var(--muted)"></div></div>
      <div class="field"><label>Hoặc dán URL / tên file ảnh</label><input type="text" id="nImg" value="${esc(n.image_url||'')}" placeholder="tin-tuc/anh.jpg"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn btn-ghost" id="mCancel">Hủy</button><button class="btn btn-primary" id="mSave">Lưu</button></div>
    </div>`);
  $("#mClose").onclick=closeModal;$("#mCancel").onclick=closeModal;
  wireUploader("nFile","nImg","tin-tuc","nUpStatus");
  $("#mSave").onclick=async()=>{
    const row={ title:$("#nTitle").value, summary:$("#nSum").value, source:$("#nSrc").value||null,
      published_at:$("#nDate").value||null, source_url:$("#nUrl").value||null, image_url:$("#nImg").value||null };
    const q = n.id ? sb.from("news").update(row).eq("id",n.id) : sb.from("news").insert(row);
    const {error}=await q; if(error){toast("Lỗi: "+error.message,true);return;}
    closeModal(); renderContentAdmin(); toast("Đã lưu tin tức");
  };
}
function pubForm(p){
  p=p||{}; openModal(`<div class="modal-head"><h3>${p.id?'Sửa':'Thêm'} bài báo</h3><button class="icon-btn" id="mClose">✕</button></div>
    <div class="modal-body">
      <div class="field-row"><div class="field"><label>Mã (BB1..)</label><input type="text" id="pCode" value="${esc(p.code||'')}"></div>
      <div class="field"><label>Trạng thái</label><input type="text" id="pStatus" value="${esc(p.status||'')}"></div></div>
      <div class="field"><label>Tiêu đề</label><textarea id="pTitle" rows="2">${esc(p.title||'')}</textarea></div>
      <div class="field-row"><div class="field"><label>Tạp chí</label><input type="text" id="pJournal" value="${esc(p.journal||'')}"></div>
      <div class="field"><label>Loại</label><input type="text" id="pType" value="${esc(p.paper_type||'')}"></div></div>
      <div class="field"><label>DOI / Link</label><input type="text" id="pDoi" value="${esc(p.doi_url||'')}"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn btn-ghost" id="mCancel">Hủy</button><button class="btn btn-primary" id="mSave">Lưu</button></div>
    </div>`);
  $("#mClose").onclick=closeModal;$("#mCancel").onclick=closeModal;
  $("#mSave").onclick=async()=>{
    const row={ code:$("#pCode").value||null, status:$("#pStatus").value||null, title:$("#pTitle").value,
      journal:$("#pJournal").value||null, paper_type:$("#pType").value||null, doi_url:$("#pDoi").value||null };
    const q = p.id ? sb.from("publications").update(row).eq("id",p.id) : sb.from("publications").insert(row);
    const {error}=await q; if(error){toast("Lỗi: "+error.message,true);return;}
    closeModal(); renderContentAdmin(); toast("Đã lưu bài báo");
  };
}
async function delRow(table,id){
  if(!confirm("Xóa mục này?")) return;
  const {error}=await sb.from(table).delete().eq("id",id);
  if(error){toast("Lỗi: "+error.message,true);return;}
  renderContentAdmin(); toast("Đã xóa");
}

// ============ EXPORT ============
function download(name, content, type){
  const blob=new Blob(["﻿"+content],{type}); const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
}
function csvCell(v){ v=v==null?"":String(v); return /[",\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v; }
$("#expCsv").onclick=()=>{
  const cols=["id","created_at","respondent_type","district","years_exp","organization","status","is_test","round","enumerator_id","ethnicity","education","farm_size","main_crop","digital_usage"];
  const qcols=QUESTIONS.flatMap(q=>[q.code+"_A",q.code+"_B"]);
  const header=[...cols,...qcols,...(SETTINGS.open_questions||[]).map(o=>o.code)];
  const lines=[header.join(",")];
  RESPONSES.forEach(r=>{
    const base=cols.map(c=>csvCell(r[c]));
    const qv=QUESTIONS.flatMap(q=>[csvCell(r.answers?.[q.code]?.a),csvCell(r.answers?.[q.code]?.b)]);
    const ov=(SETTINGS.open_questions||[]).map(o=>csvCell(r.open_answers?.[o.code]));
    lines.push([...base,...qv,...ov].join(","));
  });
  download(`atigb_responses_v2_${Date.now()}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  toast("Đã tải CSV");
};
$("#expJson").onclick=()=>{ download(`atigb_responses_v2_${Date.now()}.json`, JSON.stringify(RESPONSES,null,2), "application/json"); toast("Đã tải JSON"); };
$("#expSummary").onclick=()=>{
  const rows=RESPONSES.filter(r=>r.status!=="excluded");
  const types=[...new Set(rows.map(r=>r.respondent_type).filter(Boolean))];
  const header=["code","dimension","text","mean_before_all","mean_now_all",...types.flatMap(t=>[t+"_before",t+"_now"])];
  const lines=[header.join(",")];
  QUESTIONS.forEach(q=>{
    const row=[q.code,q.dimension,csvCell(q.text),qMean(rows,q.code,"a").toFixed(3),qMean(rows,q.code,"b").toFixed(3)];
    types.forEach(t=>{ const sub=rows.filter(r=>r.respondent_type===t); row.push(qMean(sub,q.code,"a").toFixed(3),qMean(sub,q.code,"b").toFixed(3)); });
    lines.push(row.join(","));
  });
  download(`atigb_summary_v2_${Date.now()}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  toast("Đã tải bảng tổng hợp");
};

checkAuth();
