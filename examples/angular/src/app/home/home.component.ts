import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

import { Store } from 'le5le-store';
import { HomeService } from './home.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.component.html',
  styleUrls: ['./home.component.scss'],
  providers: [HomeService]
})
export class HomeComponent implements OnInit, OnDestroy {
  search = {
    text: '',
    class: ''
  };
  pageIndex = 1;
  pageCount = 10;
  searched = false;

  cms = {
    bars: [],
    classes: [],
    vision: []
  };

  curBar = 0;
  inBar = false;

  timer: any;
  subCms: any;
  subConfigs: any;
  constructor(private service: HomeService, private router: Router) {
  }

  async ngOnInit() {
    this.subConfigs = Store.subscribe('app-configs', (configs: any) => {
      if (configs && configs.homeUrl) {
        this.router.navigateByUrl(configs.homeUrl);
      }
    });

    this.cms = this.service.Configs();
    this.subCms = Store.subscribe('app-cms-loaded', () => {
      if (!Store.get('app-bars')) {
        return;
      }

      this.cms.bars = Store.get('app-bars');
      this.cms.classes = Store.get('app-classes');
      this.cms.vision = Store.get('app-vision');

      for (const item of this.cms.bars) {
        item.styles = {
          background: item.bkColor
        };
      }
    });

    this.timer = setInterval(() => {
      if (this.cms.bars && this.cms.bars.length && !this.inBar) {
        this.curBar = (this.curBar + 1) % this.cms.bars.length;
      }
    }, 10000);
  }

  onMouseEnter() {
    this.inBar = true;
  }

  onMouseOut() {
    this.inBar = false;
  }



  onOpen(item: any) {
    this.router.navigate(['/workspace'], {
      queryParams: {
        id: item.id
      }
    });
  }

  ngOnDestroy() {
    clearInterval(this.timer);
    this.subCms && this.subCms.unsubscribe();
    this.subConfigs && this.subConfigs.unsubscribe();
  }
}
