import { Injectable } from '@angular/core';

import { Store } from 'le5le-store';

import { HttpService } from 'src/app/http/http.service';

@Injectable()
export class UserImagesService {
  constructor(protected http: HttpService) { }

  static images: { id: string; image: string; }[];

  async Upload(blob: Blob, filename: string) {
    const form = new FormData();
    form.append('path', filename);
    form.append('randomName', '1');
    form.append('public', 'true');
    form.append('file', blob);
    const ret = await this.http.PostForm('/api/image', form);
    if (ret.error) {
      return null;
    }

    return ret;
  }

  async GetImages() {
    if (UserImagesService.images) {
      return UserImagesService.images;
    }

    if (!Store.get('user')) {
      return [];
    }

    const ret = await this.http
      .QueryString({
        pageIndex: 1,
        pageCount: 100,
        count: 0
      })
      .Get('/api/user/images');
    if (ret.error) {
      return [];
    }

    UserImagesService.images = ret.list;

    return ret.list || [];
  }

  async AddImage(image: string) {
    const ret = await this.http.Post('/api/user/image', { image: image });
    if (ret.error) {
      return '';
    }

    return ret.id;
  }

  async RemoveImage(id: string) {
    const ret = await this.http.Delete('/api/user/image/' + id);
    if (ret.error) {
      return false;
    }

    return true;
  }
}
