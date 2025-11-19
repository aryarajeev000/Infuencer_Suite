import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';

import { Influencer } from '../schemas/influencer.schema';
import { AppmetricaAcqService } from './appmetrica.acq.service';
import { AppmetricaEventsService } from './appmetrica.events.service';

@Injectable()
export class AppmetricaMergeService {
  private readonly logger = new Logger(AppmetricaMergeService.name);

  private readonly APP_ID = process.env.APPMETRICA_APP_ID;
  private readonly MASTER_TRACKER_ID =
    process.env.APPMETRICA_MASTER_TRACKER_ID;

  constructor(
    @InjectModel(Influencer.name)
    private influencerModel: Model<Influencer & Document>,

    private readonly acqService: AppmetricaAcqService,
    private readonly eventsService: AppmetricaEventsService,
  ) {}

  private buildReferralLink(id: string): string {
    const link = `https://${this.APP_ID}.redirect.appmetrica.yandex.com/?appmetrica_tracking_id=${this.MASTER_TRACKER_ID}&ad_content=${id}`;
    this.logger.log(`🔗 Generated referral link: ${link}`);
    return link;
  }

  async getStats(influencerId: string) {
    this.logger.log(`🚀 GENERATING STATS FOR: ${influencerId}`);

    const influencer = await this.influencerModel.findById(influencerId);
    if (!influencer) throw new NotFoundException('Influencer not found');

    const { clicks, installs } = await this.acqService.getClicksAndInstalls(
      influencerId,
    );

    const registrations =
      await this.eventsService.getRegistrationEvents(influencerId);

    this.logger.log(
      `📊 MERGED STATS: clicks=${clicks}, installs=${installs}, registrations=${registrations}`,
    );

    const earnings = Math.floor(installs / 20);

    influencer.clicks = clicks;
    influencer.installs = installs;
    influencer.registrations = registrations;
    influencer.earnings = earnings;

    await influencer.save();

    const referralLink = this.buildReferralLink(influencerId);

    this.logger.log(`💾 UPDATED DB FOR: ${influencerId}`);

    return {
      name: influencer.name,
      clicks,
      installs,
      registrations,
      earnings: earnings.toFixed(2),
      referralLink,
    };
  }
}
