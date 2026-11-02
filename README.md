# ☕ BrewLite - Nền tảng Đặt đồ uống & Quản trị Quầy Barista (F&B)

> **Dự án Môn học Công nghệ Phần mềm (SWE)**  
> Kiến trúc **Monorepo** với Frontend (Next.js 15) và Backend (NestJS 12 Layered Architecture), kết nối Cơ sở dữ liệu PostgreSQL qua Prisma ORM.

---

## 📌 Mục lục
- [1. Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
- [2. Hướng dẫn cài đặt & Khởi chạy (Dành cho người mới clone)](#2-hướng-dẫn-cài-đặt--khởi-chạy)
  - [Bước 1: Cài đặt thư viện (Dependencies)](#bước-1-cài-đặt-thư-viện)
  - [Bước 2: Cấu hình biến môi trường (.env)](#bước-2-cấu-hình-biến-môi-trường-env)
  - [Bước 3: Khởi tạo CSDL & Nạp dữ liệu mẫu (Seed Data)](#bước-3-khởi-tạo-csdl--nạp-dữ-liệu-mẫu)
  - [Bước 4: Khởi động hệ thống](#bước-4-khởi-động-hệ-thống)
- [3. Danh sách tài khoản thử nghiệm (Demo Accounts)](#3-danh-sách-tài-khoản-thử-nghiệm)
- [4. Danh sách mã khuyến mãi dùng thử](#4-danh-sách-mã-khuyến-mãi)
- [5. Kịch bản Demo trải nghiệm đầy đủ luồng nghiệp vụ](#5-kịch-bản-demo-nghiệp-vụ)
- [6. Tài liệu API (Swagger) & Kiểm thử tự động (Unit Tests)](#6-api-swagger--kiểm-thử-tự-động)

---

## 1. Yêu cầu hệ thống

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt:
* **Node.js**: Phiên bản `>= 18.x` hoặc `>= 20.x`
* **NPM**: Đi kèm với Node.js
* **PostgreSQL**: Đang chạy ở cổng mặc định `5432` (Cài trực tiếp hoặc qua Docker).

---

## 2. Hướng dẫn cài đặt & Khởi chạy

### Bước 1: Cài đặt thư viện

Mở terminal tại thư mục gốc của dự án (`BrewLite/`):

```bash
# 1. Cài đặt thư viện cho Backend
cd backend
npm install
npx prisma migrate dev
npx prisma db seed 
npm run start:dev
```
* Backend khởi động tại: **`http://localhost:3001`**
* Tài liệu Swagger API tại: **`http://localhost:3001/swagger`**

#### Terminal 2: Chạy Frontend (Next.js)
```bash
cd frontend
npm run dev
```
* Frontend khởi động tại: **`http://localhost:3000`**

---

## 3. Danh sách tài khoản thử nghiệm

Hệ thống đã nạp sẵn 3 tài khoản mẫu đã mã hóa mật khẩu bcrypt:

| Vai trò | Email đăng nhập | Mật khẩu mặc định | Ghi chú |
| :--- | :--- | :---: | :--- |
| **Pha chế (Barista)** | `barista@brewlite.vn` | `123456` | Có quyền vào màn hình **Barista Board** để cập nhật trạng thái đơn (Kanban). |
| **Khách hàng 1** | `user1@brewlite.vn` | `123456` | Khách hàng thân thiết (Có sẵn 100 điểm thưởng). |
| **Khách hàng 2** | `user2@brewlite.vn` | `123456` | Khách hàng mới (Có sẵn 50 điểm thưởng). |

---

## 4. Danh sách mã khuyến mãi dùng thử

Tại màn hình thanh toán, bạn có thể nhập các mã voucher sau vào ô khuyến mãi:

* **`BREW10`**: Giảm 10% tổng giá trị đơn hàng (đơn tối thiểu 50.000đ).
* **`CHAOBAN`**: Giảm trực tiếp 20.000đ (đơn tối thiểu 40.000đ).
* **`FREESHIP`**: Hỗ trợ 15.000đ phí giao hàng (đơn tối thiểu 60.000đ).
* **`VIP20`**: Giảm 20% tổng đơn cho thành viên VIP (đơn tối thiểu 100.000đ).

---
