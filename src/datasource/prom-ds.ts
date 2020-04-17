import { RESTDataSource } from 'apollo-datasource-rest';
import * as _ from 'lodash';
import { Agent } from 'https';

export class PromAPI extends RESTDataSource {
    constructor() {
      super();
      const promAPIURL = process.env.promAPIURL;
      this.baseURL = `https://${promAPIURL}`;
    }
  
    fetchJSON = async (path, token) => {
      return await this.get(
        path,
        null,
        {
          agent: new Agent({ rejectUnauthorized: false }),
          headers: {
            Authorization: token,
          },
        }
      );
    }
}