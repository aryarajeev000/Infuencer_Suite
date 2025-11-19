import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Influencer extends Document {
  @Prop({ required: true })
  name: string;

  // Unique ID from DB also used as ad_content
  @Prop({ required: true })
  trackerId: string;

  @Prop({ required: true })
  referralLink: string;

  // From acquisition API
  @Prop({ default: 0 })
  clicks: number;

  @Prop({ default: 0 })
  installs: number;

  // From registration events API
  @Prop({ default: 0 })
  registrations: number;

  // Calculated
  @Prop({ default: 0 })
  earnings: number;
}

export const InfluencerSchema = SchemaFactory.createForClass(Influencer);
