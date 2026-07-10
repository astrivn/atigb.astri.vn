import { sb, toast, DIM_ORDER, fmtDate } from "./db.js";
import * as Chart from "./charts.js";

const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const esc = (s)=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

const TYPE_LABEL = { QLNN:"Cán bộ QLNN", "DN-HTX":"DN / HTX", KHCN:"Chuyên gia KHCN", NhaKhoaHoc:"Nhà khoa học", NongDan:"Nông dân" };
const DIM_NAME = { C:"Bối cảnh (C)", I:"Đầu vào (I)", O:"Tổ chức (O)", OC:"Kết quả (OC)", IM:"Tác động (IM)" };
let DIMS = {}, QUESTIONS = [], RESPONSES = [], SETTINGS = {};

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
}));

// ============ LOAD ============
async function loadData() {
  const [{ data: st }, { data: qs }, { data: rs }] = await Promise.all([
    sb.from("settings").select("*"),
    sb.from("questions").select("*").order("sort_order"),
    sb.from("responses").select("*").order("created_at", { ascending: false }),
  ]);
  SETTINGS = Object.fromEntries((st||[]).map(r=>[r.key,r.value]));
  DIMS = SETTINGS.dimensions || {};
  QUESTIONS = qs || [];
  RESPONSES = rs || [];
  // populate filters
  const types = [...new Set(RESPONSES.map(r=>r.respondent_type).filter(Boolean))];
  $("#fltType").innerHTML = `<option value="">Mọi nhóm</option>` + types.map(t=>`<option value="${t}">${esc(TYPE_LABEL[t]||t)}</option>`).join("");
  renderDashboard();
  renderTable();
  renderContentAdmin();
}

// ============ STATS ============
function qByDim(){ const m={}; DIM_ORDER.forEach(d=>m[d]=[]); QUESTIONS.forEach(q=>(m[q.dimension]||=[]).push(q)); return m; }
function filterSet(){
  let rows = RESPONSES.slice();
  if (!$("#inclTest").checked) rows = rows.filter(r=>!r.is_test);
  const f = $("#dashFilter").value;
  if (f!=="all") rows = rows.filter(r=>r.status===f);
  return rows.filter(r=>r.status!=="excluded");
}
function mean(arr){ return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function dimMean(rows, dim, side){
  const qs = qByDim()[dim].map(q=>q.code); const vals=[];
  rows.forEach(r=>qs.forEach(c=>{ const v=r.answers?.[c]?.[side]; if(v!=null) vals.push(+v); }));
  return mean(vals);
}
function qMean(rows, code, side){ const vals=[]; rows.forEach(r=>{const v=r.answers?.[code]?.[side]; if(v!=null)vals.push(+v);}); return mean(vals); }
function overallMean(rows, side){ return mean(DIM_ORDER.map(d=>dimMean(rows,d,side)).filter(x=>x>0)); }

// ============ DASHBOARD ============
function renderDashboard() {
  const rows = filterSet();
  const nowAll = overallMean(rows,"b"), befAll = overallMean(rows,"a");
  const im5now = qMean(rows,"IM5","b");
  const kpis = [
    ["ATiGB tổng (nay)", nowAll.toFixed(2), "trên thang 5,00", `+${(nowAll-befAll).toFixed(2)} so với trước 2019`],
    ["Số phản hồi", rows.length, "đang tính toán", `${rows.filter(r=>!r.is_test).length} thật · ${rows.filter(r=>r.is_test).length} mẫu`],
    ["Cải thiện", befAll?`+${Math.round((nowAll-befAll)/befAll*100)}%`:"–", "so với trước 2019", `từ ${befAll.toFixed(2)} → ${nowAll.toFixed(2)}`],
    ["IM5 · CBAM 2026", im5now.toFixed(2), "chỉ số thấp nhất", "cần ưu tiên ứng phó"],
  ];
  $("#kpis").innerHTML = kpis.map(([t,n,s,d])=>`<div class="kpi"><div class="n">${n}</div><div class="t">${t}</div><div class="s">${s}</div><div class="delta">${d}</div></div>`).join("");

  const color = (d)=>DIMS[d]?.color||"#2E7D5B";
  // radar
  Chart.radar($("#chartRadar"), {
    labels: DIM_ORDER,
    series: [
      { name:"Trước 2019", color:"#C77A34", values: DIM_ORDER.map(d=>dimMean(rows,d,"a")) },
      { name:"Hiện nay", color:"#16883F", values: DIM_ORDER.map(d=>dimMean(rows,d,"b")) },
    ]
  });
  // grouped bar
  Chart.groupedBar($("#chartBar"), {
    labels: DIM_ORDER,
    series: [
      { name:"Trước 2019", color:"#E3B183", values: DIM_ORDER.map(d=>dimMean(rows,d,"a")) },
      { name:"Hiện nay", color:"#16883F", values: DIM_ORDER.map(d=>dimMean(rows,d,"b")) },
    ]
  });
  // line IM
  const imQ = qByDim()["IM"];
  Chart.lineChart($("#chartLine"), {
    labels: imQ.map(q=>q.code),
    values: imQ.map(q=>qMean(rows,q.code,"b")),
    color:"#16883F", highlight:[imQ.findIndex(q=>q.code==="IM5")].filter(i=>i>=0)
  });
  // donut
  const typeCounts = {};
  rows.forEach(r=>{ const t=r.respondent_type||"Khác"; typeCounts[t]=(typeCounts[t]||0)+1; });
  const palette = { QLNN:"#0C5A29", "DN-HTX":"#8DCB3F", KHCN:"#2FA457", NhaKhoaHoc:"#4E9A6B", NongDan:"#C77A34", "Khác":"#9AA893" };
  Chart.donut($("#chartDonut"), { data: Object.entries(typeCounts).map(([k,v])=>({ name:TYPE_LABEL[k]||k, value:v, color:palette[k]||"#8A938D" })) });
  // heat table
  renderHeat(rows);
}

function heatColor(v){
  // 1(red) -> 3(amber) -> 5(green)
  const stops = [[1,"#B23A48"],[2.5,"#D08A2E"],[3.5,"#7FB03C"],[5,"#16883F"]];
  for (let i=0;i<stops.length-1;i++){ if(v<=stops[i+1][0]){ return stops[i+1][1]; } }
  return "#16883F";
}
function renderHeat(rows){
  const types = [...new Set(rows.map(r=>r.respondent_type).filter(Boolean))];
  let html = `<table class="heat"><thead><tr><th></th>${DIM_ORDER.map(d=>`<th style="text-align:center;font-size:.72rem">${d}</th>`).join("")}</tr></thead><tbody>`;
  types.forEach(t=>{
    const sub = rows.filter(r=>r.respondent_type===t);
    html += `<tr><td class="lbl">${esc(TYPE_LABEL[t]||t)}</td>` + DIM_ORDER.map(d=>{
      const v = dimMean(sub,d,"b"); return `<td style="background:${heatColor(v)}">${v?v.toFixed(2):"–"}</td>`;
    }).join("") + `</tr>`;
  });
  html += `<tr><td class="lbl" style="background:var(--forest);color:#fff">Chung</td>` + DIM_ORDER.map(d=>{
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
  if(t) rows=rows.filter(r=>r.respondent_type===t);
  if(s) rows=rows.filter(r=>r.status===s);
  if(tt) rows=rows.filter(r=>String(r.is_test)===tt);
  if(q) rows=rows.filter(r=>(r.district||"").toLowerCase().includes(q)||(r.organization||"").toLowerCase().includes(q));
  return rows;
}
function renderTable(){
  const rows = currentRows();
  $("#rowCount").textContent = `${rows.length} phản hồi`;
  $("#respBody").innerHTML = rows.map(r=>{
    const answered = Object.keys(r.answers||{}).length;
    const nm = overallMean([r],"b");
    return `<tr>
      <td>${fmtDate(r.created_at)}${r.is_test?' <span class="pill" style="font-size:.65rem">mẫu</span>':''}</td>
      <td>${esc(TYPE_LABEL[r.respondent_type]||r.respondent_type||'–')}</td>
      <td>${esc(r.district||'–')}</td>
      <td>${r.years_exp??'–'}</td>
      <td>${answered}/${QUESTIONS.length}</td>
      <td><b>${nm?nm.toFixed(2):'–'}</b></td>
      <td><span class="badge-status st-${r.status}">${statusLabel(r.status)}</span></td>
      <td style="white-space:nowrap">
        <button class="icon-btn" data-edit="${r.id}">✎</button>
        <button class="icon-btn" data-del="${r.id}">🗑</button>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:30px">Không có dữ liệu.</td></tr>`;
  $$("[data-edit]").forEach(b=>b.addEventListener("click",()=>editResponse(b.dataset.edit)));
  $$("[data-del]").forEach(b=>b.addEventListener("click",()=>delResponse(b.dataset.del)));
}
const statusLabel=(s)=>({raw:"Thô",cleaned:"Đã sạch",flagged:"Gắn cờ",excluded:"Loại trừ"}[s]||s);
["fltType","fltStatus","fltTest","fltSearch"].forEach(id=>$("#"+id).addEventListener("input",renderTable));

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
      years_exp:$("#mYears").value?+$("#mYears").value:null, admin_note:$("#mNote").value||null, answers };
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

// ============ CONTENT ADMIN ============
const R2_BASE = (window.ATIGB_CONFIG.R2_PUBLIC_BASE||"").replace(/\/$/,"");
function mediaUrl(u){ if(!u) return ""; return /^https?:\/\//.test(u) ? u : (R2_BASE ? R2_BASE+"/"+u.replace(/^\//,"") : u); }

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
      <div class="field"><label>URL ảnh (từ R2 Cloudflare)</label><input type="text" id="eImg" value="${esc(e.image_url||'')}" placeholder="https://media.astri.vn/atigb/su-kien-1.jpg  hoặc  su-kien-1.jpg"></div>
      <div class="field"><label>Mô tả (tuỳ chọn)</label><textarea id="eDesc" rows="2">${esc(e.description||'')}</textarea></div>
      <div style="background:var(--cream-2);padding:12px;border-radius:10px;font-size:.82rem;color:var(--ink-2);margin-bottom:14px">
        💡 Nếu đã đặt <code>R2_PUBLIC_BASE</code> trong config, bạn chỉ cần nhập <b>tên file</b> (vd <code>su-kien-1.jpg</code>). Nếu chưa, nhập <b>URL đầy đủ</b> của ảnh.
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn btn-ghost" id="mCancel">Hủy</button><button class="btn btn-primary" id="mSave">Lưu</button></div>
    </div>`);
  $("#mClose").onclick=closeModal;$("#mCancel").onclick=closeModal;
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
      <div class="field"><label>Ảnh URL (R2)</label><input type="text" id="nImg" value="${esc(n.image_url||'')}"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn btn-ghost" id="mCancel">Hủy</button><button class="btn btn-primary" id="mSave">Lưu</button></div>
    </div>`);
  $("#mClose").onclick=closeModal;$("#mCancel").onclick=closeModal;
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
  const cols=["id","created_at","respondent_type","district","years_exp","organization","status","is_test"];
  const qcols=QUESTIONS.flatMap(q=>[q.code+"_A",q.code+"_B"]);
  const header=[...cols,...qcols,...(SETTINGS.open_questions||[]).map(o=>o.code)];
  const lines=[header.join(",")];
  RESPONSES.forEach(r=>{
    const base=cols.map(c=>csvCell(r[c]));
    const qv=QUESTIONS.flatMap(q=>[csvCell(r.answers?.[q.code]?.a),csvCell(r.answers?.[q.code]?.b)]);
    const ov=(SETTINGS.open_questions||[]).map(o=>csvCell(r.open_answers?.[o.code]));
    lines.push([...base,...qv,...ov].join(","));
  });
  download(`atigb_responses_${Date.now()}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  toast("Đã tải CSV");
};
$("#expJson").onclick=()=>{ download(`atigb_responses_${Date.now()}.json`, JSON.stringify(RESPONSES,null,2), "application/json"); toast("Đã tải JSON"); };
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
  download(`atigb_summary_${Date.now()}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  toast("Đã tải bảng tổng hợp");
};

checkAuth();
