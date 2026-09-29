import { Module } from '@nestjs/common';
import { GraphQLModule as NestGraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { EventsModule } from '../events/events.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [
    NestGraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/graphql/schema.gql'),
      sortSchema: true,
      graphiql: true, // Enable GraphQL Playground
      context: ({ req }: any) => ({ req }), // Pass request to resolvers
      formatError: (error: any) => {
        return {
          message: error.message,
          code: error.extensions?.code,
          path: error.path,
        };
      },
    }),
    EventsModule,
    BookingsModule,
  ],
})
export class GraphQLModule {}