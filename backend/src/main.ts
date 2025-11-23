import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { BodyParserExceptionFilter } from './common/filters/body-parser-exception.filter';
import * as os from 'os';
import { createBanner } from 'src/pretty-startup-banner';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use Pino Logger
  app.useLogger(app.get(Logger));

  // Global exception filter for body parser errors (handles "null" string body)
  app.useGlobalFilters(new BodyParserExceptionFilter());

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [];

  // Enable CORS
  app.enableCors({
    origin: (origin, callback) => {
      // Jika request dari server (no origin), izinkan
      if (!origin) return callback(null, true);

      // Cek apakah origin termasuk yang diizinkan
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Jika tidak ada di list, tolak
      return callback(new Error(`CORS blocked for: ${origin}`));
    },
    credentials: true,
  });

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      skipMissingProperties: false,
      exceptionFactory: (errors) => {
        // Custom error messages
        return new BadRequestException(errors);
      },
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Agentic AI API')
    .setDescription('API documentation for Agentic AI Backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');


  function getLocalIp() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]!) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
    return 'localhost';
  }

  const domain = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://${getLocalIp()}:${port}`;

  // Beautiful startup banner
  const logger = app.get(Logger);
  // BOX WIDTH (inside area, no borders)
  const BOX_WIDTH = 59;

  // Format helper
  function line(text = "") {
    const padding = BOX_WIDTH - text.length;
    return `║ ${text}${" ".repeat(padding - 1)}║`;
  }

  const env = process.env.NODE_ENV || "development";
  const apiUrl = `${domain}/api`;

  // Generate banner
  const banner = createBanner("Agentic AI Backend - RUNNING", [
    { label: "🌐 Server", value: domain },
    { label: "📚 API Docs", value: `${domain}/api` },
    { label: "🔧 Environment", value: process.env.NODE_ENV || "development" },
    { raw: "" },
    { raw: "🔥 Ready to rock & roll!" },
  ]);
  logger.log(banner, "Bootstrap");

}
bootstrap();
