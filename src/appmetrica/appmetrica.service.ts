// appmetrica.service.ts (Corrected)
import { Injectable, InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios'; // <-- NEW: Use NestJS HttpService
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { Influencer } from './influencer.schema';
import { lastValueFrom } from 'rxjs'; // <-- NEW: For resolving HttpService observable

@Injectable()
export class AppmetricaService {
  private readonly logger = new Logger(AppmetricaService.name);

  // --- Configuration (Assume these are properly loaded from env) ---
  private readonly BASE_URL = 'https://api.appmetrica.yandex.ru/stat/v1/data'; // Standard reporting endpoint
  private readonly APP_ID = process.env.APPMETRICA_APP_ID; // CRITICAL: REQUIRED application ID
  private readonly OAUTH_TOKEN = process.env.APP_METRICA_API_KEY; 

  constructor(
    @InjectModel(Influencer.name) private influencerModel: Model<Influencer & Document>,
    private readonly httpService: HttpService, // <-- INJECTED
  ) {
    if (!this.OAUTH_TOKEN || !this.APP_ID) {
        this.logger.error("CRITICAL CONFIG ERROR: APPMETRICA_APP_ID or OAUTH_TOKEN is missing!");
    }
  }

  async getInstallsByTracker(trackerId: string): Promise<number> {
    if (!this.OAUTH_TOKEN || !this.APP_ID) {
        return 0; // Prevent call if config is missing
    }
    
    try {
      // 1. Prepare the observable request
      const request$ = this.httpService.get(this.BASE_URL, {
        headers: { 
          Authorization: `OAuth ${this.OAUTH_TOKEN}`,
        },
        params: {
          id: this.APP_ID, // <-- CRITICAL: Required for reporting API
          metrics: 'ym:i:installs', 
          dimensions: 'ym:i:trackerID', 
          filters: `ym:i:trackerID=='${trackerId}'`, 
          date_since: '2024-01-01', 
          date_until: 'today',      
          limit: 1, // Only fetch one aggregate row
        },
      });

      // 2. Resolve the observable to get the response data
      const res = await lastValueFrom(request$);

      // Safely extract the total installs from the aggregate result
      const installs = res.data.data?.[0]?.metrics?.[0] || 0;
      return Number(installs);

    } catch (err: any) {
      this.logger.error(`AppMetrica API call failed for Tracker ID ${trackerId}:`, err.response?.data || err.message);
      return 0; // Return 0 installs on API failure
    }
  }

  async getInfluencerStats(influencerId: string) {
    try {
      // 1. Mongoose: Find the influencer document
      const influencer = await this.influencerModel.findById(influencerId).exec();
      
      if (!influencer) {
        // Correctly throw NestJS 404 exception
        throw new NotFoundException(`Influencer with ID ${influencerId} not found.`); 
      }

      // 2. AppMetrica: Get install count
      const installs = await this.getInstallsByTracker(influencer.trackerId);
      
      // 3. Calculation: Pay $1 for every completed group of 20
      const eligibleGroups = Math.floor(installs / 20); 
      const earnings = eligibleGroups * 1; 

      // 4. Mongoose: Save the updated stats
      influencer.installs = installs;
      influencer.earnings = earnings;
      await influencer.save();

      // 5. Return success data
      return {
        name: influencer.name,
        installs,
        earnings: earnings.toFixed(2), 
        referralLink: influencer.referralLink,
      };

    } catch (e: any) {
      // Re-throw NestJS exceptions (like NotFoundException)
      if (e instanceof NotFoundException) {
          throw e;
      }
      this.logger.error('CRITICAL SERVICE EXECUTION FAILURE:', e.message, e.stack);
      throw new InternalServerErrorException("Error processing influencer statistics. Check server logs for details.");
    }
  }
}