import * as _ from 'lodash';
import { $$asyncIterator } from 'iterall';

const cache = {};

export const getQN: (obj) => string = ({ metadata: { name, namespace } }) =>
  (namespace ? `(${namespace})-` : '') + name;

const filterEvents = (payloadValue, { fields }) => {
  const filteredEvents = [];
  payloadValue.events.forEach((event) => {
    const { type, object } = event;
    const requestedObject = _.pick(object, fields);
    const qn = getQN(requestedObject);
    switch (event.type) {
      case 'ADDED': {
        cache[qn] = requestedObject;
        filteredEvents.push({ type, object: requestedObject });
      }
      case 'DELETED': {
        filteredEvents.push({ type, object: requestedObject });
        delete cache[qn];
      }
      case 'MODIFIED': {
        if (cache[qn] && _.isEqual(_.omit(cache[qn], 'metadata.resourceVersion'), _.omit(requestedObject, 'metadata.resourceVersion'))) {
          const objectEvents = filteredEvents.filter((fe) => getQN(fe.object) === qn);
          if (!objectEvents.length || objectEvents[objectEvents.length -1].type === 'MODIFIED') {
            return;
          }
        }
        cache[qn] = requestedObject;
        filteredEvents.push({ type, object: requestedObject });
      }
    }
  });
  payloadValue.events = filteredEvents;
  return payloadValue;
}

export const withEventFilter = (asyncIteratorFn) => {
  return (rootValue: any, args: any, context: any, info: any) => {
    const asyncIterator = asyncIteratorFn(rootValue, args, context, info);

    const getNextPromise = () => {
      return asyncIterator
        .next()
        .then(payload => {
          if (payload.done === true) {
            return payload;
          }

          return Promise.resolve(filterEvents(payload.value, args))
            .catch(() => [])
            .then(filterResult => {
              if (filterResult.events.length) {
                payload.value = filterResult;
                return payload;
              }
              return getNextPromise();
            });
        });
    };

    return {
      next() {
        return getNextPromise();
      },
      return() {
        return asyncIterator.return();
      },
      throw(error) {
        return asyncIterator.throw(error);
      },
      [$$asyncIterator]() {
        return this;
      },
    };
  };
};