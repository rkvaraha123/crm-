import { Global, Module } from '@nestjs/common';
import { ProductFeatureService } from './product-feature.service';

@Global()
@Module({
  providers: [ProductFeatureService],
  exports: [ProductFeatureService],
})
export class CommonModule {}
