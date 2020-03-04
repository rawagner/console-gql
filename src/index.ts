import { createServer } from 'http';
import * as express from 'express';
import { ApolloServer } from 'apollo-server-express';
import * as fs from 'fs';

import { typeDefs, resolvers } from './schema';

const graphQLServer = new ApolloServer({ typeDefs, resolvers });
const app = express();

graphQLServer.applyMiddleware({ app, path: '/graphql' });
const server = createServer(app);
graphQLServer.installSubscriptionHandlers(server);

server.listen({ port: 4000 } , () => {
  console.log('Apollo Server on http://localhost:4000/graphql');
});
