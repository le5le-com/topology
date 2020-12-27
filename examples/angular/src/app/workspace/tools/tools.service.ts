import { Injectable } from '@angular/core';

import { HttpService } from 'src/app/http/http.service';
import { CoreService } from 'src/app/core/core.service';

@Injectable()
export class ToolsService {
  constructor(protected http: HttpService, private coreService: CoreService) { }

  async GetSystemTools() {
    const ret = await this.http.Get('/api/tools');
    if (ret.error) {
      return [];
    }

    for (const item of ret) {
      item.py = this.coreService.getPinyin(item.name, true);
    }

    return ret;
  }

  async GetUserTools() {
    const ret = await this.http.QueryString({
      pageIndex: 1,
      pageCount: 1000,
      component: true
    }).Get('/api/user/topologies');
    if (ret.error || !ret.list) {
      return [];
    }

    for (const item of ret.list) {
      item.py = this.coreService.getPinyin(item.name, true);
    }

    return ret.list;
  }
}
