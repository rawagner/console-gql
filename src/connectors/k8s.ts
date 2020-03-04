import { k8sWatch, k8sList } from './k8s-watch';

/* eslint-disable no-unused-expressions */

const REF_COUNTS = {};
const WS = {};
const POLLs = {};

export const list = async (kind, opts) => await k8sList(kind, opts);

export const watch = (pubsub, id, { kind, opts }) => {
  // Only one watch per unique list ID
  if (id in REF_COUNTS) {
    REF_COUNTS[id] += 1;
    return null;
  }
  REF_COUNTS[id] = 1;
  /**
   * Incrementally fetch list (XHR) using k8s pagination then use its resourceVersion to
   *  start listening on a WS (?resourceVersion=$resourceVersion)
   *  start the process over when:
   *   1. the WS closes abnormally
   *   2. the WS can not establish a connection within $TIMEOUT
   */
  const pollAndWatch = async () => {
    WS[id] = k8sWatch(
      kind,
      opts,
      { timeout: 60 * 1000 },
    );

    WS[id]
      .onclose((event) => {
        // Close Frame Status Codes: https://tools.ietf.org/html/rfc6455#section-7.4.1
        if (event.code !== 1006) {
          return;
        }
        // eslint-disable-next-line no-console
        console.log('WS closed abnormally - starting polling loop over!');
        const ws = WS[id];
        const timedOut = true;
        ws && ws.destroy(timedOut);
      })
      .ondestroy((timedOut) => {
        if (!timedOut) {
          return;
        }
        // If the WS is unsucessful for timeout duration, assume it is less work
        //  to update the entire list and then start the WS again

        // eslint-disable-next-line no-console
        console.log('timed out - restarting polling');
        delete WS[id];

        if (POLLs[id]) {
          return;
        }

        POLLs[id] = setTimeout(pollAndWatch, 15 * 1000);
      })
      .onbulkmessage((events) => {
        pubsub.publish(id, { events });
        // [updateListFromWS, extraAction].forEach((f) => f && dispatch(f(id, events)));
      });
  };
  pollAndWatch();
};

export const stopWatch = (id: string) => {
  if (!REF_COUNTS[id]) {
    return null;
  }
  REF_COUNTS[id] -= 1;
  if (REF_COUNTS[id] > 0) {
    return null;
  }

  const ws = WS[id];
  if (ws) {
    ws.destroy();
    delete WS[id];
  }
  const poller = POLLs[id];
  clearInterval(poller);
  delete POLLs[id];
  delete REF_COUNTS[id];
};
