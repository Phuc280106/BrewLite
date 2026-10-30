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
      imageUrl:
        'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500',
      stock: 100,
    },
    {
      name: 'Americano Đá',
      description: 'Vị cà phê thanh nhẹ, thơm dịu, sảng khoái cho ngày mới',
      category: 'Coffee',
      price: 30000,
      imageUrl:
        'https://images.unsplash.com/photo-1551030173-122aabc4489c?w=500',
      stock: 50,
    },
    {
      name: 'Bạc xỉu',
      description: 'Hòa quyện sữa tươi, sữa đặc và một chút hương cà phê',
      category: 'Coffee',
      price: 29000,
      imageUrl:
        'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500',
      stock: 80,
    },
    {
      name: 'Trà đào cam sả',
      description:
        'Trà thanh mát kết hợp miếng đào giòn ngọt và hương sả thơm lừng',
      category: 'Tea & Fruit',
      price: 40000,
      imageUrl:
        'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500',
      stock: 60,
    },
    {
      name: 'Matcha đá xay',
      description:
        'Matcha Nhật Bản xay tuyết sánh mịn phủ lớp kem whipping béo ngậy',
      category: 'Blended Ice',
      price: 45000,
      imageUrl:
        'https://images.unsplash.com/photo-1570696587429-19ec024c6e6e?w=500',
      stock: 40,
    },
    {
      name: 'Cappuccino Nóng',
      description:
        'Cà phê Espresso chuẩn Ý với lớp bọt sữa bông mịn nghệ thuật',
      category: 'Coffee',
      price: 35000,
      imageUrl:
        'https://images.unsplash.com/photo-1534687941688-6c9fa1265842?w=500',
      stock: 30,
    },
  ];
  for (const product of products) {
    const existingProduct = await prisma.product.findFirst({
      where: { name: product.name },
      select: { id: true },
    });
    if (!existingProduct) {
      await prisma.product.create({ data: product });
    }
  }
  const ingredients = [
    { name: 'Cà phê Robusta', unit: 'g', stock: 1000 },
    { name: 'Sữa đặc', unit: 'ml', stock: 5000 },
    { name: 'Sữa tươi', unit: 'ml', stock: 5000 },
    { name: 'Đường', unit: 'g', stock: 2000 },
    { name: 'Trà đen', unit: 'g', stock: 1000 },
    { name: 'Đào ngâm', unit: 'miếng', stock: 100 },
    { name: 'Bột matcha', unit: 'g', stock: 500 },
    { name: 'Nước', unit: 'ml', stock: 10000 },
    { name: 'Đá', unit: 'g', stock: 10000 },
    { name: 'Cam', unit: 'g', stock: 2000 },
    { name: 'Sả', unit: 'g', stock: 1000 },
    { name: 'Kem whipping', unit: 'ml', stock: 2000 },
    { name: 'Ly S', unit: 'cái', stock: 100 },
    { name: 'Ly M', unit: 'cái', stock: 100 },
    { name: 'Ly L', unit: 'cái', stock: 100 },
  ];
  for (const ingredient of ingredients) {
    const existingIngredient = await prisma.ingredient.findFirst({
      where: { name: ingredient.name },
      select: { id: true },
    });
    if (!existingIngredient) {
      await prisma.ingredient.create({ data: ingredient });
    }
  }

  const recipeItems = [
    {
      product: 'Cà phê sữa đá',
      size: 'S',
      ingredients: [
        ['Cà phê Robusta', 20],
        ['Sữa đặc', 30],
        ['Nước', 100],
        ['Đá', 150],
        ['Ly S', 1],
      ],
    },
    {
      product: 'Cà phê sữa đá',
      size: 'M',
      ingredients: [
        ['Cà phê Robusta', 25],
        ['Sữa đặc', 40],
        ['Nước', 120],
        ['Đá', 200],
        ['Ly M', 1],
      ],
    },
    {
      product: 'Cà phê sữa đá',
      size: 'L',
      ingredients: [
        ['Cà phê Robusta', 30],
        ['Sữa đặc', 50],
        ['Nước', 150],
        ['Đá', 250],
        ['Ly L', 1],
      ],
    },
    {
      product: 'Americano Đá',
      size: 'S',
      ingredients: [
        ['Cà phê Robusta', 20],
        ['Nước', 150],
        ['Đá', 150],
        ['Ly S', 1],
      ],
    },
    {
      product: 'Americano Đá',
      size: 'M',
      ingredients: [
        ['Cà phê Robusta', 25],
        ['Nước', 200],
        ['Đá', 200],
        ['Ly M', 1],
      ],
    },
    {
      product: 'Americano Đá',
      size: 'L',
      ingredients: [
        ['Cà phê Robusta', 30],
        ['Nước', 250],
        ['Đá', 250],
        ['Ly L', 1],
      ],
    },
    {
      product: 'Bạc xỉu',
      size: 'S',
      ingredients: [
        ['Cà phê Robusta', 10],
        ['Sữa đặc', 20],
        ['Sữa tươi', 120],
        ['Đá', 150],
        ['Ly S', 1],
      ],
    },
    {
      product: 'Bạc xỉu',
      size: 'M',
      ingredients: [
        ['Cà phê Robusta', 12],
        ['Sữa đặc', 25],
        ['Sữa tươi', 160],
        ['Đá', 200],
        ['Ly M', 1],
      ],
    },
    {
      product: 'Bạc xỉu',
      size: 'L',
      ingredients: [
        ['Cà phê Robusta', 15],
        ['Sữa đặc', 30],
        ['Sữa tươi', 200],
        ['Đá', 250],
        ['Ly L', 1],
      ],
    },
    {
      product: 'Trà đào cam sả',
      size: 'S',
      ingredients: [
        ['Trà đen', 8],
        ['Đào ngâm', 3],
        ['Cam', 30],
        ['Sả', 10],
        ['Nước', 180],
        ['Đá', 150],
        ['Ly S', 1],
      ],
    },
    {
      product: 'Trà đào cam sả',
      size: 'M',
      ingredients: [
        ['Trà đen', 10],
        ['Đào ngâm', 4],
        ['Cam', 40],
        ['Sả', 15],
        ['Nước', 220],
        ['Đá', 200],
        ['Ly M', 1],
      ],
    },
    {
      product: 'Trà đào cam sả',
      size: 'L',
      ingredients: [
        ['Trà đen', 12],
        ['Đào ngâm', 5],
        ['Cam', 50],
        ['Sả', 20],
        ['Nước', 260],
        ['Đá', 250],
        ['Ly L', 1],
      ],
    },
    {
      product: 'Matcha đá xay',
      size: 'S',
      ingredients: [
        ['Bột matcha', 5],
        ['Sữa tươi', 120],
        ['Đường', 20],
        ['Kem whipping', 30],
        ['Đá', 200],
        ['Ly S', 1],
      ],
    },
    {
      product: 'Matcha đá xay',
      size: 'M',
      ingredients: [
        ['Bột matcha', 7],
        ['Sữa tươi', 160],
        ['Đường', 25],
        ['Kem whipping', 40],
        ['Đá', 250],
        ['Ly M', 1],
      ],
    },
    {
      product: 'Matcha đá xay',
      size: 'L',
      ingredients: [
        ['Bột matcha', 9],
        ['Sữa tươi', 200],
        ['Đường', 30],
        ['Kem whipping', 50],
        ['Đá', 300],
        ['Ly L', 1],
      ],
    },
    {
      product: 'Cappuccino Nóng',
      size: 'S',
      ingredients: [
        ['Cà phê Robusta', 18],
        ['Sữa tươi', 120],
        ['Nước', 30],
        ['Ly S', 1],
      ],
    },
    {
      product: 'Cappuccino Nóng',
      size: 'M',
      ingredients: [
        ['Cà phê Robusta', 20],
        ['Sữa tươi', 150],
        ['Nước', 35],
        ['Ly M', 1],
      ],
    },
    {
      product: 'Cappuccino Nóng',
      size: 'L',
      ingredients: [
        ['Cà phê Robusta', 22],
        ['Sữa tươi', 180],
        ['Nước', 40],
        ['Ly L', 1],
      ],
    },
  ] as const;
  const seededProducts = await prisma.product.findMany({
    where: { name: { in: products.map(({ name }) => name) } },
    select: { id: true, name: true },
  });
  const seededIngredients = await prisma.ingredient.findMany({
    where: { name: { in: ingredients.map(({ name }) => name) } },
    select: { id: true, name: true },
  });
  const productIds = new Map(seededProducts.map(({ id, name }) => [name, id]));
  const ingredientIds = new Map(
    seededIngredients.map(({ id, name }) => [name, id]),
  );
  for (const recipe of recipeItems) {
    const productId = productIds.get(recipe.product);
    if (productId === undefined) {
      throw new Error(
        `Không tìm thấy sản phẩm "${recipe.product}" để seed công thức.`,
      );
    }
    for (const [ingredientName, amount] of recipe.ingredients) {
      const ingredientId = ingredientIds.get(ingredientName);
      if (ingredientId === undefined) {
        throw new Error(
          `Không tìm thấy nguyên liệu "${ingredientName}" để seed công thức.`,
        );
      }
      await prisma.recipeItem.upsert({
        where: {
          productId_ingredientId_size: {
            productId,
            ingredientId,
            size: recipe.size,
          },
        },
        update: { amount },
        create: {
          productId,
          ingredientId,
          size: recipe.size,
          amount,
        },
      });
    }
  }
  console.log(`Đã nạp công thức cho ${products.length} món, đủ size S/M/L.`);

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
    console.log(
      `- [${u.role}] ${u.email} | Mật khẩu: ${defaultPassword} | Tên: ${u.name}`,
    );
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
