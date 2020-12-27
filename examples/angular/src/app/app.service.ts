import { Injectable } from '@angular/core';

import { HttpService } from 'src/app/http/http.service';

@Injectable()
export class AppService {
  constructor(protected http: HttpService) { }

  async GetConfigs() {
    const ret = await this.http.QueryString({ types: 'bars,classes,vision' }).Get('/api/cms');
    if (ret.error) {
      return [];
    }

    return ret;
  }
}
