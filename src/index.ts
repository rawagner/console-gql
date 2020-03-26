import { createServer } from 'https';
import * as express from 'express';
import { ApolloServer } from 'apollo-server-express';
import * as fs from 'fs';

import { typeDefs, resolvers } from './schema';

const graphQLServer = new ApolloServer({ typeDefs, resolvers, context: ({ req, connection}) => {
  const headers = req ? req.headers : connection.context;
  const token = headers.Authorization || headers.authorization || 'Bearer 7z2FMbPSeE6Bb8MkXNfLDzYDjd9PCMo6jJWdWEgiFzM';
  return { token };
}});
const app = express();

const options = {
  key: fs.readFileSync('./certs/tls.key'),
  cert: fs.readFileSync('./certs/tls.crt')
};

graphQLServer.applyMiddleware({ app, path: '/graphql/' });
const server = createServer(options, app);
graphQLServer.installSubscriptionHandlers(server);

server.listen({ port: 4000 } , () => {
  console.log('Apollo Server on http://localhost:4000/graphql/');
});
