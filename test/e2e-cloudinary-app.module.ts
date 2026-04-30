import { Controller, Get, Module } from '@nestjs/common';
import { CloudinaryModule } from '../src/cloudinary/cloudinary.module';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service';

@Controller()
class CloudinaryE2EProbeController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  @Get()
  root(): { ok: boolean } {
    return { ok: true };
  }

  @Get('cloudinary/probe')
  probe(): { injected: boolean } {
    return { injected: this.cloudinary !== undefined };
  }
}

@Module({
  imports: [
    CloudinaryModule.forRoot({
      cloud_name: process.env.E2E_CLOUDINARY_CLOUD_NAME ?? 'e2e_cloud',
      api_key: process.env.E2E_CLOUDINARY_API_KEY ?? 'e2e_key',
      api_secret: process.env.E2E_CLOUDINARY_API_SECRET ?? 'e2e_secret',
    }),
  ],
  controllers: [CloudinaryE2EProbeController],
})
export class E2ECloudinaryAppModule {}
