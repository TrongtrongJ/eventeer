import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { SeatAvailabilityUpdate } from "@packages/shared-schemas";

@WebSocketGateway({
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true,
    },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(WebsocketGateway.name);

    handleConnection(client: Socket) {
        this.logger.log({
            message: "Client connected",
            clientId: client.id,
        });
    }

    handleDisconnect(client: Socket) {
        this.logger.log({
            message: "Client disconnected",
            clientId: client.id,
        });
        // Socket.IO removes the client from its rooms on disconnect; nothing to clean up.
    }

    @SubscribeMessage("subscribe:event")
    async handleSubscribeToEvent(client: Socket, payload: { eventId: string }) {
        const { eventId } = payload;
        if (typeof eventId !== "string" || !eventId) return;

        // Rooms (not an in-process Map) so membership also works across replicas via the Redis adapter.
        await client.join(`event:${eventId}`);

        this.logger.log({
            message: "Client subscribed to event",
            clientId: client.id,
            eventId,
        });

        client.emit("subscribed", { eventId });
    }

    @SubscribeMessage("unsubscribe:event")
    async handleUnsubscribeFromEvent(client: Socket, payload: { eventId: string }) {
        const { eventId } = payload;
        if (typeof eventId !== "string" || !eventId) return;

        await client.leave(`event:${eventId}`);

        this.logger.log({
            message: "Client unsubscribed from event",
            clientId: client.id,
            eventId,
        });
    }

    emitSeatUpdate(update: SeatAvailabilityUpdate) {
        this.server.to(`event:${update.eventId}`).emit("seat:update", update);

        this.logger.log({
            message: "Seat update emitted",
            eventId: update.eventId,
            availableSeats: update.availableSeats,
        });
    }
}
