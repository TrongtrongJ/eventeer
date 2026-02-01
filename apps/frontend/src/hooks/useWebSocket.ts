import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { io, Socket } from 'socket.io-client';
import { updateEventSeats } from '../store/slices/eventsSlice';
import { SeatAvailabilityUpdate } from '@event-mgmt/shared-schemas';

export const useWebSocket = (eventId?: string) => {
  const dispatch = useDispatch();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_REACT_APP_WS_URL || 'http://localhost:4000', {
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    socket.on('seat:update', (update: SeatAvailabilityUpdate) => {
      dispatch(
        updateEventSeats({
          eventId: update.eventId,
          availableSeats: update.availableSeats,
        })
      );
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    return () => {
      socket.close();
    };
  }, [dispatch]);

  useEffect(() => {
    if (eventId && socketRef.current) {
      socketRef.current.emit('subscribe:event', { eventId });

      return () => {
        socketRef.current?.emit('unsubscribe:event', { eventId });
      };
    }
  }, [eventId]);

  return socketRef.current;
};
