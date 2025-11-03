import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Influencer extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  trackerId: string;

  @Prop({ required: true })
  referralLink: string;

  @Prop({ default: 0 })
  installs: number;

  @Prop({ default: 0 })
  earnings: number;
}

export const InfluencerSchema = SchemaFactory.createForClass(Influencer);
