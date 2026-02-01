import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SeatAvailabilityUpdate } from '@event-mgmt/shared-schemas';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);
  private eventSubscriptions: Map<string, Set<string>> = new Map();

  handleConnection(client: Socket) {
    this.logger.log({
      message: 'Client connected',
      clientId: client.id,
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log({
      message: 'Client disconnected',
      clientId: client.id,
    });

    // Clean up subscriptions
    this.eventSubscriptions.forEach((subscribers, eventId) => {
      subscribers.delete(client.id);
      if (subscribers.size === 0) {
        this.eventSubscriptions.delete(eventId);
      }
    });
  }

  @SubscribeMessage('subscribe:event')
  handleSubscribeToEvent(client: Socket, payload: { eventId: string }) {
    const { eventId } = payload;

    if (!this.eventSubscriptions.has(eventId)) {
      this.eventSubscriptions.set(eventId, new Set());
    }

    this.eventSubscriptions.get(eventId)!.add(client.id);
    client.join(`event:${eventId}`);

    this.logger.log({
      message: 'Client subscribed to event',
      clientId: client.id,
      eventId,
    });

    client.emit('subscribed', { eventId });
  }

  @SubscribeMessage('unsubscribe:event')
  handleUnsubscribeFromEvent(client: Socket, payload: { eventId: string }) {
    const { eventId } = payload;

    if (this.eventSubscriptions.has(eventId)) {
      this.eventSubscriptions.get(eventId)!.delete(client.id);
    }

    client.leave(`event:${eventId}`);

    this.logger.log({
      message: 'Client unsubscribed from event',
      clientId: client.id,
      eventId,
    });
  }

  emitSeatUpdate(update: SeatAvailabilityUpdate) {
    this.server.to(`event:${update.eventId}`).emit('seat:update', update);

    this.logger.log({
      message: 'Seat update emitted',
      eventId: update.eventId,
      availableSeats: update.availableSeats,
      subscribers: this.eventSubscriptions.get(update.eventId)?.size || 0,
    });
  }

  getEventSubscriberCount(eventId: string): number {
    return this.eventSubscriptions.get(eventId)?.size || 0;
  }
}
