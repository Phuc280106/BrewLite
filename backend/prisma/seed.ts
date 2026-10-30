import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Đang kiểm tra và cập nhật dữ liệu...');

  // Seed Products
  const products = [
    {
      name: 'Cà phê sữa đá',
      description: 'Đậm đà cà phê Robusta phối sữa đặc béo ngọt truyền thống',
      category: 'Coffee',
      price: 25000,
      imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500',
      stock: 100,
    },
    {
      name: 'Americano Đá',
      description: 'Vị cà phê thanh nhẹ, thơm dịu, sảng khoái cho ngày mới',
      category: 'Coffee',
      price: 30000,
      imageUrl: 'https://images.unsplash.com/photo-1551030173-122aabc4489c?w=500',
      stock: 50,
    },
    {
      name: 'Bạc xỉu',
      description: 'Hòa quyện sữa tươi, sữa đặc và một chút hương cà phê',
      category: 'Coffee',
      price: 29000,
      imageUrl: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500',
      stock: 80,
    },
    {
      name: 'Trà đào cam sả',
      description: 'Trà thanh mát kết hợp miếng đào giòn ngọt và hương sả thơm lừng',
      category: 'Tea & Fruit',
      price: 40000,
      imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500',
      stock: 60,
    },
    {
      name: 'Matcha đá xay',
      description: 'Matcha Nhật Bản xay tuyết sánh mịn phủ lớp kem whipping béo ngậy',
      category: 'Blended Ice',
      price: 45000,
      imageUrl: 'https://images.unsplash.com/photo-1570696587429-19ec024c6e6e?w=500',
      stock: 40,
    },
    {
      name: 'Cappuccino Nóng',
      description: 'Cà phê Espresso chuẩn Ý với lớp bọt sữa bông mịn nghệ thuật',
      category: 'Coffee',
      price: 35000,
      imageUrl: 'https://images.unsplash.com/photo-1534687941688-6c9fa1265842?w=500',
      stock: 30,
    },
  ];

  const existingProductsCount = await prisma.product.count();
  if (existingProductsCount === 0) {
    for (const p of products) {
      await prisma.product.create({ data: p });
    }
    console.log('Đã nạp thành công 6 món nước!');
  } else {
    console.log(`Đã có sẵn ${existingProductsCount} sản phẩm, bỏ qua tạo mới.`);
  }

  // Seed Promotions (Task 10 - Option 2: Lưu khuyến mãi trong Database)
  await prisma.promotion.deleteMany();
  const promotions = [
    {
      code: 'BREW10',
      description: 'Giảm 10% tổng đơn hàng (đơn tối thiểu 50.000đ)',
      discountPercent: 10,
      discountAmount: null,
      minOrder: 50000,
      isActive: true,
    },
    {
      code: 'CHAOBAN',
      description: 'Giảm ngay 20.000đ cho đơn từ 40.000đ',
      discountPercent: null,
      discountAmount: 20000,
      minOrder: 40000,
      isActive: true,
    },
    {
      code: 'FREESHIP',
      description: 'Hỗ trợ 15.000đ phí giao hàng cho đơn từ 60.000đ',
      discountPercent: null,
      discountAmount: 15000,
      minOrder: 60000,
      isActive: true,
    },
    {
      code: 'VIP20',
      description: 'Ưu đãi thành viên VIP: Giảm 20% cho đơn từ 100.000đ',
      discountPercent: 20,
      discountAmount: null,
      minOrder: 100000,
      isActive: true,
    },
  ];

  for (const promo of promotions) {
    await prisma.promotion.create({ data: promo });
  }

  console.log('Đã nạp thành công các mã khuyến mãi mẫu vào Database!');

  // Seed 3 Users: 2 Customers và 1 Barista
  const defaultPassword = '123456';
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);

  const users = [
    {
      email: 'user1@brewlite.vn',
      name: 'Nguyễn Văn An (User 1)',
      role: 'CUSTOMER',
      loyaltyPoints: 100,
      passwordHash,
    },
    {
      email: 'user2@brewlite.vn',
      name: 'Trần Thị Bình (User 2)',
      role: 'CUSTOMER',
      loyaltyPoints: 50,
      passwordHash,
    },
    {
      email: 'barista@brewlite.vn',
      name: 'Lê Pha Chế (Barista)',
      role: 'BARISTA',
      loyaltyPoints: 0,
      passwordHash,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        loyaltyPoints: u.loyaltyPoints,
        passwordHash: u.passwordHash,
      },
      create: u,
    });
  }

  console.log('Đã nạp thành công 3 tài khoản (2 user và 1 barista):');
  users.forEach((u) => {
    console.log(`- [${u.role}] ${u.email} | Mật khẩu: ${defaultPassword} | Tên: ${u.name}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
