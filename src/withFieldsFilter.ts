import * as _ from 'lodash';
import { $$asyncIterator } from 'iterall';

const mapObjects = (payloadValue, { fields }) => {
  const requestedObjects = fields ? payloadValue.event.objects.map(obj => _.pick(obj, fields)) : payloadValue.event.objects;
  payloadValue.event.objects = requestedObjects;
  return payloadValue;
}

export const withFieldsFilter = (asyncIteratorFn) => {
  return (rootValue: any, args: any, context: any, info: any) => {
    const asyncIterator = asyncIteratorFn(rootValue, args, context, info);

    const getNextPromise = () => {
      return asyncIterator
        .next()
        .then(payload => {
          if (payload.done === true) {
            return payload;
          }

          return Promise.resolve(mapObjects(payload.value, args))
            .catch(() => [])
            .then(filterResult => {
              payload.value = filterResult;
              return payload;
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