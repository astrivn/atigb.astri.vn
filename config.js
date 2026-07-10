// ============================================================
// Cấu hình công khai (an toàn để đưa lên frontend + GitHub).
// CHỈ dùng publishable key — KHÔNG bao giờ đặt secret key/DB password ở đây.
// Bảo mật dữ liệu dựa trên Row Level Security (RLS) của Supabase.
// ============================================================
window.ATIGB_CONFIG = {
  SUPABASE_URL: "https://hmzkerdiizxgstlyixcc.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_jlN2WX9w6dmKDVxyI8gAQw_XquZSHxQ",
  SCHEMA: "atigb",
  // R2 Cloudflare — bucket atigb-media (Public Development URL)
  R2_PUBLIC_BASE: "https://pub-d5f8e8a14fc94615bbd1bbcd3b77bf3a.r2.dev"
};
