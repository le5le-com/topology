import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import * as FileSaver from 'file-saver';

@Injectable({
  providedIn: 'root'
})
export class HttpService {
  queryParams = '';
  httpOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json' })
  };
  public constructor(protected http: HttpClient) {}

  QueryString(obj: any): HttpService {
    this.queryParams =
      '?' +
      Object.keys(obj)
        .map(function(key) {
          if (obj[key] === undefined || obj[key] === null || obj[key] === '') {
            return '';
          }

          if (obj[key] instanceof Array || Object.prototype.toString.call(obj[key]) === '[object Array]') {
            return obj[key]
              .map(function(item: string) {
                return encodeURIComponent(key) + '=' + encodeURIComponent(item);
              })
              .join('&');
          } else {
            return encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]);
          }
        })
        .join('&');

    return this;
  }

  async Get(url: string, options?: any) {
    url += this.queryParams;
    this.queryParams = '';
    try {
      return await this.http.get(url, options).toPromise();
    } catch (error) {
      return error;
    }
  }

  async Delete(url: string, options?: any) {
    url += this.queryParams;
    this.queryParams = '';
    try {
      return await this.http.delete(url, options).toPromise();
    } catch (error) {
      return error;
    }
  }

  async Post(url: string, body: any, options?: any) {
    url += this.queryParams;
    this.queryParams = '';
    if (!options) {
      options = this.httpOptions;
    }
    try {
      return await this.http.post(url, body, options).toPromise();
    } catch (error) {
      return error;
    }
  }

  async Put(url: string, body: any, options?: any) {
    url += this.queryParams;
    this.queryParams = '';
    if (!options) {
      options = this.httpOptions;
    }
    try {
      return await this.http.put(url, body, options).toPromise();
    } catch (error) {
      return error;
    }
  }

  async Patch(url: string, body: any, options?: any) {
    url += this.queryParams;
    this.queryParams = '';
    if (!options) {
      options = this.httpOptions;
    }
    try {
      return await this.http.patch(url, body, options).toPromise();
    } catch (error) {
      return error;
    }
  }

  async PostForm(url: string, body: FormData, options?: any) {
    url += this.queryParams;
    this.queryParams = '';
    try {
      return await this.http.post(url, body, options).toPromise();
    } catch (error) {
      return error;
    }
  }

  Download(url: string, fileName: string, options?: any) {
    url += this.queryParams;
    this.queryParams = '';
    if (!options) {
      options = {};
    }
    options.responseType = 'blob';

    const sub = this.http.get(url, options).subscribe(
      res => {
        FileSaver.saveAs(res, fileName);
      },
      err => console.error(err),
      () => {
        sub.unsubscribe();
      }
    );
  }
}
