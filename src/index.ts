import { createServer as createHttpsServer } from 'https';
import { createServer } from 'http';
import * as express from 'express';
import { ApolloServer } from 'apollo-server-express';
import * as fs from 'fs';
import * as compression from 'compression';

import { resolvers } from './schema';
import { typeDefs } from './typeDef';
import { K8sAPI } from './datasource/k8s-ds';
import { PromAPI } from './datasource/prom-ds';

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

const options = process.env['service-ca-file'] ? {
  ca: fs.readFileSync(process.env['service-ca-file']),
  key: fs.readFileSync('/var/serving-cert/tls.key'),
  cert: fs.readFileSync('/var/serving-cert/tls.crt'),
} : null;

graphQLServer.applyMiddleware({ app, path: '/graphql/' });
const server = options ? createHttpsServer(options, app) : createServer(app);

graphQLServer.installSubscriptionHandlers(server);

server.listen({ port: 4000 } , () => {
  console.log(`Apollo Server on ${options ? 'https' : 'http'}://localhost:4000/graphql/`);
});
