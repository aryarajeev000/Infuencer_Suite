// appmetrica.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppmetricaService } from './appmetrica.service';
import { AppmetricaController } from './appmetrica.controller';
import { Influencer, InfluencerSchema } from './influencer.schema';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Influencer.name, schema: InfluencerSchema }
    ]),
    HttpModule, // required for HttpService
  ],
  controllers: [AppmetricaController],
  providers: [AppmetricaService],
  exports: [AppmetricaService], // optional but good practice
})
export class AppmetricaModule {}
