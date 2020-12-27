import { ModuleWithProviders, NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { Store, Cookie } from 'le5le-store';
import { NoticeService } from 'le5le-components/notice';

import { HttpService } from '../http/http.service';
import { CoreService } from './core.service';
import { environment } from 'src/environments/environment';

@NgModule({
  imports: [CommonModule],
  declarations: [],
  exports: [],
  providers: [NoticeService, HttpService]
})
export class CoreModule {
  private socket: WebSocket;
  private socketCallback: any = {};
  constructor(
    @Optional()
    @SkipSelf()
    parentModule: CoreModule,
    private _router: Router,
    private _httpService: HttpService,
    private _coreService: CoreService
  ) {
    if (parentModule) {
      throw new Error('CoreModule is already loaded. Import it in the AppModule only');
    }

    Store.set('author', 'alsmile123@qq.com');

    // 监听用户认证
    Store.subscribe('auth', (ret: any) => {
      // 认证失败
      if (ret === -1) {
        this._coreService.removeToken();
        Store.set('user', null);
      }
    });

    // 监听是否需要重定向
    Store.subscribe('redirect', (ret: string) => {
      if (ret) {
        this._router.navigateByUrl(ret);
      }
    });

    this.onProfile();
  }

  static forRoot(): ModuleWithProviders {
    return {
      ngModule: CoreModule,
      providers: []
    };
  }

  initWebsocket() {
    // 连接websocket
    const wsUrl: string = (location.protocol === 'http:' ? 'ws://' : 'wss://') + location.host + '/ws';
    this.socket = new WebSocket(wsUrl);
    Store.set('socket', this.socket);
    Store.set('socketCallback', this.socketCallback);
    this.socket.onmessage = (e: any) => {
      if (!e || !e.data) {
        return;
      }

      try {
        const msg: any = JSON.parse(e.data);
        if (msg && this.socketCallback[msg.cb]) {
          this.socketCallback[msg.cb](msg);
        }
      } catch (error) {
      }
    };

    this.socket.onopen = (event: any) => {
      this.socket.send(JSON.stringify({ event: 'token', data: Cookie.get(environment.token) }));
    };

    this.socket.onclose = (event: any) => {
      console.log('websocket close and reconneting...');
      this.initWebsocket();
    };
  }

  notice(msg) {
    const _noticeService: NoticeService = new NoticeService();
    _noticeService.notice({
      body: msg.message,
      theme: 'system-notice',
      timeout: 999999
    });
  }

  async onProfile(): Promise<void> {
    const ret = await this._httpService.Get('/api/user/profile');
    if (ret.error) {
      return;
    }

    ret.usernamePinyin = this._coreService.getPinyin(ret.username);
    Store.set('user', ret);
  }
}
