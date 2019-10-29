import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
  HttpResponse,
  HttpErrorResponse
} from '@angular/common/http';

import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { NoticeService } from 'le5le-components/notice';
import { Cookie, Store } from 'le5le-store';
import { environment } from 'src/environments/environment';
import { CoreService } from '../core/core.service';

@Injectable()
export class AppHttpInterceptor implements HttpInterceptor {
  constructor(protected coreService: CoreService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', Cookie.get(environment.token))
    });
    return next.handle(authReq).pipe(
      tap(
        // Succeeds when there is a response; ignore other events
        event => {
          if (event instanceof HttpResponse) {
            // Update token.
            if (event.headers.get(environment.token)) {
              this.coreService.saveToken({ token: event.headers.get(environment.token) });
            }

            // Pop error.
            if (event.body.error) {
              const _noticeService: NoticeService = new NoticeService();
              _noticeService.notice({
                body: event.body.error,
                theme: 'error',
                timeout: 10000
              });
              // tslint:disable-next-line:triple-equals
            }
          }
        },
        // Operation failed; error is an HttpErrorResponse
        (error: HttpErrorResponse) => {
          if (error.status === 401) {
            Store.set('auth', -1);
            if (error.url.indexOf('/api/user/profile') < 0) {
              const noticeService: NoticeService = new NoticeService();
              noticeService.notice({
                body: '请先登录，让我们知道保存在谁的云存储下面。',
                theme: 'error'
              });
            }
          } else if (error.status === 403) {
            Store.set('redirect', '/');
          } else if (error.status === 504) {
            const _noticeService: NoticeService = new NoticeService();
            _noticeService.notice({
              body: '网络超时，请检测你的网络',
              theme: 'error'
            });
          } else {
            const _noticeService: NoticeService = new NoticeService();
            _noticeService.notice({
              body: '未知网络错误，请检测你的网络',
              theme: 'error'
            });
          }
        }
      )
    );
  }
}
