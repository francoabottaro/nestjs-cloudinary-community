import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { E2ECloudinaryAppModule } from './e2e-cloudinary-app.module';

describe('CloudinaryModule (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [E2ECloudinaryAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET / returns ok', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ ok: true });
      });
  });

  it('GET /cloudinary/probe confirms CloudinaryService is wired', () => {
    return request(app.getHttpServer())
      .get('/cloudinary/probe')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ injected: true });
      });
  });
});
