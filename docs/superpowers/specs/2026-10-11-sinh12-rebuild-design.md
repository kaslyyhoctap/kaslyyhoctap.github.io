# Spec: Rebuild Sinh học 12 — Bài 1, 2, 4 + CD1 (Cách A: thay file theo bài)

- Ngày: 2026-10-11. Branch: `main`. Trạng thái: chờ review spec, chưa implementation.
- Quyết định đã chốt: phạm vi Bài 1/2/4 + CD1; thay toàn bộ 1-2-4; giữ Bài 3; giữ Sử/Hóa/Anh/THPTQG; design A (thay file theo bài, CD1 thành lesson 5 riêng).

## 1. Phạm vi & kiến trúc file

- Rebuild đúng Bài 1, 2, 4 — mỗi bài 100 câu (40 MC / 30 TF / 30 SA), nguồn 13 ảnh `/imgs` đã đọc (6 CD1 câu 1–40 + 7 Nguyễn Huệ Bài 1/2/4).
- Bài 3 giữ nguyên 54 câu wired; Sử/Hóa/Anh/THPTQG + `app.js` + schema/UI giữ nguyên.
- Ghi đè: `data/biology-bai1.js`, `data/biology-bai2.js`, `data/biology-bai4.js` (id `bio1-*`, `bio2-*`, `bio4-*`).
- Xóa trong phạm vi: `bai1b, bai1c, bai2b, bai2c, bai4b, bai4c`.
- `data/biology-cd1.js` → `lesson:5` riêng "Chuyên đề 1 – Đề 1" (40 câu), fix mojibake, wire-up `index.html`.
- Viết lại `data/theory.js` key `biology[1,2,4]` + thêm `biology[5]`; giữ `biology[3]` và môn khác.

## 2. Schema 3 dạng + SA digits-only

- Chung: `{id, subject:"biology", lesson:1|2|4|5, topic, question, explanation, difficulty, source, sourceUrl:""}` + `type` bắt buộc.
- MC: `type:"multiple_choice"`, `options[4]` unique, `correctAnswer 0-3`, phân bố đáp án ~25%/vị trí.
- TF: `type:"true_false"`, `statements[4]` `{t, ok:boolean}`, mix Đúng/Sai, không toàn Đúng/Sai trong 1 câu.
- SA: `type:"short_answer"`, `answer:"^[0-9]{1,4}$"`, `maxLen=answer.length<=4`, không đơn vị/thập phân/`alts` chữ.
- ID: `bio1-mc-01..40`, `bio1-tf-01..30`, `bio1-sa-01..30` (tương tự bio2/bio4); CD1 `biocd1-01..40` lesson 5.
- `META.biology.lessons[5]` + `THEORY.biology[5]` + option filter Bài 5 chỉ cho Sinh.
- Validator fail-fast: sai schema, trùng `question`, thiếu `explanation`/`source` trace `imgs/` → exit 1, ghi `needs_review`, không bịa.

## 3. Theory viết lại + trace + conflict

- Giữ schema `window.THEORY`; trace ghi trong `html` bằng `<p class="muted small">Nguồn: ...</p>`.
- Bài 1: `843...` tr.1 + `836...` III + CD1 c.13,24,26,28,29,34,36,39 (DNA, N-L-H, enzyme, Ori, Meselson-Stahl).
- Bài 2: `839278...`, `840033...`, `842017...` + CD1 c.1-3,7,10-12,14-16,19-20,22-23,25,27,30-33,37,40 (gene 3 vùng, 64 codon, phiên/dịch mã, DNA→RNA→protein).
- Bài 4: `839426...` + tr.11 tay + CD1 c.4,6,17-18,21,38 (khái niệm, thay/thêm/mất, nguyên nhân, vai trò).
- Conflict công khai: `biocd1-26` hỏi 7 lần nhưng giải thích `2^4=16`; `biocd1-30` sai schema MC; số tay tr.11 mờ → chỉ lấy công thức chuẩn, ghi `needs_review`, giữ số ảnh khi rebuild, không tự sửa.

## 4. Validator + rollback + giữ môn khác

- `scripts/validate-biology.mjs` (Node, không dep mới): đếm 100/bài 40/30/30, CD1 40, phân bố MC ≤35%/vị trí, TF mix, SA regex, unique question, explanation+source trace.
- Backup trước ghi đè vào `data/_backup-YYYYMMDD/` (untracked): 3 file bài + 6 file `*b/*c` + theory + index; xóa sau nghiệm thu.
- Chỉ xóa file Sinh trong phạm vi; `index.html` xóa 6 script thừa + thêm cd1; `localStorage ontap12-v1` giữ nguyên (id mới nên không map nhầm).
- Trên `main` sạch, không reset/history rewrite, không commit/push trừ khi yêu cầu.

## 5. Kiểm thử + nghiệm thu

- `node scripts/validate-biology.mjs` pass.
- Mở `index.html`: L1/L2/L4 mỗi bài 100 câu, CD1 đề riêng 40, L3 giữ 54, môn khác count không đổi; thử MC+TF+SA mỗi bài chấm đúng; filter Bài 5 chỉ cho Sinh; theory có dòng Nguồn.
- Science check 10% ngẫu nhiên/bài với ảnh nguồn; conflict giữ `needs_review`.
