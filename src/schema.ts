import * as _ from 'lodash';
import { makeExecutableSchema } from 'graphql-tools';
import { PubSub } from 'graphql-subscriptions';
import {list, watch, stopWatch } from './connectors/k8s';
import { withEventFilter } from './withEventFilter';

export const typeDefs = `
  scalar JSON
  schema {
    query: Query
    subscription: Subscription
  }

  type ResourceMetadata {
    name: String
    namespace: String
    deletionTimestamp: String
    uid: String
    creationTimestamp: String
    resourceVersion: String
  }

  type Resource {
    metadata: ResourceMetadata
    customFields: JSON
  }

  type ResourceListMetadata {
    resourceVersion: String
  }

  type ResourceList {
    metadata: ResourceListMetadata
    items: [JSON]
  }

  type ResourceEvent {
    type: String
    object: JSON
  }

  type Query {
    listResources(apiVersion: String, apiGroup: String, plural: String, ns: String, fields: [String]): ResourceList
  }
  type Subscription {
    watchResources(apiVersion: String, apiGroup: String, plural: String, ns: String, resourceVersion: String, fields: [String]): ResourceEvent
  }
`;

const withCancel = <T>(
  asyncIterator: AsyncIterator<T | undefined>,
  onCancel: () => void
): AsyncIterator<T | undefined> => {
  if (!asyncIterator.return) {
    asyncIterator.return = () => Promise.resolve({ value: undefined, done: true });
  }

  const savedReturn = asyncIterator.return.bind(asyncIterator);
  asyncIterator.return = () => {
    onCancel();
    return savedReturn();
  };

  return asyncIterator;
}

const pubsub = new PubSub();

export const resolvers = {
  Query: {
    listResources: async (x, { apiVersion, apiGroup, plural, ns, fields }, { token }) => {
      const response = await list({ apiVersion, apiGroup, plural }, { ns }, token);
      const result = await response.json();
      if (fields) {
        result.items = result.items.map((i) => i = _.pick(i, fields));
        return result;
      }
      return result;
    }
  },
  Subscription: {
    watchResources: {
      subscribe: withEventFilter((x, { apiVersion, apiGroup, plural, ns, resourceVersion }, { token }) => {
        const watchID = watch(pubsub, { kind: { apiVersion, apiGroup, plural }, opts: { ns, resourceVersion } }, token);
        return withCancel(pubsub.asyncIterator(watchID), () => stopWatch(watchID));
      }),
      resolve: (payload) => payload.event,
    },
  },
};

export default makeExecutableSchema({ typeDefs, resolvers });