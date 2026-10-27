import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Foto, logo e capa trafegam como data URL no JSON; o limite padrão de
  // 100kb barraria a capa de 1600×480 com 413.
  app.useBodyParser('json', { limit: '5mb' });

  // Configuração do CORS para o Vite Frontend
  app.enableCors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173'],
    credentials: true,
  });

  // Validação Global de Payloads HTTP
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Documentação Swagger
  const config = new DocumentBuilder()
    .setTitle('Plataforma LEI - API')
    .setDescription('API para conexão entre ONGs e a comunidade acadêmica')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(
    `🚀 API rodando na porta ${port}. Swagger: http://localhost:${port}/api/docs`,
  );
}
void bootstrap();
