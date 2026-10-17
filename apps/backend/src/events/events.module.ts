import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";
import { EventsResolver } from "./events.resolver";
import { EventImagesService } from "./event-images.service";
import { Event } from "../entities/event.entity";
import { WebsocketModule } from "../websocket/websocket.module";
import { StorageModule } from "../storage/storage.module";

@Module({
    imports: [TypeOrmModule.forFeature([Event]), WebsocketModule, StorageModule],
    controllers: [EventsController],
    providers: [EventsService, EventsResolver, EventImagesService],
    exports: [EventsService],
})
export class EventsModule {}
