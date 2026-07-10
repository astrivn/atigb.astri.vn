# ATiGB — Khảo sát QLNN về Nông nghiệp Công nghệ cao (Sơn La)

Ứng dụng khảo sát cho luận án tiến sĩ (NCS Nguyễn Việt Hùng, Trường Đại học Thủy lợi) — khung đánh giá **ATiGB 5 chiều** (Context / Input / Output / Outcome / Impact).

## Kiến trúc
- **Frontend tĩnh** (HTML/CSS/JS thuần) — deploy trên Vercel.
- **Supabase** — CSDL + Auth (schema `atigb`), truy cập qua publishable key + Row Level Security.
- **Biểu đồ** SVG thuần (`assets/charts.js`), không phụ thuộc thư viện ngoài.
- **R2 Cloudflare** — lưu media (cấu hình `R2_PUBLIC_BASE` trong `config.js`).

## Trang
- `index.html` — Giới thiệu · Số liệu · Tin tức · Khung ATiGB · Khảo sát · Kết quả.
- `admin.html` — Đăng nhập · Dashboard · Quản lý dữ liệu · Xuất báo cáo.

_© 2026 · Astri.vn_
