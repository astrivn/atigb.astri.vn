// ============================================================
// Dữ liệu kết quả khung ATiGB (tổng hợp tĩnh, không phụ thuộc Supabase).
//
// LƯU Ý QUAN TRỌNG: Đây là BỘ SỐ LIỆU MÔ PHỎNG / MINH HỌA (synthetic,
// n=360) dùng để trình diễn khung đánh giá ATiGB. ĐÂY KHÔNG PHẢI kết quả
// khảo sát chính thức. Kết quả khảo sát thực tế sẽ được cập nhật sau.
//
// Thang điểm 1–5, hai mốc "Trước 2019" và "Hiện nay".
// ============================================================
export const ATIGB_RESULTS = {
  illustrative: true,          // cờ đánh dấu số liệu minh họa/mô phỏng
  n: 360,
  overall: { before: 2.221, now: 3.341, change_pct: 50.4 },
  // Trung bình theo 5 chiều (toàn mẫu)
  dims: [
    { code: "C",  name: "Bối cảnh",  before: 2.395, now: 3.476 },
    { code: "I",  name: "Đầu vào",   before: 2.125, now: 3.315 },
    { code: "O",  name: "Tổ chức",   before: 2.234, now: 3.342 },
    { code: "OC", name: "Kết quả",   before: 2.238, now: 3.486 },
    { code: "IM", name: "Tác động",  before: 2.111, now: 3.008 }
  ],
  // Trung bình tổng theo nhóm đối tượng
  groups: [
    { code: "QLNN",       name: "QLNN",     before: 2.210, now: 3.376, n: 120 },
    { code: "NhaKhoaHoc", name: "Nhà KH",   before: 2.309, now: 3.393, n: 40 },
    { code: "KHCN",       name: "KHCN",     before: 2.255, now: 3.370, n: 55 },
    { code: "DN-HTX",     name: "DN/HTX",   before: 2.219, now: 3.306, n: 80 },
    { code: "NongDan",    name: "Nông dân", before: 2.164, now: 3.262, n: 65 }
  ]
};
