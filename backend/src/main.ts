import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

try {
  process.loadEnvFile?.('.env');
} catch {
  // Bỏ qua nếu file .env không tồn tại
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  // Bật CORS cho Frontend gọi không bị lỗi
  app.enableCors();

  // Cấu hình Swagger
  const config = new DocumentBuilder()
    .setTitle('BrewLite API')
    .setDescription('Tài liệu API cho dự án BrewLite')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document); // Đường dẫn vào Swagger là /api

  // Đổi cổng Backend sang 3001 và cho phép các thiết bị trong mạng LAN (điện thoại) kết nối
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
void bootstrap();