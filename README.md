# RD Project Manager

Ứng dụng web quản lý toàn bộ quy trình R&D sản phẩm — từ ý tưởng, phát triển công thức, làm việc với nhà máy, đến sản xuất và ra mắt thị trường.

---

## Cài đặt nhanh (Docker)

### Yêu cầu
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) đã cài và đang chạy

### Các bước

**1. Giải nén và vào thư mục dự án**
```bash
unzip rd-project-manager-release-*.zip -d rd-project-manager
cd rd-project-manager
```

**2. Tạo file cấu hình**
```bash
cp .env.example .env
```

Mở file `.env` và điền:
```
ANTHROPIC_API_KEY=sk-ant-...   # Lấy tại https://console.anthropic.com/
JWT_SECRET=chuoi-bi-mat-bat-ky-it-nhat-32-ky-tu
```

**3. Khởi động**
```bash
docker compose up -d --build
```
Lần đầu mất 3–5 phút để build. Các lần sau chỉ mất vài giây.

**4. Truy cập**

Mở trình duyệt: **http://localhost**

Tài khoản mặc định:
- Email: `admin@rd.local`
- Mật khẩu: `admin123`

> ⚠️ **Đổi mật khẩu ngay** sau khi đăng nhập lần đầu tại Cài đặt → Tài khoản.

---

## Dừng / Khởi động lại

```bash
docker compose stop          # Dừng (giữ nguyên data)
docker compose start         # Khởi động lại
docker compose down          # Dừng và xóa container (data vẫn giữ)
docker compose down -v       # Xóa toàn bộ kể cả database ⚠️
```

---

## Tính năng

### Quản lý dự án (Stage-Gate)
Mỗi dự án đi qua **7 giai đoạn**, mỗi giai đoạn có "cổng" phê duyệt trước khi tiến tiếp:

| # | Giai đoạn | Mô tả |
|---|-----------|-------|
| 1 | Ý tưởng & Nghiên cứu | Đánh giá khả thi, nghiên cứu thị trường |
| 2 | Phát triển công thức | Xây dựng và kiểm thử công thức |
| 3 | Hoàn thiện sản phẩm | Tối ưu hóa, thử nghiệm ổn định |
| 4 | Phê duyệt & Đăng ký | Hồ sơ pháp lý, giấy phép |
| 5 | Thiết kế bao bì | Bao bì, nhãn mác |
| 6 | Sản xuất | Đặt hàng, sản xuất thương mại |
| 7 | Ra mắt thị trường | Launch, phân phối |

**Quy tắc mở khoá:**
- Giai đoạn 2–5 mở sau khi Giai đoạn 1 được duyệt
- Giai đoạn 6 (Sản xuất) mở khi **ít nhất 3/4** giai đoạn phát triển được duyệt
- Giai đoạn 7 mở sau khi Giai đoạn 6 được duyệt

### Quản lý công việc
- **Kanban board** — kéo thả công việc giữa Chưa làm / Đang làm / Hoàn thành / Bị chặn
- **Danh sách** — lọc theo trạng thái, người phụ trách, độ ưu tiên
- **Gantt chart** — timeline toàn bộ công việc
- Deadline, giờ dự kiến/thực tế, lý do bị chặn

### Quản lý nhà máy & Hợp tác
- Hồ sơ nhà máy (thông tin, liên hệ, nhóm WeChat)
- **Pipeline engagement** — theo dõi từng mối hợp tác qua 6 giai đoạn:
  Lấy mẫu → Báo giá → Đàm phán → Test mẫu → Đã chốt → Đang sản xuất
- Yêu cầu báo giá (RFQ) và quản lý nhiều phiên bản báo giá
- Đàm phán — lưu lịch sử đàm phán, file đính kèm
- Quản lý mẫu — đánh giá, phê duyệt, ghi chú

### Bảng công thức (Formula)
- Upload file Excel → AI tự động phân tích bảng thành phần
- Hiển thị: Trade Name, INCI Name, Chức năng, AI kiểm chứng, Tỷ lệ hoạt chất, % trong CT cuối, Cảnh báo
- Tính tổng % công thức, cảnh báo nếu vượt 100%

### Báo cáo tổng quan
- Tổng quan toàn bộ danh mục dự án
- Pipeline nhà máy dạng funnel
- Tiến độ hàng tuần theo dự án
- **Chat AI** — hỏi bất kỳ câu hỏi nào về toàn bộ dự án, rủi ro, mẫu, báo giá

### Quản lý người dùng & Phân quyền
- Vai trò: Admin, Manager, Member
- Đăng nhập bằng email/mật khẩu
- Quản lý tài khoản, avatar

### Các tính năng khác
- Quản lý rủi ro (ma trận xác suất × mức độ)
- Nhật ký hoạt động đầy đủ
- Quick search (Ctrl+K / Cmd+K)
- Dark mode
- Tải file đính kèm

---

## Cấu trúc thư mục

```
rd-project-manager/
├── client/src/            # React 18 + Vite + TypeScript (giao diện)
├── server/src/            # Express + SQLite (API backend)
│   ├── db/                # Schema và helpers database
│   └── routes/            # Các API endpoint
├── shared/src/            # TypeScript types dùng chung
├── deploy/
│   └── nginx.conf         # Cấu hình reverse proxy
├── Dockerfile.client      # Build giao diện
├── Dockerfile.server      # Build API server
├── docker-compose.yml     # Orchestration
└── .env.example           # Mẫu cấu hình
```

---

## Backup database

Database lưu trong Docker volume `rd_data`. Để backup:

```bash
# Backup
docker run --rm -v rd-project-manager_rd_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/backup-$(date +%Y%m%d).tar.gz -C /data .

# Restore
docker run --rm -v rd-project-manager_rd_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/backup-YYYYMMDD.tar.gz -C /data
```

---

## Cấu hình ANTHROPIC_API_KEY

Key dùng cho 2 tính năng:
1. **Phân tích bảng thành phần** — upload Excel, AI trích xuất INCI name, chức năng, cảnh báo
2. **Chat AI tổng quan** — hỏi về toàn bộ dự án trong trang Báo cáo

Nếu không có key, 2 tính năng này sẽ báo lỗi, các tính năng còn lại hoạt động bình thường.

---

## Stack công nghệ

| Thành phần | Công nghệ |
|---|---|
| Giao diện | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Express.js, TypeScript |
| Database | SQLite (better-sqlite3) |
| AI | Anthropic Claude API |
| Deploy | Docker, Docker Compose, Nginx |

---

## Xử lý sự cố

**Không vào được http://localhost**
```bash
docker compose ps          # Kiểm tra container đang chạy chưa
docker compose logs server # Xem log server
docker compose logs client # Xem log client
```

**Quên mật khẩu admin**
```bash
docker exec rd_server node -e "
const db=require('better-sqlite3')('/app/data/rd_projects.db');
const {hashPassword}=require('./dist/db/schema');
db.prepare('UPDATE users SET password_hash=? WHERE email=?')
  .run(hashPassword('matkhaumoi123'),'admin@rd.local');
console.log('Đã đặt lại mật khẩu: matkhaumoi123');
"
```

**Cập nhật phiên bản mới**
```bash
# Giải nén bản mới vào cùng thư mục (đè lên code cũ, KHÔNG đè .env)
docker compose up -d --build
```
