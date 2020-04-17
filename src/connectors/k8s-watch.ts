
import * as _ from 'lodash';
import fetch from 'node-fetch';
import { Agent } from 'https';
import * as WebSocket from 'ws';
import { performance } from 'perf_hooks';

export const k8sAPIURL = process.env.k8sAPIURL || 'kubernetes.default';

export const createEquals = (key, value) => ({
  key,
  operator: 'Equals',
  values: [value],
});

const isOldFormat = selector => !selector.matchLabels && !selector.matchExpressions;

export const toRequirements = (selector = {} as any) => {
  const requirements = [];
  const matchLabels = isOldFormat(selector) ? selector : selector.matchLabels;
  const { matchExpressions } = selector;

  Object.keys(matchLabels || {})
    .sort()
    .forEach(k => requirements.push(createEquals(k, matchLabels[k])));

  (matchExpressions || []).forEach(me => requirements.push(me));

  return requirements;
};

const toArray = value => (Array.isArray(value) ? value : [value]);

export const requirementToString = (requirement) => {
  if (requirement.operator === 'Equals') {
    return `${requirement.key}=${requirement.values[0]}`;
  }

  if (requirement.operator === 'NotEquals') {
    return `${requirement.key}!=${requirement.values[0]}`;
  }

  if (requirement.operator === 'Exists') {
    return requirement.key;
  }

  if (requirement.operator === 'DoesNotExist') {
    return `!${requirement.key}`;
  }

  if (requirement.operator === 'In') {
    return `${requirement.key} in (${toArray(requirement.values).join(',')})`;
  }

  if (requirement.operator === 'NotIn') {
    return `${requirement.key} notin (${toArray(requirement.values).join(',')})`;
  }

  if (requirement.operator === 'GreaterThan') {
    return `${requirement.key} > ${requirement.values[0]}`;
  }

  if (requirement.operator === 'LessThan') {
    return `${requirement.key} < ${requirement.values[0]}`;
  }

  return false;
};

export const selectorToString = (selector) => {
  const requirements = toRequirements(selector);
  return requirements.map(requirementToString).join(',');
};

const getK8sAPIPath = ({ apiGroup = 'core', apiVersion }) => {
  const isLegacy = apiGroup === 'core' && apiVersion === 'v1';
  let p = '';
  if (isLegacy) {
    p += '/api/';
  } else {
    p += '/apis/';
  }

  if (!isLegacy && apiGroup) {
    p += `${apiGroup}/`;
  }

  p += apiVersion;
  return p;
};

export const resourceURL = ({ apiVersion, apiGroup, plural }, options) => {
  let q = '' as any;
  let u = getK8sAPIPath({ apiVersion, apiGroup });

  if (options.ns) {
    u += `/namespaces/${options.ns}`;
  }
  u += `/${plural}`;
  if (options.name) {
    u += `/${options.name}`;
  }
  if (options.path) {
    u += `/${options.path}`;
  }
  if (!_.isEmpty(options.queryParams)) {
    q = _.map(options.queryParams, (v, k) => `${k}=${v}`);
    u += `?${q.join('&')}`;
  }

  return u;
};

export const k8sList = async (kind, opts = {}, token) => {
  const url = resourceURL(kind, opts);
  const t1 = performance.now();
  const result = await fetch(`https://${k8sAPIURL}${url}`, {
    agent: new Agent({ rejectUnauthorized: false }),
    headers: {
      Authorization: token,
    }
  });
  const t2 = performance.now();
  console.log(`Call to k8s: ${(t2-t1).toFixed(4)}`);
  return result;
}

export const k8sWatch = ({ apiVersion, apiGroup, plural }, query = {} as any, token) => {
  const queryParams = { watch: true } as any;
  const opts = { queryParams } as any;

  const labelSelector = query.labelSelector; //|| kind.labelSelector; //TODO
  if (labelSelector) {
    const encodedSelector = encodeURIComponent(selectorToString(labelSelector));
    if (encodedSelector) {
      queryParams.labelSelector = encodedSelector;
    }
  }

  if (query.fieldSelector) {
    queryParams.fieldSelector = encodeURIComponent(query.fieldSelector);
  }

  if (query.ns) {
    opts.ns = query.ns;
  }

  if (query.resourceVersion) {
    queryParams.resourceVersion = encodeURIComponent(query.resourceVersion);
  }

  const path = resourceURL({ apiVersion, apiGroup, plural }, opts);

  const ws = new WebSocket(
    `wss://${k8sAPIURL}${path}`,
    {
      origin: 'http://localhost:4000',
      rejectUnauthorized: false,
      headers: {
        Authorization: token,
      }
    }
  );
  return ws;
};
