import { Injectable } from '@angular/core';

import { HttpService } from 'src/app/http/http.service';
import { CoreService } from 'src/app/core/core.service';

@Injectable()
export class UserHomeService {
  constructor(protected http: HttpService, protected coreService: CoreService) {}

  async Topologies(params: any) {
    const ret = await this.http.QueryString(params).Get('/api/user/topologies');
    if (ret.error || !ret.list) {
      return {
        list: [],
        count: 0
      };
    }

    this.parseData(ret);
    return ret;
  }

  async Star(data: any) {
    let ret: any;
    if (data.stared) {
      ret = await this.http.Delete('/api/user/star/' + data.id);
    } else {
      ret = await this.http.Post('/api/user/star', { id: data.id });
    }

    if (ret.error) {
      return null;
    }

    data.stared = !data.stared;
    if (data.stared) {
      ++data.star;
    } else {
      --data.star;
    }
    return ret;
  }

  async Favorite(data: any) {
    let ret: any;
    if (data.favorited) {
      ret = await this.http.Delete('/api/user/favorite/' + data.id);
    } else {
      ret = await this.http.Post('/api/user/favorite', { id: data.id });
    }

    if (ret.error) {
      return null;
    }

    data.favorited = !data.favorited;
    if (data.favorited) {
      ++data.hot;
    } else {
      --data.hot;
    }
    return ret;
  }

  parseData(ret: any) {
    for (const item of ret.list) {
      item.usernamePinyin = this.coreService.getPinyin(item.username);
      if (ret.stars) {
        for (const t of ret.stars) {
          if (t.id === item.id) {
            item.stared = true;
            break;
          }
        }
      }
      if (ret.favorites) {
        for (const t of ret.favorites) {
          if (t.id === item.id) {
            item.favorited = true;
            break;
          }
        }
      }
    }
  }

  async Patch(data: any) {
    delete data.image;
    const ret = await this.http.Patch('/api/user/topology', data);
    if (ret.error) {
      return false;
    }

    return true;
  }

  async Del(id: string) {
    const ret = await this.http.Delete('/api/user/topology/' + id);
    if (ret.error) {
      return false;
    }

    return true;
  }
}
