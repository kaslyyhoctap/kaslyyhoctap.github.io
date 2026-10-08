/**
 * Study guide / "how to learn" section — ports app.js `renderHome()` how-to
 * block (index.html lines 76–84). Static server component.
 */
export default function StudyGuide() {
  return (
    <div className="panel how">
      <h2>Cách học hiệu quả</h2>
      <ol>
        <li>
          <b>Học lý thuyết</b> — đọc tóm tắt trọng tâm từng bài (5–10 phút).
        </li>
        <li>
          <b>Luyện trắc nghiệm</b> — làm đề ngắn, xem giải thích ngay.
        </li>
        <li>
          <b>Kiểm tra</b> — bấm giờ như thi thật, xem điểm và câu sai.
        </li>
      </ol>
      <p className="muted">
        Dữ liệu chạy offline ngay sau khi tải trang. Kết quả lưu trên trình duyệt của bạn (localStorage),
        không cần đăng nhập.
      </p>
    </div>
  );
}
