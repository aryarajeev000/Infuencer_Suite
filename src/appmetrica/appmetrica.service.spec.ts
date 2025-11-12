import { Test, TestingModule } from '@nestjs/testing';
import { AppmetricaService } from './appmetrica.service';
import { getModelToken } from '@nestjs/mongoose';
import { Influencer } from './influencer.schema';
import { HttpService } from '@nestjs/axios'; // <-- CRITICAL: Use HttpService
import { of, throwError } from 'rxjs'; // <-- CRITICAL: Use of and throwError from RxJS
import { NotFoundException } from '@nestjs/common';

// --- Configuration ---
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' }); 
// -----------------------------------------------------

// --- MOCK DEPENDENCIES ---

// Mock the Mongoose Query (simulates the findById().exec() chain)
const mockQuery = {
  exec: jest.fn(),
};

// 1. Mock the Influencer Model
const mockInfluencerModel = {
  findById: jest.fn(() => mockQuery), 
  save: jest.fn(), 
};

// 2. Mock the HttpService (It must return an RxJS Observable)
const mockHttpService = {
  get: jest.fn(),
};

// --- START TEST SUITE ---

describe('AppmetricaService', () => {
  let service: AppmetricaService;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppmetricaService,
        {
          provide: getModelToken(Influencer.name),
          useValue: mockInfluencerModel,
        },
        {
          // CRITICAL: Provide the mock for HttpService
          provide: HttpService, 
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<AppmetricaService>(AppmetricaService);
    httpService = module.get<HttpService>(HttpService); // Get reference to the mock
  });

  afterEach(() => {
    jest.clearAllMocks(); 
  });

  // --- Test Case 1: Verifies Secure Query Structure (CRITICALLY CORRECTED) ---
  // Assuming the service uses the correct function name: getInstallsByAdContent
  it('should send the correct filter query using ad_content and omit dimensions', async () => {
    // ARRANGE
    const mockMongoId = '6912273ea74a59746533529d'; 
    const mockInstalls = 75; 
    
    mockHttpService.get.mockReturnValue(
      of({ 
        data: {
          data: [{ metrics: [mockInstalls] }], 
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      })
    );

    // ACT
    // Note: This calls the function that should be named getInstallsByAdContent
    const result = await service.getInstallsByAdContent(mockMongoId); 

    // ASSERT
    expect(result).toBe(mockInstalls);
    expect(httpService.get).toHaveBeenCalledTimes(1);
    
    // Verify the correct, secure query structure is sent:
    expect(httpService.get).toHaveBeenCalledWith(
        expect.any(String), 
        expect.objectContaining({ 
            headers: expect.objectContaining({ 
                Authorization: expect.stringContaining('OAuth'), 
            }),
            params: expect.objectContaining({ 
                id: process.env.APPMETRICA_APP_ID, 
                metrics: 'ym:i:installs', 
                // CRITICAL FIX: The dimensions parameter should NOT be present
                // because we are only filtering for an aggregate total.
                // It is absent from this check.
                filters: `ym:i:adContent=='${mockMongoId}'`, // CRITICAL FIX: Checks for ad_content filter
                limit: 1,
            }),
        })
    );
  });

  // --- Test Case 2: getInfluencerStats (Full Flow and Payout Logic) ---
  it('should calculate earnings correctly using the floor rule and save data', async () => {
    // ARRANGE
    const mockInfluencer: any = {
      _id: 'influencer_id',
      trackerId: 'payout_tracker',
      referralLink: 'http://example.com/ref',
      installs: 0,
      earnings: 0,
      save: jest.fn().mockResolvedValue(true), 
    };

    // 1. Setup mock for Mongoose: findById().exec() resolves the mock document
    mockQuery.exec.mockResolvedValue(mockInfluencer);

    // 2. Setup mock for AppMetrica: Simulate 45 installs (should pay out $2)
    const installsFromAPI = 45; 
    mockHttpService.get.mockReturnValue(
      of({ data: { data: [{ metrics: [installsFromAPI] }] }, status: 200, headers: {}, config: {}, statusText: 'OK' })
    );

    // ACT
    const result = await service.getInfluencerStats(mockInfluencer._id);

    // ASSERT
    // 45 installs / 20 = 2.25. Math.floor(2.25) = 2. Earnings = $2.00.
    expect(result.installs).toBe(45);
    expect(result.earnings).toBe('2.00'); 
    expect(mockInfluencer.save).toHaveBeenCalledTimes(1); 
    expect(mockInfluencer.installs).toBe(45); 
    expect(mockInfluencer.earnings).toBe(2);
  });

  // --- Test Case 3: Error/Failure Scenario (No Payout) ---
  it('should return 0 installs and 0 earnings if the AppMetrica API fails', async () => {
    // ARRANGE
    const mockInfluencer: any = {
        _id: 'influencer_id',
        trackerId: 'fail_tracker',
        referralLink: 'http://example.com/ref',
        installs: 0,
        earnings: 0,
        save: jest.fn().mockResolvedValue(true),
    };
    // findById().exec() resolves the mock document
    mockQuery.exec.mockResolvedValue(mockInfluencer);

    // CRITICAL FIX: Mock HttpService GET to return an Observable that throws an error
    mockHttpService.get.mockReturnValue(
        throwError(() => new Error('AppMetrica timeout'))
    );

    // ACT
    const result = await service.getInfluencerStats(mockInfluencer._id);

    // ASSERT
    expect(result.installs).toBe(0);
    expect(result.earnings).toBe('0.00'); 
    expect(mockInfluencer.save).toHaveBeenCalledTimes(1); 
  });
  
  // --- Test Case 4: Influencer Not Found (404 Scenario) ---
  it('should throw NotFoundException if influencer is not found', async () => {
    // ARRANGE
    const mockInfluencerId = 'non_existent_id';
    
    // findById().exec() resolves to null
    mockQuery.exec.mockResolvedValue(null);

    // ACT & ASSERT
    await expect(service.getInfluencerStats(mockInfluencerId)).rejects.toThrow(
        NotFoundException
    );
    await expect(service.getInfluencerStats(mockInfluencerId)).rejects.toThrow(
        `Influencer with ID ${mockInfluencerId} not found.`
    );
    expect(httpService.get).not.toHaveBeenCalled(); // API call should not happen
  });
});