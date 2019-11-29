import { Injectable } from '@angular/core';

import { HttpService } from 'src/app/http/http.service';
import { CoreService } from 'src/app/core/core.service';

@Injectable()
export class UserHistoryService {
  constructor(protected http: HttpService, protected coreService: CoreService) {}

  async List(params: any) {
    const ret = await this.http.QueryString(params).Get('/api/user/topology/histories');
    if (ret.error || !ret.list) {
      return {
        list: [],
        count: 0
      };
    }

    return ret;
  }

  async Patch(data: any) {
    delete data.image;
    const ret = await this.http.Patch('/api/user/topology/history', data);
    if (ret.error) {
      return false;
    }

    return true;
  }

  async Del(id: string) {
    const ret = await this.http.Delete('/api/user/topology/history/' + id);
    if (ret.error) {
      return false;
    }

    return true;
  }

  async DelImage(image: string) {
    const ret = await this.http.Delete('/api' + image);
    if (ret.error) {
      return false;
    }

    return true;
  }
}
