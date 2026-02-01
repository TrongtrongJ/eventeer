import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventsResolver } from './events.resolver'; // ADD THIS
import { Event } from '../entities/event.entity';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [TypeOrmModule.forFeature([Event]), WebsocketModule],
  controllers: [EventsController],
  providers: [EventsService, EventsResolver], // ADD EventsResolver
  exports: [EventsService],
})
export class EventsModule {}