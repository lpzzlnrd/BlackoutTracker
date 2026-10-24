import { Module } from '@nestjs/common';
import { ConsensoService } from './consenso.service';

@Module({ providers: [ConsensoService], exports: [ConsensoService] })
export class ConsensoModule {}
