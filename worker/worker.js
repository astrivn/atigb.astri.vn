// ============================================================
// ATiGB Upload Worker — nhận ảnh từ trang admin, ghi vào R2 bucket.
// Xác thực: chỉ chấp nhận request có Supabase access token hợp lệ (admin đã đăng nhập).
// Binding cần cấu hình: BUCKET (R2 bucket: atigb-media)
// Biến môi trường (Variables): SUPABASE_URL, SUPABASE_ANON, R2_PUBLIC_BASE, ALLOWED_ORIGIN
// ============================================================

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Max-Age": "86400",
  };
}
function json(obj, status, env) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(env) });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, env);

    // --- Xác thực admin qua Supabase ---
    const auth = request.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Thiếu token" }, 401, env);
    try {
      const u = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: env.SUPABASE_ANON, Authorization: `Bearer ${token}` },
      });
      if (!u.ok) return json({ error: "Không có quyền (token không hợp lệ)" }, 401, env);
    } catch (e) {
      return json({ error: "Lỗi xác thực: " + e.message }, 500, env);
    }

    // --- Đọc file ---
    let form;
    try { form = await request.formData(); }
    catch { return json({ error: "Body không hợp lệ (cần multipart/form-data)" }, 400, env); }
    const file = form.get("file");
    if (!file || typeof file === "string") return json({ error: "Không có file" }, 400, env);

    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!ALLOWED.includes(file.type)) return json({ error: "Chỉ chấp nhận ảnh JP/PNG/WebP/GIF/AVIF" }, 400, env);
    if (file.size > 10 * 1024 * 1024) return json({ error: "Ảnh vượt quá 10MB" }, 400, env);

    // --- Tạo key an toàn ---
    const folderRaw = (form.get("folder") || "su-kien").toString();
    const folder = folderRaw.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "") || "su-kien";
    const extMap = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
    const ext = extMap[file.type] || "bin";
    const rand = crypto.randomUUID().slice(0, 8);
    // Date.now() trong Worker OK (khác môi trường workflow)
    const stamp = Date.now();
    const key = `${folder}/${stamp}-${rand}.${ext}`;

    // --- Ghi vào R2 ---
    try {
      const buf = await file.arrayBuffer();
      await env.BUCKET.put(key, buf, { httpMetadata: { contentType: file.type } });
    } catch (e) {
      return json({ error: "Lỗi ghi R2: " + e.message }, 500, env);
    }

    const base = (env.R2_PUBLIC_BASE || "").replace(/\/$/, "");
    return json({ ok: true, key, url: base ? `${base}/${key}` : key }, 200, env);
  },
};
