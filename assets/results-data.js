// ============================================================
// Dữ liệu kết quả khảo sát ATiGB (tổng hợp tĩnh, không phụ thuộc Supabase).
// Nguồn: bản xuất khảo sát thực tế n=173 phản hồi (đã làm sạch),
// thang điểm 1–5, hai mốc "Trước 2019" và "Hiện nay".
// Dùng để vẽ biểu đồ kết quả ở mục #ketqua.
// ============================================================
export const ATIGB_RESULTS = {
  n: 173,
  overall: { before: 2.197, now: 3.366, change_pct: 53.2 },
  // Trung bình theo 5 chiều (toàn mẫu)
  dims: [
    { code: "C",  name: "Bối cảnh",  before: 2.366, now: 3.492 },
    { code: "I",  name: "Đầu vào",   before: 2.100, now: 3.357 },
    { code: "O",  name: "Tổ chức",   before: 2.203, now: 3.361 },
    { code: "OC", name: "Kết quả",   before: 2.223, now: 3.511 },
    { code: "IM", name: "Tác động",  before: 2.094, now: 3.030 }
  ],
  // Trung bình tổng theo nhóm đối tượng
  groups: [
    { code: "QLNN",       name: "QLNN",     before: 2.195, now: 3.393, n: 75 },
    { code: "NhaKhoaHoc", name: "Nhà KH",   before: 2.285, now: 3.404, n: 13 },
    { code: "KHCN",       name: "KHCN",     before: 2.229, now: 3.394, n: 25 },
    { code: "DN-HTX",     name: "DN/HTX",   before: 2.187, now: 3.337, n: 37 },
    { code: "NongDan",    name: "Nông dân", before: 2.137, now: 3.277, n: 23 }
  ]
};
