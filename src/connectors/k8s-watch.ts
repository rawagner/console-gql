
import * as _ from 'lodash';
import fetch from 'node-fetch';
import { WSFactory } from './ws-factory';

/* eslint-disable no-param-reassign */

const k8sAPIURL = process.env.K8S_API;
const k8sAPIURL_WS = process.env.K8S_API_WS;

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

export const k8sList = async (kind, opts = {}) => {
  const url = resourceURL(kind, opts);
  const result = await fetch(`${k8sAPIURL}${url}`);
  return result;
}

export const k8sWatch = ({ apiVersion, apiGroup, plural }, query = {} as any, wsOptions = {} as any) => {
  const queryParams = { watch: true } as any;
  const opts = { queryParams } as any;
  wsOptions = Object.assign(
    {
      host: 'auto',
      reconnect: true,
      jsonParse: true,
      bufferFlushInterval: 500,
      bufferMax: 1000,
      rejectUnauthorized: false,
    },
    wsOptions,
  );

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
  wsOptions.path = `${k8sAPIURL_WS}${path}`;
  return new WSFactory(path, wsOptions);
};
