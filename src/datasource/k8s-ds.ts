import { RESTDataSource } from 'apollo-datasource-rest';
import * as _ from 'lodash';
import { Agent } from 'https';
import { k8sAPIURL, resourceURL } from '../connectors/k8s-watch';

export class K8sAPI extends RESTDataSource {
  constructor() {
    super();
    this.baseURL = `https://${k8sAPIURL}`;
  }

  getResource = async (kind, opts, token) => {
    const url = resourceURL(kind, opts);
    return this.fetchJSON(url, token);
  }

  createResource = async (kind, opts, token) => {
    const url = resourceURL(kind, {});
    return this.postJSON(url, opts, token);
  }

  fetchJSON = (path, token) => this.get(
    path,
    null,
    {
      agent: new Agent({ rejectUnauthorized: false }),
      headers: {
        Authorization: token,
      },
    }
  );

  postJSON = (path, body, token) => this.post(
    path,
    body,
    {
      agent: new Agent({ rejectUnauthorized: false }),
      headers: {
        Authorization: token,
      }
    }
  );

  fetchWithParams = (kind, params = { ns : null}, token) => {
    const query = _.map(_.omit(params, 'ns'), (v, k) => {
      return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
    }).join('&');
  
    const listURL = resourceURL(kind, { ns: params.ns });
    const url =  `${listURL}?${query}`;
    return this.fetchJSON(url, token);
  }

  paginationLimit = 250;

  incrementallyLoad = async (kind, opts, token, onload, continueToken = ''): Promise<string> => {
    // the list may not still be around...
    //if (!REF_COUNTS[id]) {
      // let .then handle the cleanup
    //  return;
    //}

    const response = await this.fetchWithParams(
      kind,
      {
        limit: this.paginationLimit,
        ...opts,
        ...(continueToken ? { continue: continueToken } : {}),
      },
      token,
    );

    if (!continueToken) {
      onload(response, 'INIT_LOAD');
    } else {
      onload(response, response.metadata.continue ? 'INC_LOAD' : 'FINAL_LOAD');
    }

    if (response.metadata.continue) {
      return this.incrementallyLoad(kind, opts, token, onload, response.metadata.continue);
    }
    return response.metadata.resourceVersion;
  };
}