import * as _ from 'lodash';
import { $$asyncIterator } from 'iterall';

const filterEvents = (payloadValue, { fields }) => {
  const requestedObject = _.pick(payloadValue.event.object, fields);
  payloadValue.event.object = requestedObject;
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