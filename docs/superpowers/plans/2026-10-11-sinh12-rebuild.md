# Sinh12 Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Sinh học 12 Bài 1/2/4 (mỗi bài 100 câu 40 MC / 30 TF / 30 SA) + CD1 thành lesson 5 riêng, viết lại theory có trace, tương thích app.js/index.html hiện tại.

**Architecture:** Ghi đè 3 file bài theo schema hiện hành, fix CD1 thành lesson 5 + wire-up, viết lại theory 1/2/4/5, validator Node fail-fast làm cổng nghiệm thu. Không framework, không dep mới.

**Tech Stack:** Vanilla JS (window.QBANK / window.THEORY), Node script validator (không dep), index.html script tags.

**Spec:** docs/superpowers/specs/2026-10-11-sinh12-rebuild-design.md

## Global Constraints

- Branch `main` sạch, không reset/history rewrite/force-push, không commit/push trừ khi yêu cầu.
- Chỉ xóa file Sinh trong phạm vi: `biology-bai1b, bai1c, bai2b, bai2c, bai4b, bai4c`; giữ Bài 3, Sử/Hóa/Anh/THPTQG, `app.js` schema/UI.
- Mỗi bài 1/2/4 đúng 100 câu: 40 MC / 30 TF / 30 SA; CD1 đúng 40 câu lesson 5.
- Schema chung: `{id, subject:"biology", lesson:1|2|4|5, topic, question, explanation, difficulty, source, sourceUrl:""}` + `type` bắt buộc.
- MC: `type:"multiple_choice"`, `options[4]` unique, `correctAnswer 0-3`, phân bố ~25%/vị trí (cho phép ≤35%).
- TF: `type:"true_false"`, `statements[4]` `{t, ok:boolean}`, mix Đúng/Sai, không toàn Đúng/Sai trong 1 câu.
- SA: `type:"short_answer"`, `answer:"^[0-9]{1,4}$"`, `maxLen=answer.length<=4`, không đơn vị/thập phân/`alts` chữ.
- ID: `bio1-mc-01..40`, `bio1-tf-01..30`, `bio1-sa-01..30` (tương tự bio2/bio4); CD1 `biocd1-01..40` lesson 5.
- Validator fail-fast: sai schema, trùng `question`, thiếu `explanation`/`source` trace `imgs/` → exit 1, ghi `needs_review`, không bịa.
- Theory giữ schema `window.THEORY`; trace trong `html` bằng `<p class="muted small">Nguồn: ...</p>`; giữ `biology[3]` và môn khác.
- Backup trước ghi đè vào `data/_backup-YYYYMMDD/` (untracked); xóa sau nghiệm thu.
- `localStorage ontap12-v1` giữ nguyên (id mới nên không map nhầm).
- Conflict công khai, giữ `needs_review`, không tự sửa: `biocd1-26` hỏi 7 lần nhưng giải thích `2^4=16`; `biocd1-30` sai schema MC; số tay tr.11 mờ.

## Review Focus

- Ảnh tay tr.11 mờ / chữ viết tay khó đọc → mong đợi `needs_review`, không bịa số.
- `biocd1-30` sai schema MC hiện tại → mong đợi validator bắt lỗi, không lọt UI.
- SA nhập chữ/đơn vị/thập phân → mong đợi bị từ chối bởi regex digits-only.
- Filter Bài 5 hiện chỉ cho Sinh, môn khác chọn Bài 5 → mong đợi không hiện/không lỗi.
- `localStorage ontap12-v1` cũ map nhầm id mới → mong đợi không map nhầm vì id mới hoàn toàn.

---

### Task 1: Validator + backup

**Files:**
- Create: `scripts/validate-biology.mjs`
- Create (untracked): `data/_backup-YYYYMMDD/` (copy 3 file bài + 6 file `*b/*c` + `data/theory.js` + `index.html`)

**Interfaces:**
- Consumes: schema `app.js` (`typeOf`, `normSA/saOk`, `META`) làm ground truth tương thích.
- Produces: `node scripts/validate-biology.mjs` → exit 0 pass / exit 1 fail + danh sách `needs_review`; backup path cho mọi task sau.

- [ ] **Step 1: Viết validator fail-fast**

Tạo `scripts/validate-biology.mjs` (Node, không dep mới) kiểm tra: count 100/bài 40/30/30 (Bài 1/2/4), CD1 40 lesson 5; MC `options[4]` unique + `correctAnswer 0-3` + phân bố mỗi vị trí ≤35%; TF 4 statements mix Đúng/Sai; SA `answer` match `^[0-9]{1,4}$` + `maxLen<=4`; unique `question` toàn bank; mọi câu có `explanation` + `source` chứa trace `imgs/`; `type` bắt buộc; sai bất kỳ → `console.error` + `process.exit(1)`.

- [ ] **Step 2: Chạy validator để xác nhận fail hiện tại**

Run: `node scripts/validate-biology.mjs`
Expected: FAIL (chưa đủ 100/bài, CD1 sai lesson/mojibake, `biocd1-30` sai schema).

- [ ] **Step 3: Backup trước ghi đè**

Copy `data/biology-bai1.js`, `data/biology-bai2.js`, `data/biology-bai4.js`, 6 file `*b/*c`, `data/theory.js`, `index.html` vào `data/_backup-YYYYMMDD/` (untracked, giữ nguyên nội dung).

- [ ] **Step 4: Chạy lại validator (vẫn fail, backup xong)**

Run: `node scripts/validate-biology.mjs`
Expected: FAIL như Step 2 (chưa sửa data, chỉ có backup).

### Task 2: Rebuild Bài 1 — 100 câu

**Files:**
- Modify: `data/biology-bai1.js` (ghi đè toàn file, giữ `window.QBANK.push(...[...])`)

**Interfaces:**
- Consumes: validator Task 1; trace `imgs/` Bài 1 (`843...` tr.1 + `836...` III + CD1 c.13,24,26,28,29,34,36,39).
- Produces: 100 câu `bio1-mc-01..40`, `bio1-tf-01..30`, `bio1-sa-01..30`, `lesson:1`, pass validator phần Bài 1.

- [ ] **Step 1: Viết 40 MC Bài 1**

Ghi 40 object `type:"multiple_choice"`, `lesson:1`, `subject:"biology"`, `options[4]` unique, `correctAnswer 0-3` phân bố ~10 mỗi vị trí, `explanation` + `source` trace ảnh cụ thể, `difficulty` trong Nhận biết/Thông hiểu/Vận dụng/Vận dụng cao. Nội dung: NTBS A-T 2H / G-C 3H, xoắn kép B (20Å, 34Å/vòng, 10 cặp), công thức N=2L/3.4 / L=N/2×3.4 / H=2A+3G / vòng=N/20, enzyme helicase/DNA pol 5'→3'/ligase/mồi RNA, bán bảo toàn + Meselson-Stahl, Ori đơn/đa.

- [ ] **Step 2: Viết 30 TF Bài 1**

Ghi 30 object `type:"true_false"`, mỗi câu `statements[4]` `{t, ok}` mix Đúng/Sai (không toàn Đúng/Sai), kèm `explanation` giải thích từng ý a/b/c/d, `source` trace ảnh.

- [ ] **Step 3: Viết 30 SA Bài 1 digits-only**

Ghi 30 object `type:"short_answer"`, `answer` string match `^[0-9]{1,4}$`, `maxLen=answer.length`, question ghi rõ "(số nguyên, không đơn vị)", chỉ số N/L/H/vòng/%/2^k đã kiểm tra tính toán (vd N=2L/3.4, H=N+G, 2^k, 2^k-2).

- [ ] **Step 4: Chạy validator phạm vi Bài 1**

Run: `node scripts/validate-biology.mjs`
Expected: Bài 1 pass 40/30/30 (Bài 2/4/CD1 vẫn fail là đúng ở giai đoạn này).

### Task 3: Rebuild Bài 2 — 100 câu

**Files:**
- Modify: `data/biology-bai2.js` (ghi đè toàn file)

**Interfaces:**
- Consumes: validator Task 1; trace Bài 2 (`839278...`, `840033...`, `842017...` + CD1 c.1-3,7,10-12,14-16,19-20,22-23,25,27,30-33,37,40).
- Produces: 100 câu `bio2-mc-01..40`, `bio2-tf-01..30`, `bio2-sa-01..30`, `lesson:2`.

- [ ] **Step 1: Viết 40 MC Bài 2**

Nội dung: gene 3 vùng (điều hòa/mã hóa/kết thúc), exon/intron, 64 codon (61 mã hóa + 3 kết thúc UAA/UAG/UGA, mở đầu AUG-Met), phiên mã (RNA pol, A-U/T-A/G-C, 5'→3', mRNA sơ khai→trưởng thành), dịch mã (ribosome, tRNA-anticodon, polysome), DNA→RNA→protein. Schema MC như Task 2.

- [ ] **Step 2: Viết 30 TF Bài 2**

30 câu `true_false` 4 ý mix Đúng/Sai, giải thích từng ý, trace ảnh. Không toàn Đúng/Sai trong 1 câu.

- [ ] **Step 3: Viết 30 SA Bài 2 digits-only**

Số codon=N/6, số aa=N/6-2, L mRNA=L gene, số aa môi trường, số tRNA — chỉ đáp án `^[0-9]{1,4}$`, `maxLen` đúng.

- [ ] **Step 4: Chạy validator phạm vi Bài 1+2**

Run: `node scripts/validate-biology.mjs`
Expected: Bài 1+2 pass, Bài 4/CD1 vẫn fail.

### Task 4: Rebuild Bài 4 — 100 câu

**Files:**
- Modify: `data/biology-bai4.js` (ghi đè toàn file)

**Interfaces:**
- Consumes: validator Task 1; trace Bài 4 (`839426...` + tr.11 tay + CD1 c.4,6,17-18,21,38).
- Produces: 100 câu `bio4-mc-01..40`, `bio4-tf-01..30`, `bio4-sa-01..30`, `lesson:4`; số tay mờ → `needs_review`, chỉ lấy công thức chuẩn.

- [ ] **Step 1: Viết 40 MC Bài 4**

Nội dung: khái niệm thay/thêm/mất, thay A-T→G-C tăng 1H / G-C→A-T giảm 1H, thêm/mất 1 cặp dịch khung, câm/sai nghĩa/vô nghĩa (UAA/UAG/UGA), nguyên nhân (tái bản, lý/hóa/sinh), vai trò tiến hóa/chọn giống. Schema MC chuẩn.

- [ ] **Step 2: Viết 30 TF Bài 4**

30 câu 4 ý mix, giải thích từng ý, trace ảnh; chỗ số tay mờ ghi `needs_review` trong `source`/`explanation`, không bịa số.

- [ ] **Step 3: Viết 30 SA Bài 4 digits-only**

Biến đổi H (±1), N±2, số aa đổi, vị trí codon — chỉ digits `^[0-9]{1,4}$`.

- [ ] **Step 4: Chạy validator phạm vi Bài 1/2/4**

Run: `node scripts/validate-biology.mjs`
Expected: 3 bài pass 100 mỗi bài (CD1 vẫn fail).

### Task 5: CD1 thành lesson 5 + wire-up + xóa thừa

**Files:**
- Modify: `data/biology-cd1.js` (lesson 5, fix mojibake, giữ id `biocd1-01..40`)
- Modify: `app.js:11` (`META.biology.lessons` thêm `5:"Chuyên đề 1 – Đề 1"`)
- Modify: `index.html` (xóa 6 script `*b/*c`, thêm `biology-cd1.js`)
- Delete: `data/biology-bai1b.js`, `data/biology-bai1c.js`, `data/biology-bai2b.js`, `data/biology-bai2c.js`, `data/biology-bai4b.js`, `data/biology-bai4c.js`

**Interfaces:**
- Consumes: 40 câu CD1 gốc (mix L1:9 L2:19 L3:6 L4:6) + conflict spec.
- Produces: CD1 `lesson:5` 40 câu wired, filter Bài 5 chỉ cho Sinh, 6 file thừa đã xóa.

- [ ] **Step 1: Fix CD1 lesson + encoding + conflict**

Đặt mọi câu `lesson:5`, fix mojibake UTF-8, giữ nguyên mix kiến thức L1-L4 làm đề tổng hợp; `biocd1-26` giữ nguyên câu hỏi + ghi conflict trong `explanation` (hỏi 7 lần vs `2^4=16`); `biocd1-30` sửa cho đúng schema MC (4 options unique + correctAnswer) hoặc chuyển TF/SA hợp lệ + ghi `needs_review`; mọi câu giữ `explanation` + `source` trace Đề 1.

- [ ] **Step 2: Wire-up META + index + xóa thừa**

Thêm lesson 5 vào `META.biology.lessons` (app.js:11), thêm `<script src="data/biology-cd1.js">` vào `index.html`, xóa 6 script `*b/*c`, xóa 6 file khỏi disk. Không động Bài 3/môn khác.

- [ ] **Step 3: Chạy validator toàn bank**

Run: `node scripts/validate-biology.mjs`
Expected: PASS (1/2/4 đủ 100 + CD1 40 lesson 5).

- [ ] **Step 4: Mở `index.html` kiểm tra count**

Mở trang: L1/L2/L4 mỗi bài 100 câu, CD1 đề riêng 40, L3 giữ 54, môn khác count không đổi; thử MC+TF+SA mỗi bài chấm đúng; filter Bài 5 chỉ cho Sinh.
Expected: đúng số lượng + chấm đúng.

### Task 6: Theory viết lại 1/2/4/5

**Files:**
- Modify: `data/theory.js` (`biology[1]`, `biology[2]`, `biology[4]`, thêm `biology[5]`; giữ `biology[3]` + môn khác)

**Interfaces:**
- Consumes: trace ảnh theo spec §3 + schema `window.THEORY` hiện hành.
- Produces: 4 entry theory có `<p class="muted small">Nguồn: ...</p>`, title/desc khớp META.

- [ ] **Step 1: Viết lại `biology[1]` + `biology[2]`**

Bài 1: DNA/N-L-H/enzyme/Ori/Meselson-Stahl (trace `843...`, `836...` III, CD1 c.13,24,26,28,29,34,36,39). Bài 2: gene 3 vùng/64 codon/phiên-dịch mã/DNA→RNA→protein (trace `839278...`, `840033...`, `842017...`, CD1 c.1-3,7,10-12,14-16,19-20,22-23,25,27,30-33,37,40). Giữ `title/desc` khớp META, thêm dòng Nguồn trong `html`.

- [ ] **Step 2: Viết lại `biology[4]` + thêm `biology[5]`**

Bài 4: thay/thêm/mất, H±1, dịch khung, câm/sai nghĩa/vô nghĩa, nguyên nhân/vai trò (trace `839426...`, tr.11, CD1 c.4,6,17-18,21,38; số mờ → `needs_review`). Bài 5: mô tả đề tổng hợp CD1 Đề 1 (40 câu, mix L1-L4) + trace 6 ảnh CD1. Giữ `biology[3]`.

- [ ] **Step 3: Mở theory kiểm tra**

Mở `index.html` → theory Sinh Bài 1/2/4/5 hiện đúng, có dòng Nguồn; Bài 3 không đổi.
Expected: hiển thị đúng + trace đầy đủ.

### Task 7: Nghiệm thu + science check 10%

**Files:**
- Test: `node scripts/validate-biology.mjs` + mở `index.html` thủ công, không tạo file mới.

**Interfaces:**
- Consumes: toàn bộ Task 1-6.
- Produces: nghiệm thu pass/fail, danh sách `needs_review` cuối cùng.

- [ ] **Step 1: Chạy validator cuối**

Run: `node scripts/validate-biology.mjs`
Expected: PASS.

- [ ] **Step 2: Science check 10% ngẫu nhiên/bài với ảnh**

Đối chiếu 10 câu/bài (10 MC/TF/SA trộn) với ảnh nguồn: đáp án đúng, công thức tính đúng, trace đúng ảnh. Conflict giữ `needs_review`.
Expected: 0 lỗi đáp án; lỗi (nếu có) ghi `needs_review`, không sửa lén.

- [ ] **Step 3: Kiểm tra UI/scoring/filter**

Mở `index.html`: count L1/L2/L4=100, CD1=40, L3=54; làm thử 1 MC + 1 TF + 1 SA mỗi bài chấm đúng; filter Bài 5 chỉ Sinh; theory có Nguồn; `localStorage` không map nhầm.
Expected: tất cả đúng.
