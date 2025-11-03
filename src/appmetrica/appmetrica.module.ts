// appmetrica.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppmetricaService } from './appmetrica.service';
import { AppmetricaController } from './appmetrica.controller';
import { Influencer, InfluencerSchema } from './influencer.schema';
import { HttpModule } from '@nestjs/axios'; // <-- NEW IMPORT

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Influencer.name, schema: InfluencerSchema }]),
    HttpModule, // <-- CRITICAL: Must be imported to use HttpService
  ],
  controllers: [AppmetricaController],
  providers: [AppmetricaService],
})
export class AppmetricaModule {}