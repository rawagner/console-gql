import { createServer } from 'https';
import * as express from 'express';
import { ApolloServer } from 'apollo-server-express';
import * as fs from 'fs';
import * as compression from 'compression';
import { Server } from 'ws';

import { resolvers } from './schema';
import { typeDefs } from './typeDef';
import { K8sAPI } from './datasource/k8s-ds';
import { PromAPI } from './datasource/prom-ds';
import { installSubscriptionHandlers } from './apollo-patch/subscriptions';

const constructDataSourcesForSubscriptions = (context) => {
  const initializeDataSource = (dataSourceClass) => {
    const instance = new dataSourceClass()
    instance.initialize({ context, cache: undefined })
    return instance 
  }

  const k8sAPI = initializeDataSource(K8sAPI)
  const promAPI = initializeDataSource(PromAPI)

  return {
    k8sAPI,
    promAPI,
  }
}


const graphQLServer = new ApolloServer({
  typeDefs,
  resolvers,
  dataSources: () => ({ k8sAPI: new K8sAPI(), promAPI: new PromAPI()}),
  context: ({ req, connection }) => {
    const headers = req ? req.headers : connection.context;
    const token = headers.Authorization || headers.authorization || `Bearer ${process.env.k8sTOKEN}`;
    console.log(`token ${token}`);
    if (connection) {
      return {
        dataSources: constructDataSourcesForSubscriptions(connection.context),
        token,
      }
    }
    return { token };
  }
});
const app = express();
app.use(compression());

if(process.env['service-ca-file']) {
  console.log(process.env['service-ca-file']);
}


const options = process.env['service-ca-file'] ? {
  ca: fs.readFileSync(process.env['service-ca-file']),
  key: fs.readFileSync('./serving-cert/tls.key'),
  cert: fs.readFileSync('./serving-cert/tls.crt'),
} : {
  ca: fs.readFileSync('./certs/new-ca.ca'),
  key: fs.readFileSync('./certs/new-tls.key'),
  cert: fs.readFileSync('./certs/new-tls.crt'),
};

graphQLServer.applyMiddleware({ app, path: '/graphql/' });
const server = createServer(options, app);

const wss = new Server({
  server,
  perMessageDeflate: {
    zlibDeflateOptions: {
      // See zlib defaults.
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    // Other options settable:
    clientNoContextTakeover: true, // Defaults to negotiated value.
    serverNoContextTakeover: true, // Defaults to negotiated value.
    serverMaxWindowBits: 10, // Defaults to negotiated value.
    // Below options specified as default values.
    concurrencyLimit: 10, // Limits zlib concurrency for perf.
    threshold: 1024 // Size (in bytes) below which messages
    // should not be compressed.
  }
});


graphQLServer.installSubscriptionHandlers = installSubscriptionHandlers;
graphQLServer.installSubscriptionHandlers(wss as any);

server.listen({ port: 4000 } , () => {
  console.log('Apollo Server on http://localhost:4000/graphql/');
});
