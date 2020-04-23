import * as _ from 'lodash';
import { PubSub } from 'graphql-subscriptions';
import { watch, stopWatch } from './connectors/k8s';
import { withCancel } from './withCancel';
import { withFieldsFilter } from './withFieldsFilter';

const pubsub = new PubSub();

export const resolvers = {
  Query: {
    getPods: (x, { ns, continueToken }, { token, dataSources }) => {
      const k8sKind = { apiVersion: 'v1', apiGroup: 'core', kind: 'pod', plural: 'pods' };
      const opts = { ns };
      return dataSources.k8sAPI.fetchWithParams(
        k8sKind,
        {
          limit: 250,
          ...opts,
          ...(continueToken ? { continue: continueToken } : {}),
        },
        token,
      );
    },
    urlFetch: (root, { url }, { token, dataSources }) => dataSources.k8sAPI.fetchJSON(url, token),
    selfSubjectAccessReview: (root, { group, resource, verb, namespace }, { token, dataSources }) => {
      const data = {
        spec: {
          resourceAttributes: {
            group,
            resource,
            verb,
            namespace,
          }
        }
      };
      return dataSources.k8sAPI.createResource({ apiVersion: 'v1', apiGroup: 'authorization.k8s.io', plural: 'selfsubjectaccessreviews' }, data, token);
    },
    prometheusFetch: (root, { url }, { token, dataSources }) => dataSources.promAPI.fetchJSON(url, token),
  },
  Subscription: {
    watchResources: {
      subscribe: withFieldsFilter((x, { apiVersion, apiGroup, plural, kind, ns, fields }, { token, dataSources }) => {
        const watchID = watch(pubsub, { kind: { apiVersion, apiGroup, kind, plural }, opts: { ns } }, token, dataSources);
        return withCancel(pubsub.asyncIterator(watchID), () => stopWatch(watchID));
      }),
      resolve: (payload) => payload.event,
    },
    watchPods: {
      subscribe: (x, { ns }, { token, dataSources }) => {
        const watchID = watch(pubsub, { kind: { apiVersion: 'v1', apiGroup: 'core', kind: 'pod', plural: 'pods' }, opts: { ns } }, token, dataSources);
        return withCancel(pubsub.asyncIterator(watchID), () => stopWatch(watchID));
      },
      resolve: (payload) => payload.event,
    },
  },
};