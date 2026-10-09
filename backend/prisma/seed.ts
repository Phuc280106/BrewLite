import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Đang làm mới dữ liệu đồ uống...');

  // Xóa dữ liệu cũ để tránh trùng lặp
  await prisma.product.deleteMany();

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

  for (const p of products) {
    await prisma.product.create({ data: p });
  }

  console.log('Đã nạp thành công 6 món nước kèm mô tả và danh mục!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });