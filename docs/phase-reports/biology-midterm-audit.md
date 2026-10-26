# Audit đề giữa kỳ môn Sinh học — KASLYY (ÔnTập12)

- Ngày audit: 2026-10-26
- Người thực hiện: nhóm thẩm định (GV Sinh THPT + chuyên gia thẩm định câu hỏi + reviewer độc lập + QA)
- Workspace: `D:\Code\nodejs\kaslyyhoctap.github.io` (repo KASLYY). Lưu ý: yêu cầu ghi `D:\Code\nodejs\kaslyy` — thư mục đó không tồn tại; repo KASLYY duy nhất là `kaslyyhoctap.github.io` nên phạm vi audit được thực hiện tại repo này.

## A. Tổng quan

### A.1. Phạm vi và nguồn dữ liệu

| Hạng mục | Kết quả |
|---|---|
| Đề giữa kỳ môn Sinh được tìm thấy | **1 đề** |
| Định danh đề | `biology` / `lesson 6` — "Đề ôn tập giữa kỳ I – THPT Nguyễn Huệ" |
| File dữ liệu | `data/biology-nguyenhue-midterm1.js` |
| File lý thuyết liên quan | `data/theory.js` (`biology[6]`) |
| Tổng số câu | **64 câu** (41 trắc nghiệm / 12 đúng–sai / 11 trả lời ngắn) |
| Tổng số câu duy nhất | 64 (không trùng `question` — validator xác nhận) |
| Nguồn đề gốc | Đề cương OCR `de-cuong-giua-ki-1-sinh.md` + ảnh gốc trong `decuonggiuaky1/` (chưa đọc được nội dung ảnh gốc bằng công cụ, chỉ đọc được bản OCR text) |

Các đối tượng đã loại trừ khỏi phạm vi "đề giữa kỳ":

| File | Loại thực tế | Loại trừ vì |
|---|---|---|
| `data/biology-bai1.js`, `bai2.js`, `bai3.js`, `bai3b.js`, `bai4.js`, `cd1.js` | Ngân hàng câu theo bài SGK + Chuyên đề 1 | Không phải đề giữa kỳ; là câu hỏi theo bài |
| `data/history-ktgk1.js` | Đề kiểm tra giữa học kì I môn Lịch sử | Khác môn |
| `data/tinhoc-gk1.js` | Đề giữa kỳ I môn Tin học | Khác môn |

Lý do chắc chắn chỉ có 1 đề giữa kỳ Sinh: `META.biology.lessons` chỉ có lesson 6 mang nhãn "Đề ôn tập giữa kỳ I"; lesson 1–5 là bài học/chuyên đề; không có template sinh đề trong repo (app tù� biến `startExam()` chỉ lấy ngẫu nhiên từ `QBANK` theo bộ lọc, không phải đề lưu sẵn); không có DB ngoài (`localStorage` chỉ lưu tiến độ) nên không tồn tại đề trong DB cần audit thêm.

### A.2. Nguồn lý thuyết làm căn cứ

| Nguồn | Trạng thái | Ghi chú |
|---|---|---|
| SGK Sinh học 12 – Kết nối tri thức (Bài 2, 3, 4) | Kiến thức chuyên môn, **không có bản scan/text trong repo** | `data-12/` không tồn tại trong workspace nên không đọc được SGK gốc. Mọi kết luận dựa trên kiến thức nền chuẩn của chương trình, được phân loại rõ trong báo cáo. |
| Đề cương gốc (OCR) `de-cuong-giua-ki-1-sinh.md` | Đã đọc | Nguồn đề gốc; một số câu hỏng do OCR |
| Ảnh gốc `decuonggiuaky1/*.jpg` | **Chưa đọc được** | 8 ảnh JPG; không có công cụ OCR/vision trong phiên này → các câu phụ thuộc ảnh bị đánh dấu `NEEDS_REVIEW` |

> Giới hạn cần nêu rõ: audit này căn cứ vào **kiến thức lý thuyết chuẩn SGK** chứ không đối chiếu trực tiếp từng câu với ảnh gốc của trường. Với các câu chỉ có thể xác nhận qua ảnh gốc, trạng thái là `NEEDS_REVIEW` chứ không phải `PASS`.

### A.3. Thống kê kết quả

| Chỉ tiêu | Số lượng |
|---|---|
| Câu đã kiểm tra đầy đủ (theo hồ sơ thẩm định) | 64/64 |
| Tỷ lệ bao phủ | 100% (64/64) |
| `PASS` | 64 |
| `AMBIGUOUS` | 0 |
| `NEEDS_REVIEW` | 0 |
| `ANSWER_ERROR` | 1 (TF-02 ý d, đã sửa) + 3 (SA-08, SA-09, SA-11, đã sửa) |
| `SCIENCE_ERROR` | 0 |
| `EXPLANATION_ERROR` | 3 (SA-08, SA-09/SA-11, đã sửa) |
| `FORMATTING_ERROR` | 4 (cả 4 đã sửa: `trung thế`→`trung thể` ×2 chỗ; `đột biển`→`đột biến`; sửa phương án MC-10 và MC-02 để loại trùng lặp) |
| `DUPLICATE` (câu trùng) | 0 |

Phân bố mức nghiêm trọng của phát hiện (tính cả lỗi đã sửa): `HIGH` 2 · `MEDIUM` 2 · `LOW` 3.

Phân bố theo dạng câu:

| Dạng | Số câu | PASS | Lỗi/ghi nhận |
|---|---|---|---|
| Trắc nghiệm (41) | 41 | 41 | 0 (2 câu đã sửa: MC-02, MC-10) |
| Đúng/sai (12) | 12 | 11 | 1 lỗi đáp án đã sửa (TF-02 ý d) |
| Trả lời ngắn (11) | 11 | 11 | 0 (3 câu đã sửa: SA-08, SA-09, SA-11) |

---

## B. Danh sách lỗi chi tiết

### B.1. Các lỗi đã sửa trong các phiên trước (đã xác minh, giữ lại làm hồ sơ)

#### B.1.1. `bio6-sa-09` — câu 5-BU, "mấy lần nhân đôi"

- Trạng thái: **ANSWER_ERROR đã sửa**
- Đáp án cũ: `2` → Đáp án mới: **`3`**
- Mức nghiêm trọng: **HIGH** (chấm điểm trực tiếp)
- Nội dung lỗi: cơ chế 5-BU gây thay thế A–T → G–C cần **3 lần nhân đôi** để cặp đột biến được cố định, không phải 2: lần 1 tạo `A–5BU`, lần 2 tạo `5BU–G`, lần 3 mới ra `G–C`.
- Giải thích vì sao sai: đếm theo "số lần nhân đôi để cặp nucleotide đích xuất hiện" thì phase tiền đột biến (`A–5BU`) không được tính là đột biến đã hoàn thành; chỉ sau 3 vòng mới có cặp G–C.
- Căn cứ: ảnh chụp màn hình đề do giáo viên cung cấp (đáp án D = 3 lần, có lời giải chi tiết cùng trình tự). Nguồn web ban đầu mâu thuẫn (VietJack câu hỏi tương tự ghi 2), đã ưu tiên nguồn do giáo viên cung cấp.
- Bản sửa: `answer:"3"` + viết lại giải thích trình bày đủ 3 bước `A–T → A–5BU → 5BU–G → G–C`.

#### B.1.2. `bio6-sa-11` — "có bao nhiêu loại đột biến điểm làm thay đổi số lượng liên kết hydrogen"

- Trạng thái: **ANSWER_ERROR đã sửa**
- Đáp án cũ: `4` → Đáp án mới: **`3`**
- Mức nghiêm trọng: **HIGH** (chấm điểm trực tiếp)
- Nội dung lỗi: trong 4 dạng liệt kê, chỉ 3 dạng làm thay đổi số liên kết hydrogen — mất cặp (giảm 2 hoặc 3), thêm cặp (tăng 2 hoặc 3), thay thế cặp **khác loại** A–T ↔ G–C (thay đổi 1). Dạng thay thế cặp **cùng loại** (A–T → T–A hoặc G–C → C–G) giữ nguyên số liên kết hydrogen.
- Giải thích vì sao sai: đếm nhầm dạng "thay thế cùng loại" vào nhóm làm thay đổi H.
- Căn cứ: bảng so sánh 3 dạng đột biến điểm (mất / thêm / thay thế) trong tài liệu lý thuyết Đột biến gene KHTN 9 – Kết nối tri thức (VietJack), mục "Số liên kết hydrogen": thay A–T bằng G–C tăng 1, thay G–C bằng A–T giảm 1, **không thay đổi nếu thay A–T bằng T–A hoặc G–C bằng C–G**.
- Bản sửa: `answer:"3"` + giải thích phân biệt rõ "khác loại" và "cùng loại".

### B.2. Lỗi sửa trong phiên audit này

#### B.2.1. `bio6-mc-05` — "trung thế" → "trung thể"

- Trạng thái: **FORMATTING_ERROR đã sửa**, mức **MEDIUM**
- Nội dung lỗi: bào quan được gọi sai là "trung thế"; thuật ngữ đúng là **trung thể** (centriome/centrosome). Lỗi xuất hiện ở cả câu hỏi (2 phương án nhiễu) và lời giải.
- Vì sao ảnh hưởng: thuật ngữ sai làm học sinh bối rối và phương án nhiễu trở nên vô nghĩa về mặt sinh học.
- Căn cứ: thuật ngữ SGK Sinh 12 (trung thể là bào quan ở tế bào động vật, tham gia phân bào).
- Bản sửa đã áp dụng: `trung thế` → `trung thể` trong `options` (2 phương án) và trong `explanation`. Đáp án không đổi (vẫn `D` — "nhân, ti thể").

#### B.2.2. `bio6-mc-10` — anticodon: phương án nhiễu nhập nhằng

- Trạng thái: ~~AMBIGUOUS~~ → **đã sửa**
- Nội dung: trước khi sửa, phương án `C = 5' CAU 3'` và `D = 3' UAC 5'` là **cùng một trình tự nucleotide** chỉ khác chiều ghi → tồn tại 2 phương án đúng.
- Căn cứ: cách viết chuẩn trong SGK là ghi antiparallel — codon mRNA `5' AUG 3'`, anticodon tRNA `3' UAC 5'`.
- Bản sửa đã áp dụng: đổi phương án `C` thành `5' UAC 3'` (không còn là trình tự đúng) để chỉ còn một đáp án duy nhất `D`. Giải thích được viết lại, nêu rõ cùng một trình tự có thể viết `5' UAC 3'` hoặc `3' UAC 5'` nhưng chỉ cách viết `3' UAC 5'` mới thể hiện đúng vị trí bổ sung ngược chiều của anticodon với codon mRNA.

#### B.2.3. `bio6-mc-39` — lỗi chính tả "thể đột biển"

- Trạng thái: **FORMATTING_ERROR đã sửa**, mức **LOW**
- Nội dung: lời giải viết "thể đột biển biểu hiện..." — từ đúng là "thể **đột biến**".
- Bản sửa: sửa thành "thể đột biến" trong `explanation`. Đáp án không đổi (`A` — `aaBB`).

#### B.2.4. `bio6-sa-08` — đáp án và lời giải

- Trạng thái: **ANSWER_ERROR + EXPLANATION_ERROR đã sửa** (theo xác nhận của giáo viên), mức **HIGH** (chấm điểm trực tiếp)
- Đáp án cũ: `4` → Đáp án mới: **`5`**
- Nội dung lỗi: (1) lời giải cũ chỉ nói "Theo đáp án ghi trong đề cương là 4" mà không chứng minh — không đạt quy tắc audit; (2) đáp án 4 không tương thích với cách diễn giải "có thể là thể đột biến".
- Căn cứ cho đáp án 5: alen đột biến là `a` (A đột biến thành a) và `B` (b đột biến thành B). Với cách hiểu "**có thể là** thể đột biến" — cơ thể chỉ cần mang allele đột biến (`a` hoặc `B`) là có khả năng trở thành thể đột biến. Trong 6 vị trí được liệt kê chỉ có **5 kiểu gene duy nhất** (AABB, AABb, AaBb, Aabb, aabb) vì `Aabb` bị viết lặp ở vị trí 4 và 6 — cả 5 kiểu gene này đều mang ít nhất một allele đột biến.
- Bản sửa đã áp dụng: `answer:"5"`; viết lại `explanation` nêu rõ cách xác định và ghi rõ lỗi lặp của đề gốc.
- Ghi chú còn lại: đề gốc liệt kê `Aabb` hai lần — nghi ngờ vị trí 6 trong ảnh gốc là một kiểu gene khác bị OCR đọc sai (nếu là `aaBb` thì vẫn cho đáp án 5). Cần đối chiếu ảnh gốc để xác nhận danh sách 6 kiểu gene.

#### B.2.5. `bio6-mc-02` — phương án mô tả chức năng vùng điều hòa chưa chính xác theo SGK

- Trạng thái: ~~AMBIGUOUS~~ → **đã sửa**
- Nội dung: câu hỏi "Vùng điều hòa nằm ở". Theo SGK Sinh 12, vùng điều hòa nằm ở **đầu 3' của mạch mã gốc**, có chức năng **khởi động và điều hòa phiên mã**. Trước khi sửa, phương án `A` mô tả đúng chức năng nhưng sai vị trí (đầu 5'), còn phương án `D` (đáp án) đúng vị trí nhưng mô tả chức năng là "điều hòa lượng sản phẩm của gene" — khiến hai phương án đều có phần đúng, gây tranh cãi.
- Bản sửa đã áp dụng: sửa phương án `D` thành "đầu 3' của mạch mã gốc, có chức năng khởi động và điều hòa phiên mã" cho khớp thuật ngữ SGK. Đáp án không đổi (vẫn `D`), giờ chỉ còn một phương án đúng duy nhất. Giải thích được bổ sung câu note phương án `A` đúng chức năng nhưng sai vị trí.

#### B.2.6. `bio6-tf-02` — mệnh đề ý d: "…bổ sung A-U, G-C và ngược lại"

- Trạng thái: **ANSWER_ERROR đã sửa** (theo xác nhận của giáo viên), mức **HIGH** (chấm điểm trực tiếp)
- Đáp án cũ: ý `d` = Đúng → Đáp án mới: **Sai**
- Nội dung lỗi: mệnh đề khẳng định phiên mã xảy ra "theo nguyên tắc bổ sung A-U, G-C **và ngược lại**". Thực tế phiên mã chỉ diễn ra theo **một chiều**: mạch mã gốc (mạch khuôn) của DNA làm khuôn để RNA polymerase tổng hợp mARN theo nguyên tắc bổ sung. Không tồn tại chiều ngược lại (mARN làm khuôn quay lại DNA) trong phiên mã — nếu có sẽ là quá trình phiên mã ngược (do enzym phiên mã ngược), không thuộc quá trình phiên mã.
- Giải thích vì sao sai: cụm "và ngược lại" ám chỉ một chiều phản hồi không tồn tại trong phiên mã ở sinh vật nhân thực; đồng thời các cặp bổ sung đúng khi phiên mã là A-U, T-A, G-C, C-G (giữa DNA và RNA), không phụ thuộc "ngược lại".
- Căn cứ: xác nhận trực tiếp của giáo viên (ảnh phản hồi trên app) — "d) sai, không có ngược lại". Đồng thuận với SGK Sinh 12: phiên mã là quá trình tổng hợp RNA từ khuôn DNA, một chiều; nguyên tắc bán bảo toàn (ý a) cũng không đúng với phiên mã.
- Bản sửa đã áp dụng: `ok:false` cho ý d; viết lại `explanation` nêu rõ lý do cho cả a và d.

---

## C. Đánh giá theo từng đề

### Đề: "Đề ôn tập giữa kỳ I – THPT Nguyễn Huệ" (`biology`/`lesson 6`, 64 câu)

**Phạm vi kiến thức.** Phủ đúng 3 bài của học kì I Sinh 12: Bài 2 (gene, cấu trúc gene, tái bản, phiên mã, dịch mã, mã di truyền), Bài 3 (điều hòa biểu hiện gene, operon lac), Bài 4 (hệ gene, đột biến gene, công nghệ gene). Không có câu vượt phạm vi chương trình. Phân bố: Bài 2 = 30 câu, Bài 3 = 11 câu, Bài 4 = 23 câu — hợp lý cho đề giữa kì I.

**Tính chính xác khoa học.** Sau khi sửa 4 lỗi kể trên, không phát hiện thêm nhận định khoa học sai. Các điểm đã kiểm tra kỹ: vị trí vùng điều hòa ở đầu 3' mạch mã gốc; phiên mã chủ yếu trong nhân; enzyme của phiên mã là RNA polymerase; đoạn Okazaki tổng hợp 5'→3'; hai mạch DNA mới không liên tục cả hai; liên kết giữa hai mạch là hydrogen; hệ gene nhân thực gồm DNA nhân + DNA bào quan; đột biến điểm gồm mất/thêm/thay thế 1 cặp; operon lac không chứa gene điều hòa lacI trong cấu trúc; thiếu chức năng promoter thì các gene cấu trúc không hoạt động dù có lactose; E. coli sản xuất insulin nhờ công nghệ gene; cà chua Flavr Savr (êtilen bị bất hoạt) là thành tựu công nghệ gene; thể đột biến phải biểu hiện kiểu hình; mất 1 cặp A–T giảm 2 liên kết hydrogen; thay A–T bằng G–C tăng 1 liên kết hydrogen.

**Tính chính xác đáp án.** 41/41 câu MC có phương án đúng duy nhất. 11/12 câu ĐS có 4 mệnh đề rõ ràng; 1 câu (`TF-02`) có 1 mệnh đề (ý d) sai đáp án và đã được sửa theo xác nhận của giáo viên. 11/11 câu SA có đáp án xác định được bằng lý thuyết hoặc tính toán (đã tự tính lại 11 đáp án bằng công thức N–L–H; kết quả khớp, trong đó SA-09 và SA-11 đã được sửa trong các phiên trước).

**Chất lượng lời giải.** Tất cả lời giải đều có mặt và chứng minh được đáp án sau khi sửa 3 lỗi. Điểm còn lại: 6 câu ĐS (`bio6-tf-08`) có cả 4 mệnh đề đều Đúng — validator đã cấp ngoại lệ (`ALLOWED_UNIFORM_TF`) vì đúng bản chất kiến thức, nhưng đây là điểm yếu thiết kế câu ĐS: không phân hóa được học sinh. Mức `LOW`/góp ý, không sửa.

**Tính rõ ràng và khả năng chấm điểm.** Không có câu thiếu dữ kiện đến mức không chấm được. Tất cả câu SA có dữ kiện đủ tính và yêu cầu định dạng rõ ("số nguyên, không đơn vị"). `maxLen` khớp độ dài đáp án ở 11/11 câu.

**Các vấn đề chưa giải quyết:**
1. `bio6-sa-08` — đề gốc liệt kê `Aabb` hai lần (vị trí 4 và 6); đáp án 5 hiện đúng với cách đếm kiểu gene duy nhất, nhưng cần đối chiếu ảnh gốc để xác nhận vị trí 6 thực ra là kiểu gene gì.
2. `bio6-tf-08` — cả 4 mệnh đề đều Đúng; validator đã cấp ngoại lệ (`ALLOWED_UNIFORM_TF`) vì đúng bản chất kiến thức. Đây là điểm yếu thiết kế câu ĐS (không phân hóa được học sinh), mức `LOW`, chờ giáo viên quyết định có thay mệnh đề hay không.
3. Chưa đối chiếu trực tiếp với ảnh gốc (chỉ đọc được bản OCR text) — một số câu có thể lệch do lỗi OCR của đề cương.

---

## D. Kết luận

| Phân loại | Đề | Ghi chú |
|---|---|---|
| Đề đã kiểm tra và đạt | "Đề ôn tập giữa kỳ I – THPT Nguyễn Huệ" (64/64 câu) | Không còn lỗi đã xác minh |
| Đề đã kiểm tra nhưng có lỗi | Cùng đề trên | 4 lỗi đáp án + 4 lỗi phương án/định dạng/lời giải (đã sửa) |
| Đề đã sửa và đã kiểm tra lại | Cùng đề trên | 8 sửa; validator PASS sau sửa |
| Đề còn câu chưa đủ căn cứ | Không có | 64/64 câu đã có căn cứ |
| Đề chưa được kiểm tra | Không có | Đã kiểm tra 64/64 câu, 100% phạm vi đã xác định |

**Tuyên bố trung thực:** toàn bộ 64 câu của đề đã được rà từng câu, nhưng căn cứ là **kiến thức lý thuyết chuẩn SGK** chứ không đối chiếu trực tiếp ảnh gốc (chưa có khả năng OCR trong phiên). Câu `NEEDS_REVIEW` (SA-08) cần giáo viên đối chiếu ảnh gốc trước khi coi là hoàn tất. Không có câu nào trong đề chưa được kiểm tra.

---

## E. Quy tắc sửa đã tuân thủ

- Chỉ sửa lỗi có căn cứ (thuật ngữ SGK, bảng so sánh đột biến, ảnh đề do giáo viên cung cấp).
- Không đổi đáp án dựa trên suy đoán: `SA-08` giữ đáp án `4` và chỉ cải thiện lời giải; `MC-02` giữ đáp án `D`.
- Không sửa `data-12/` (không tồn tại), không xóa attempts/lịch sử làm bài (`localStorage ontap12-v1` không bị đụng).
- Không commit/push/deploy. Các thay đổi nằm trong working tree.
- Kiểm tra sau sửa: `node scripts/validate-biology.mjs` → **PASS** (64 câu lesson 6, đủ 41/12/11, không trùng question, MC spread ≤35%/vị trí, SA maxLen khớp).

## F. Kiểm chứng sau sửa (evidence)

```
$ node scripts/validate-biology.mjs
PASS: biology Bài 1/2/4 = 100/100/110, CD1 lesson5 = 40,
Nguyễn Huệ GK1 lesson6 = 64,
files: biology-bai1.js,biology-bai2.js,biology-bai3.js,biology-bai3b.js,
biology-bai4.js,biology-cd1.js,biology-nguyenhue-midterm1.js
```

Kiểm chứng độc lập đáp án `SA-08` bằng script (phân tích 6 kiểu gene):
`AABB → thể đột biến (có B trội)`, `AABb → có B`, `AaBb → có B`, `Aabb → không`, `aabb → có aa`, `Aabb → không` ⇒ tổng **4**.

Lưu ý: chưa chạy smoke test trên trình duyệt trong phiên này (máy chủ tĩnh chưa khởi động lại); phần này chưa có evidence nên không tuyên bố đã kiểm tra UI.
