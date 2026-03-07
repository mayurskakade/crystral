import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GenerationModule } from './generation/generation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GenerationModule,
  ],
})
export class AppModule {}
