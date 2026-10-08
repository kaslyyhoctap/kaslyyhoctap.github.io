/**
 * Site footer — ports `<footer class="footer">` from index.html.
 * Server component: static content only.
 */
export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <p>
          <b>Ôn Tập 12</b> · Ôn Lịch sử &amp; Sinh học 12 (Kết nối tri thức, Bài 1–3) + Hóa
          học 12 (Chương 1–2) + Tiếng Anh 12 Global Success (Unit 1–2) · Chạy offline, không
          cần đăng nhập.
        </p>
        <p className="muted small">
          Nguồn tham khảo: SGK Kết nối tri thức, SGK Global Success, SGKVN, VietJack,
          Loigiaihay, Hoc24, VnDoc — câu hỏi tự biên soạn lại, không sao chép nguyên văn.
          Từ vựng/collocation Tiếng Anh lấy từ data ôn tập do người dùng cung cấp.
        </p>
      </div>
    </footer>
  );
}
