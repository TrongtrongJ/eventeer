import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLModule as NestGraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import type { EnvConfig } from '../env.validation';

/**
 * Resolvers live next to their services (events.resolver, bookings.resolver) and
 * are auto-discovered. Authentication/authorization is NOT re-implemented here:
 * the global guards resolve the same httpOnly cookie for GraphQL, so `req.user`
 * is populated identically to REST/oRPC.
 */
@Module({
  imports: [
    NestGraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => {
        const isProd = config.get('isProd', { infer: true });
        return {
          autoSchemaFile: true, // in-memory; no generated file committed or written in containers
          sortSchema: true,
          graphiql: !isProd,
          introspection: !isProd,
          includeStacktraceInErrorResponses: !isProd,
          context: ({ req, res }: any) => ({ req, res }),
        };
      },
    }),
  ],
})
export class GraphQLModule {}
