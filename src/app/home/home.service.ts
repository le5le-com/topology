import { Injectable } from '@angular/core';

import { HttpService } from 'src/app/http/http.service';

@Injectable()
export class HomeService {
  constructor(protected http: HttpService) {}

  async Get(data: any) {
    const ret = await this.http.QueryString({ fileId: data.fileId }).Get('/api/topology/' + data.id);
    if (ret.error) {
      return null;
    }

    return ret;
  }

  async Upload(blob: Blob, shared = false) {
    const form = new FormData();
    form.append('path', '/topology/thumb.png');
    form.append('randomName', '1');
    form.append('public', shared + '');
    form.append('file', blob);
    const ret = await this.http.PostForm('/api/image', form);
    if (ret.error) {
      return null;
    }

    return ret;
  }

  async DelImage(image: string) {
    const ret = await this.http.Delete('/api' + image);
    if (ret.error) {
      return false;
    }

    return true;
  }

  async Save(data: any) {
    let ret: any;
    if (!data.name) {
      data.name = `Created at ${new Date().toLocaleString()}`;
    }
    if (!data.desc) {
      data.desc = data.name;
    }
    if (data.id) {
      ret = await this.http.Put('/api/user/topology', data);
    } else {
      ret = await this.http.Post('/api/user/topology', data);
    }

    if (ret.error) {
      return null;
    }

    return ret;
  }

  async Patch(data: any) {
    if (data.image) {
      const retImage = await this.http.Patch('/api' + data.image, {
        public: data.shared
      });
      if (retImage.error) {
        return false;
      }
    }

    delete data.image;
    const ret = await this.http.Patch('/api/user/topology', data);
    if (ret.error) {
      return false;
    }

    return true;
  }
}
