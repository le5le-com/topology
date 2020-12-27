import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { Store } from 'le5le-store';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Input() theme = '';

  menuClicked = false;
  search = '';
  search$ = new Subject<string>();

  menus: any[] = [{
    name: '解决方案',
    router: '/search'
  }, {
    name: '入门教程',
    url: 'https://www.yuque.com/alsmile/topology/use'
  }, {
    name: '服务与支持',
    url: 'https://www.yuque.com/alsmile/topology/aboutus'
  }];

  subRoute: any;
  subConfigs: any;
  constructor(private router: Router, private activateRoute: ActivatedRoute) {
  }

  ngOnInit() {
    this.subConfigs = Store.subscribe('app-configs', (configs: any) => {
      if (configs && configs.menus) {
        this.menus = configs.menus;
      }
    });

    this.subRoute = this.activateRoute.queryParamMap.subscribe(params => {
      this.search = params.get('q') || '';
    });

    this.search$
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(text => {
        this.onSearch(text);
      });
  }

  onClickMenu(event: MouseEvent) {
    if ((event.target as HTMLElement).nodeName === 'A') {
      let node = (event.target as HTMLElement).parentElement;
      let isDropdown = false;
      let disabled = false;
      while (node) {
        if (node.className.indexOf('dropdown') > -1) {
          isDropdown = true;
        }
        if (node.className.indexOf('disabled') > -1) {
          disabled = true;
          break;
        }
        node = node.parentElement;
      }

      if (disabled) {
        return;
      }

      if (isDropdown) {
        this.menuClicked = true;
        setTimeout(() => {
          this.menuClicked = false;
        }, 500);
      }
    }
  }

  onSearch(text: string) {
    this.router.navigate(['/', 'search'], {
      queryParams: {
        q: text,
        c: this.activateRoute.snapshot.queryParamMap.get('c')
      }
    });
  }

  ngOnDestroy() {
    this.search$.unsubscribe();
    this.subRoute.unsubscribe();
    this.subConfigs.unsubscribe();
  }
}
