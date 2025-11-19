import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';

import { AppmetricaController } from '../controllers/appmetrica.controller';

// 3 SERVICES
import { AppmetricaAcqService } from '../services/appmetrica.acq.service';
import { AppmetricaEventsService } from '../services/appmetrica.events.service';
import { AppmetricaMergeService } from '../services/appmetrica.merge.service';

// Schema
import { Influencer, InfluencerSchema} from '../schemas/influencer.schema';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: Influencer.name, schema: InfluencerSchema }
    ]),
  ],

  controllers: [AppmetricaController],

  providers: [
    AppmetricaAcqService,
    AppmetricaEventsService,
    AppmetricaMergeService,
  ],

  exports: [
    AppmetricaAcqService,
    AppmetricaEventsService,
    AppmetricaMergeService,
  ],
})
export class AppmetricaModule {}
