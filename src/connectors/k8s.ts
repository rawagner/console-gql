import * as _ from 'lodash';
import { k8sWatch, k8sList } from './k8s-watch';

const REF_COUNTS = {};
const WS = {};
const POLLs = {};

export const referenceForGroupVersionKind = (group: string) => (version: string) => (
  kind: string,
) => [group, version, kind].join('~');

export const referenceForModel = (model) =>
  referenceForGroupVersionKind(model.apiGroup || 'core')(model.apiVersion)(model.kind);

export const makeID = (k8sKind = {}, query) => {
  let qs = '';
  if (!_.isEmpty(query)) {
    qs = `---${JSON.stringify(query)}`;
  }

  return `${referenceForModel(k8sKind)}${qs}`;
};

export const list = async (kind, opts, token) => await k8sList(kind, opts, token);

export const watch = (pubsub, { kind, opts }, token) => {
  const id = makeID(kind, opts);
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
    WS[id] = k8sWatch(kind, opts, token);

    WS[id].onopen = () => console.log(`open ${id}`);
    WS[id].onerror = () => console.log('err');
    WS[id].onclose = () => console.log(`close ${id}`);
    WS[id].onmessage = (event) => {
      pubsub.publish(id, { event: JSON.parse(event.data) });
    };
  };
  pollAndWatch();
  return id;
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
    ws.close();
    delete WS[id];
  }
  const poller = POLLs[id];
  clearInterval(poller);
  delete POLLs[id];
  delete REF_COUNTS[id];
};
