// appmetrica.service.ts
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { Influencer } from './influencer.schema';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class AppmetricaService {
  private readonly logger = new Logger(AppmetricaService.name);

  private readonly ACQ_URL =
    'https://api.appmetrica.yandex.com/v2/user/acquisition';
  private readonly LOGS_URL =
    'https://api.appmetrica.yandex.com/logs/v1/export/events.json';

  private readonly APP_ID = process.env.APPMETRICA_APP_ID;
  private readonly PUBLISHER = process.env.APPMETRICA_PUBLISHER;
  private readonly CAMPAIGN = process.env.APPMETRICA_CAMPAIGN;
  private readonly INSTALL_TYPE = process.env.APPMETRICA_INSTALL_TYPE;
  private readonly OAUTH_TOKEN = process.env.APP_METRICA_AUTH_TOKEN;
  private readonly MASTER_TRACKER_ID =
    process.env.APPMETRICA_MASTER_TRACKER_ID;

  constructor(
    @InjectModel(Influencer.name)
    private influencerModel: Model<Influencer & Document>,
    private readonly httpService: HttpService,
  ) {}

  // -----------------------------
  // 1️⃣ CLICKS + INSTALLS
  // -----------------------------
  async getAcquisitionStats(influencerMongoId: string) {
    this.logger.log(
      `🔎 Fetching acquisition stats for Influencer: ${influencerMongoId}`,
    );

    try {
      const params = {
        ids: this.APP_ID,
        id: this.APP_ID,
        date1: '2024-01-01',
        date2: 'today',
        group: 'Day',
        metrics:
          'impressions,clicks,devices,deeplinks,conversion,sessions',
        dimensions: "urlParameter{'ad_content'}",
        limit: 10000,
        accuracy: 'medium',
        include_undefined: true,
        currency: 'RUB',
        sort: '-devices',
        source: 'installation',
        filters: `
            (publisher=='${this.PUBLISHER}' 
            AND campaign=='${this.CAMPAIGN}' 
            AND installType=='${this.INSTALL_TYPE}')
        `,
      };

      const res = await lastValueFrom(
        this.httpService.get(this.ACQ_URL, {
          headers: { Authorization: `OAuth ${this.OAUTH_TOKEN}` },
          params,
        }),
      );

      const rows = res.data?.data || [];
      this.logger.log(`📌 ACQ RAW ROW COUNT = ${rows.length}`);
      this.logger.log(`📌 ACQ RAW DATA:\n${JSON.stringify(rows, null, 2)}`);

      const match = rows.find(
        (r: any) =>
          String(r.dimensions?.[0]?.value) === influencerMongoId ||
          String(r.dimensions?.[0]?.name) === influencerMongoId,
      );

      if (!match) {
        this.logger.warn(
          `⚠ No acquisition row found for influencer ${influencerMongoId}`,
        );
        return { clicks: 0, installs: 0 };
      }

      const clicks = match.metrics?.[1] ?? 0;
      const installs = match.metrics?.[2] ?? 0;

      this.logger.log(
        `✔ MATCH FOUND: clicks=${clicks}, installs=${installs}`,
      );

      return { clicks, installs };
    } catch (err) {
      this.logger.error(
        '❌ Acquisition API error',
        err.response?.data || err.message,
      );
      return { clicks: 0, installs: 0 };
    }
  }

  // -----------------------------
  // 2️⃣ REGISTRATIONS (EVENTS.LOG)
  // -----------------------------
  async getRegistrationEvents(influencerMongoId: string) {
    this.logger.log(
      `🔎 Fetching REGISTRATION events for Influencer: ${influencerMongoId}`,
    );

    try {
      const params = {
        application_id: this.APP_ID,
        date_since: '2024-01-01',
        date_until: '2030-12-31',
        fields: 'event_name,event_json',
        limit: 10000,
      };

      const res = await lastValueFrom(
        this.httpService.get(this.LOGS_URL, {
          headers: {
            Authorization: `OAuth ${this.OAUTH_TOKEN}`,
            Accept: 'application/json',
          },
          params,
        }),
      );

      const events = res.data?.data || [];
      this.logger.log(`📌 EVENTS RAW COUNT = ${events.length}`);

      let count = 0;

      for (const ev of events) {
        if (ev.event_name !== 'register') continue;

        this.logger.log(`📍 EVENT FOUND: ${JSON.stringify(ev)}`);

        let params = ev.event_json;
        if (typeof params === 'string') {
          try {
            params = JSON.parse(params);
          } catch {
            this.logger.warn(`⚠ Invalid event_json format`);
            continue;
          }
        }

        const adContent =
          params?.ad_content ??
          params?.params?.ad_content ??
          null;

        this.logger.log(
          `➡ Checking event ad_content=${adContent} against ${influencerMongoId}`,
        );

        if (String(adContent) === influencerMongoId) {
          count++;
          this.logger.log(`✔ MATCHED REGISTER EVENT! Count = ${count}`);
        }
      }

      this.logger.log(
        `✔ FINAL REGISTRATION COUNT FOR ${influencerMongoId}: ${count}`,
      );

      return count;
    } catch (e) {
      this.logger.error(
        '❌ Registration API error',
        e.response?.data || e.message,
      );
      return 0;
    }
  }

  private buildReferralLink(influencerId: string): string {
    const link = `https://${this.APP_ID}.redirect.appmetrica.yandex.com/?appmetrica_tracking_id=${this.MASTER_TRACKER_ID}&ad_content=${influencerId}`;
    this.logger.log(`🔗 Generated referral link: ${link}`);
    return link;
  }

  // -----------------------------
  // 3️⃣ MERGE + SAVE + RETURN
  // -----------------------------
  async getInfluencerStats(influencerId: string) {
    this.logger.log(`🚀 GENERATING STATS FOR: ${influencerId}`);

    const influencer = await this.influencerModel.findById(influencerId);
    if (!influencer) throw new NotFoundException('Influencer not found');

    const { clicks, installs } = await this.getAcquisitionStats(
      String(influencer._id),
    );

    const registrations = await this.getRegistrationEvents(
      String(influencer._id),
    );

    this.logger.log(
      `📊 MERGED STATS: clicks=${clicks}, installs=${installs}, registrations=${registrations}`,
    );

    const eligibleGroups = Math.floor(installs / 20);
    const earnings = eligibleGroups * 1;

    const referralLink = this.buildReferralLink(
      String(influencer._id),
    );

    this.logger.log(`💰 EARNINGS CALCULATED: ${earnings}`);

    influencer.installs = installs;
    influencer.earnings = earnings;
    influencer.registrations = registrations;
    await influencer.save();

    this.logger.log(`💾 DATABASE UPDATED FOR: ${influencerId}`);

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
