import { Component, OnInit } from '@angular/core';

import { Store } from 'le5le-store';
import { AppService } from './app.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  providers: [AppService],
})
export class AppComponent implements OnInit {
  constructor(private service: AppService) {
    window.addEventListener(
      'message',
      (e: any) => {
        // console.log('addEventListener', e.data);
        if (this[e.data.event]) {
          this[e.data.event](e.data.data);
        }
      });

    parent && parent.postMessage({ loaded: true }, '*');
  }

  async ngOnInit() {
    const data = await this.service.GetConfigs();
    for (const item of data) {
      Store.set('app-' + item.type, item.data.list);
    }

    Store.set('app-cms-loaded', 1);
  }

  configs(configs: any) {
    Store.set('app-configs', configs);
  }
}
