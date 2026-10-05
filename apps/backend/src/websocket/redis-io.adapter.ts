import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

/**
 * Fans Socket.IO broadcasts out through Redis pub/sub so a seat update emitted by
 * ANY API replica reaches clients connected to every other replica (the k8s HPA
 * runs 3-10 pods; without this, only the originating pod's clients would update).
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  connectToRedis(host: string, port: number): void {
    const pub = new Redis({ host, port });
    const sub = pub.duplicate();
    this.adapterConstructor = createAdapter(pub, sub);
  }

  // `options` is `any` on purpose: @nestjs/platform-socket.io bundles its own socket.io copy,
  // so the ServerOptions types of the two installs are nominally (but not structurally) different.
  createIOServer(port: number, options?: any): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
