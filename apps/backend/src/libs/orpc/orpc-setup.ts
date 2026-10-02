import { ExecutionContext, Logger } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ORPCModule } from '@orpc/nest';
import { ResponseHeadersHandlerPlugin, RequestHeadersHandlerPlugin, ResponseHeadersHandlerPluginContext, RequestHeadersHandlerPluginContext, CORSHandlerPlugin } from "@orpc/server/plugins";
import { Request } from 'express';

declare module "@orpc/server" {
  interface DefaultInitialContext extends RequestHeadersHandlerPluginContext, 
    ResponseHeadersHandlerPluginContext {
      request: Request;
    }
}
export function registerORPC () {  
  return ORPCModule.forRootAsync({
    useFactory: () => ({
        context: (ctx: ExecutionContext) => ({
          request: ctx.switchToHttp().getRequest(),
        }),
        inject: [REQUEST],
        plugins: [
          new RequestHeadersHandlerPlugin(), 
          new ResponseHeadersHandlerPlugin(), 
          new CORSHandlerPlugin({
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            credentials: true, 
            allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH', 'QUERY', 'OPTIONS'],
          })
        ],
    }),
  })
}