import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { SignIn } from '@/components/auth/sign-in';
import Link from 'next/link';

export default async function LoginPage() {
  const session = await auth();

  if (session) {
    return (
      <section className="hero-section" style={{ minHeight: '60vh' }}>
        <div className="wrap">
          <div className="card">
            <h1>Đã đăng nhập</h1>
            <p>Bạn đã đăng nhập với tư cấu tạo này.</p>
            <Link href="/" className="btn btn-primary">
              Về trang chủ
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="hero-section" style={{ minHeight: '60vh' }}>
      <div className="wrap">
        <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
          <h1>Đăng nhập</h1>
          <p>Đăng nhập bằng Google để đồng bộ tiến độ trên mọi thiết bị.</p>

          <Suspense fallback={<p>Đang tải…</p>}>
            <SignIn />
          </Suspense>

          <p className="muted small" style={{ marginTop: 16 }}>
            Chưa có tài khoản? Đăng nhập bằng Google để tạo tự động.
            Không có đăng nhập cũng được — bạn vẫn dùng được toàn bộ ứng
            dụng bằng localStorage, chỉ không đồng bộ giữa các thiết bị.
          </p>

          <Link
            href="/"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 12 }}
          >
            Tiếp tục làm việc offline
          </Link>
        </div>
      </div>
    </section>
  );
}
