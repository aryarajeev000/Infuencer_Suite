// appmetrica.controller.ts (Corrected)
import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { AppmetricaService } from './appmetrica.service';

@Controller('appmetrica')
export class AppmetricaController {
  constructor(private readonly appmetricaService: AppmetricaService) {}

  // You should extract the influencerId from an authenticated user's token/session.
  // Example path: GET /appmetrica/stats/507f1f77bcf86cd799439011 (using Mongoose ID)
  @Get('stats/:influencerId')
  // @UseGuards(JwtAuthGuard) // <--- Add your JWT or Session guard here
  async getStats(@Param('influencerId') influencerId: string) { 
      // NestJS will automatically handle the NotFoundException thrown by the service,
      // translating it into a 404 HTTP response.
      return this.appmetricaService.getInfluencerStats(influencerId);
  }
}