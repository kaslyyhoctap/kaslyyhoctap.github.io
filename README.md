# ÔnTập12 — Ôn thi Lịch Sử, Sinh Học, Hóa Học & Tiếng Anh lớp 12

## Giới thiệu

Website ôn tập trắc nghiệm Lịch sử 12, Sinh học 12 (Kết nối tri thức, Bài 1–3), Hóa học 12 (Chương 1–2) và Tiếng Anh 12 Global Success (Unit 1–2).
1088 câu hỏi (kèm dạng Đúng/Sai 4 ý và Trả lời ngắn), có đáp án + giải thích, chấm điểm tự động, theo dõi tiến độ.
Riêng Hóa học có tầng Vận dụng cao (tính toán nhiều bước, suy luận cấu tạo) và đề luôn gài tối thiểu 30% câu khó.
Riêng Tiếng Anh toàn bộ band 6.0–7.5, từ vựng B1–C1 chủ yếu B2, theo cấu trúc IELTS Reading (gồm cả Reading Comprehension).

## Tính năng

* Ôn tập theo bài (lý thuyết tóm tắt 6 bài Sử/Sinh + 2 chương Hóa (kèm sơ đồ minh họa) + 2 Unit Anh)
* Luyện trắc nghiệm (xem đáp án ngay)
* Kiểm tra tổng hợp tính giờ (10/20/30/40/50 câu, 10–60 phút)
* Trộn câu hỏi + trộn đáp án, ưu tiên câu chưa làm
* Chấm điểm /10, thống kê đúng/sai/bỏ qua, kết quả theo chủ đề + theo dạng bài Tiếng Anh
* Xem lại câu sai, luyện riêng đề câu sai, làm lại đề, đề mới
* Sổ tay cá nhân: gắn sao câu khó/từ vựng, xem lại qua bộ lọc
* Ngân hàng câu hỏi: tìm kiếm + lọc môn/bài/mức độ/dạng/trạng thái
* Flashcard từ vựng Anh Unit 1–2 (Anh→Việt / Việt→Anh, đánh dấu đã thuộc)
* Phân tích điểm yếu + gợi ý luyện 10 câu phần yếu (theo dạng bài, band, từng bài, chủ đề, mức độ khó)
* Biểu đồ tiến bộ: chuỗi ngày học, mục tiêu đề/tuần, điểm 14 đề gần đây
* Theo dõi tiến độ từng bài + lịch sử làm bài (localStorage, không cần đăng nhập)
* Dark mode (lưu lựa chọn), Responsive mobile/tablet/desktop
* Keyboard: phím 1–4 chọn đáp án, ←/→ chuyển câu

## Công nghệ

Website tĩnh thuần túy, không framework, không build:

* HTML + CSS + JavaScript vanilla (1 file `app.js`)
* Dữ liệu JSON dạng `*.js` trong `data/` (nạp bằng `<script>`, chạy được cả `file://`)
* `localStorage` khóa `ontap12-v1`
* Font Be Vietnam Pro (Google Fonts, có fallback hệ thống khi offline)

Không có backend, không cần `npm install`.

## Cài đặt local

Không cần cài đặt. Cách 1 — mở trực tiếp:

```powershell
# mở file index.html bằng trình duyệt
```

Cách 2 — chạy server tĩnh (khuyên dùng):

```powershell
cd D:\opencode\webhocbai
python -m http.server 8080
# mở http://localhost:8080/
```

## Build

Không cần build (dự án không dùng Vite/Webpack).
Toàn bộ file trong thư mục gốc (`index.html`, `styles.css`, `app.js`, `data/`) chính là bản production, đưa thẳng lên GitHub Pages.

```powershell
npm run build
# → không áp dụng cho dự án này (static, no build)
```

## Deploy

Tự động bằng GitHub Actions + GitHub Pages:

1. Push code lên branch `main`.
2. Workflow `.github/workflows/deploy.yml` tự chạy:
   `checkout → configure-pages → upload artifact (thư mục gốc) → deploy-pages`.
3. Vào repo → Settings → Pages → Source: **GitHub Actions**.

Hướng dẫn tạo repo + push lần đầu (chạy 1 lần trên máy bạn):

```powershell
cd D:\opencode\webhocbai
git init
git add .
git commit -m "ÔnTập12: website ôn thi Sử + Sinh 12 (180 câu)"
gh repo create ontap12 --public --source=. --remote=origin --push
# hoặc nếu chưa có gh CLI:
# git remote add origin https://github.com/<user>/ontap12.git
# git branch -M main
# git push -u origin main
```

## Live Demo

Sau khi bật Pages (Source: GitHub Actions), website có dạng:

`https://<user>.github.io/ontap12/`

> Thay `<user>` bằng username GitHub của bạn (ví dụ `kaslyyhoctap` → `https://kaslyyhoctap.github.io/ontap12/`).
> Điền URL thực tế vào đây sau khi deploy thành công.

## Cấu trúc

```
index.html            # 1 SPA: home / môn / lý thuyết / thi / kết quả / bank / vocab / tiến độ
styles.css            # design tokens, dark mode, responsive
app.js                # logic đề, timer, chấm điểm, localStorage
data/
  history-bai1.js     # 30 câu Sử Bài 1
  history-bai2.js     # 30 câu Sử Bài 2
  history-bai3.js     # 30 câu Sử Bài 3
  biology-bai1.js     # 30 câu Sinh Bài 1
  biology-bai2.js     # 30 câu Sinh Bài 2
  biology-bai3.js     # 30 câu Sinh Bài 3
  chemistry-ch1.js    # 30 câu Hóa Chương 1 (Este – Lipid)
  chemistry-ch2.js    # 30 câu Hóa Chương 2 (Carbohydrate)
  chemistry-ch1b.js   # 70 câu Hóa Chương 1 (50 lý thuyết + 50 vận dụng, gồm Đúng/Sai)
  chemistry-ch2b.js   # 70 câu Hóa Chương 2 (50 lý thuyết + 50 vận dụng, gồm Đúng/Sai)
  # + 300 câu Trả lời ngắn: 30 câu/môn/bài (Sử 3 bài, Sinh 3 bài, Hóa 2 chương, Anh 2 unit)
  english-unit1.js    # ~36 câu Anh Unit 1 (gốc)
  english-unit1b.js   # 50 câu Anh Unit 1 (bổ sung)
  english-unit1c.js   # 50 câu Anh Unit 1 (bổ sung)
  english-unit2.js    # ~48 câu Anh Unit 2 (gốc)
  english-unit2b.js   # 50 câu Anh Unit 2 (bổ sung)
  english-unit2c.js   # 50 câu Anh Unit 2 (bổ sung)
  english-unit1d.js   # 30 câu Anh Unit 1 band 7.0–8.5 (nâng cao)
  english-unit2d.js   # 30 câu Anh Unit 2 band 7.0–8.5 (nâng cao)
  english-unit1e.js   # 12 câu Anh Unit 1: Reading Comprehension + cloze khó
  english-unit2e.js   # 12 câu Anh Unit 2: Reading Comprehension + cloze khó
  english-vocab.js    # flashcard từ vựng Unit 1–2
  theory.js           # tóm tắt lý thuyết Sử + Sinh + Hóa (kèm sơ đồ SVG)
  english-theory.js   # tóm tắt lý thuyết Anh Unit 1–2
.github/workflows/
  deploy.yml          # deploy tĩnh lên GitHub Pages
```

Schema câu hỏi: `{id, subject, lesson, type, topic, question, options[4], correctAnswer, explanation, difficulty, band, source, sourceType, sourceUrl[, passageId, wrongWord, correctWord]}`.
Muốn thêm bộ sách khác: thêm file `data/...` mới + khai báo trong `index.html`, không sửa `app.js`.
