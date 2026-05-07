import { Module } from '@nestjs/common';
import { UsecaseController } from './usecase.controller';
import { UsecaseService } from './usecase.service';
@Module({ controllers: [UsecaseController], providers: [UsecaseService] })
export class UsecaseModule {}
