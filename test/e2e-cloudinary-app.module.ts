import { Controller, Get, Module } from '@nestjs/common';
import { CloudinaryDeleteBatch } from '../src/cloudinary/cloudinary-delete-batch';
import { CloudinaryModule } from '../src/cloudinary/cloudinary.module';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service';
import type { CloudinaryDeleteBatchSaveResult } from '../src/cloudinary/interface/cloudinary-models.interface';

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

  /** Exercises {@link CloudinaryService.delete} with an empty queue + {@link CloudinaryDeleteBatch.save}. */
  @Get('cloudinary/delete-batch/empty-save')
  async emptyDeleteBatchSave(): Promise<CloudinaryDeleteBatchSaveResult> {
    return this.cloudinary.delete([]).save();
  }

  /**
   * Smoke-test {@link CloudinaryService.delete} returns a batch (no Cloudinary calls until save).
   */
  @Get('cloudinary/delete-batch/fluent-smoke')
  fluentSmoke(): { isBatch: boolean } {
    const pending = this.cloudinary.delete({
      kind: 'one',
      publicId: 'e2e-smoke-id',
    });
    return { isBatch: pending instanceof CloudinaryDeleteBatch };
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
