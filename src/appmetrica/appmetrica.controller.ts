// appmetrica.controller.ts
import { Controller, Get, UseGuards, Request, UnauthorizedException, Injectable, ExecutionContext } from '@nestjs/common';
import { AppmetricaService } from './appmetrica.service';

// --- MOCK AUTH GUARD ---
// CRITICAL: Replace this MockAuthGuard with your production authentication guard (e.g., JwtAuthGuard).
// This mock simulates successful authentication and retrieval of the user ID.
@Injectable()
class MockAuthGuard {
    canActivate(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest();
        // In a real app, JWT decoding would populate req.user
        req.user = { 
            _id: req.headers['x-mock-user-id'] || '6912273ea74a59746533529d', // Securely retrieved ID
            name: 'Authenticated Influencer' 
        };
        return true; 
    }
}

@Controller('appmetrica')
export class AppmetricaController {
  constructor(private readonly appmetricaService: AppmetricaService) {}

  @Get('stats') // <-- Path simplified and secured
  // CRITICAL: Use your actual production guard here
  @UseGuards(MockAuthGuard) 
  async getStats(@Request() req: any) {
    // 1. Retrieve the secure ID from the authenticated user payload (e.g., JWT payload)
    const influencerId = req.user._id; 

    if (!influencerId) {
        // Should be caught by the Guard, but good practice to double check
        throw new UnauthorizedException('Authentication token is missing the user ID.');
    }
    
    // 2. Pass the secure ID to the service
    return await this.appmetricaService.getInfluencerStats(influencerId);
  }
}