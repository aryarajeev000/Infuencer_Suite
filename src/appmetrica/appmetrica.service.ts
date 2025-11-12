import { Injectable, InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { Influencer } from './influencer.schema';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class AppmetricaService {
  private readonly logger = new Logger(AppmetricaService.name);

  // --- Configuration (Assumed from env) ---
  private readonly BASE_URL = 'https://api.appmetrica.yandex.ru/stat/v1/data';
  private readonly APP_ID = process.env.APPMETRICA_APP_ID;
  private readonly OAUTH_TOKEN = process.env.APP_METRICA_AUTH_TOKEN; 
  private readonly MASTER_TRACKER_ID = process.env.APPMETRICA_MASTER_TRACKER_ID; 
  private readonly TRACKING_BASE_URL = 'https://redirect.appmetrica.yandex.com/serve/'; 

  constructor(
    @InjectModel(Influencer.name) private influencerModel: Model<Influencer & Document>,
    private readonly httpService: HttpService, 
  ) {
    if (!this.OAUTH_TOKEN || !this.APP_ID || !this.MASTER_TRACKER_ID) {
      this.logger.error("CRITICAL CONFIG ERROR: APPMETRICA_APP_ID, OAUTH_TOKEN, or MASTER_TRACKER_ID is missing!");
    }
  }

  /**
   * Fetches install count from AppMetrica using the influencer ID as an ad identifier.
  
   * @param influencerMongoId The MongoDB _id of the influencer, used as the unique ad value.
   */
  async getInstallsByAd(influencerMongoId: string): Promise<number> {
    if (!this.OAUTH_TOKEN || !this.APP_ID || !this.MASTER_TRACKER_ID) {
      return 0;
    }

    try {
      const request$ = this.httpService.get(this.BASE_URL, {
        headers: { 
          Authorization: `OAuth ${this.OAUTH_TOKEN}`,
        },
        params: {
          ids: this.APP_ID,                 // ✅ Must be plural "ids"
          metrics: 'ym:i:installDevices',   // ✅ Valid metric
          dimensions: 'ym:i:publisher',            // ✅ Valid dimension
          filters: `ym:i:ad_content=='${influencerMongoId}'`, // ✅ Valid filter
          date_since: '2024-01-01',
          date_until: 'today',
          limit: 1,
          lang: 'en',
        },
      });

      const res = await lastValueFrom(request$);
      const installs = res.data.data?.[0]?.metrics?.[0] || 0;
      return Number(installs);

    } catch (err: any) {
      this.logger.error(
        `AppMetrica API call failed for ad=${influencerMongoId}:`,
        err.response?.data || err.message
      );
      return 0;
    }
  }

  /**
   * Fetch stats, calculate earnings, and update influencer document.
   * @param influencerId The MongoDB _id of the influencer.
   */
  async getInfluencerStats(influencerId: string) {
    try {
      // 1. Find influencer
      const influencer = await this.influencerModel.findById(influencerId).exec();
      if (!influencer) {
        throw new NotFoundException(`Influencer with ID ${influencerId} not found.`);
      }

      // 2. Fetch install count
      const installs = await this.getInstallsByAd(String(influencer._id));

      // 3. Calculate earnings ($1 for every 20 installs)
      const eligibleGroups = Math.floor(installs / 20);
      const earnings = eligibleGroups * 1;

      // 4. Generate referral link
      const referralLink = `${this.TRACKING_BASE_URL}${this.MASTER_TRACKER_ID}?ad=${String(influencer._id)}`;

      // 5. Update influencer document
      influencer.installs = installs;
      influencer.earnings = earnings;
      await influencer.save();

      // 6. Return data
      return {
        name: influencer.name,
        installs,
        earnings: earnings.toFixed(2),
        referralLink,
      };

    } catch (e: any) {
      if (e instanceof NotFoundException) {
        throw e;
      }
      this.logger.error('CRITICAL SERVICE EXECUTION FAILURE:', e.message, e.stack);
      throw new InternalServerErrorException("Error processing influencer statistics. Check server logs for details.");
    }
  }
}
