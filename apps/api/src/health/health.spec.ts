import 'reflect-metadata';
import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { HealthModule } from './health.module';
import { HealthController } from './health.controller';
import { configureApp } from '../common/configure-app';
class InputDto {
  @IsString() name!: string;
}
@Controller('test')
class TestController {
  @Post() create(@Body() input: InputDto) {
    return input;
  }
  @Post('error') fail() {
    throw new Error('private details');
  }
}
describe('API foundation', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [HealthModule],
      controllers: [TestController],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, ['http://localhost:5173']);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('returns the unit health response', () => {
    expect(new HealthController().getHealth()).toEqual({ status: 'ok' });
  });
  it('serves the versioned health route with security headers', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok' })
      .expect('X-Content-Type-Options', 'nosniff');
  });
  it('allows the configured origin', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173')
      .expect('Access-Control-Allow-Origin', 'http://localhost:5173');
  });
  it('does not allow an unlisted origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'https://untrusted.example');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('centralizes missing route errors', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(404);
    expect(response.body).toMatchObject({ statusCode: 404, path: '/health' });
  });
  it('rejects unknown and invalid input', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/test')
      .send({ name: 1, extra: true })
      .expect(400);
  });
  it('accepts valid DTO input', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/test')
      .send({ name: 'test' })
      .expect(201)
      .expect({ name: 'test' });
  });
  it('hides unexpected error details', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/test/error')
      .expect(500);
    expect(response.body.message).toBe('Internal server error');
    expect(JSON.stringify(response.body)).not.toContain('private details');
  });
});
