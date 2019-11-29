import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { Store } from 'le5le-store';
import { NoticeService } from 'le5le-components/notice';

import { UserFavoriteService } from './favorite.service';

@Component({
  selector: 'app-user-favorite',
  templateUrl: 'favorite.component.html',
  styleUrls: ['./favorite.component.scss'],
  providers: [UserFavoriteService]
})
export class UserFavoriteComponent implements OnInit, OnDestroy {
  search = {
    desc: '',
    user: '',
    pageIndex: 1,
    pageCount: 8
  };
  data = {
    list: [],
    count: 0
  };
  loading = true;

  subRoute: any;
  constructor(private service: UserFavoriteService, private router: Router, private activateRoute: ActivatedRoute) {}

  ngOnInit() {
    this.subRoute = this.activateRoute.queryParamMap.subscribe(params => {
      this.search.pageIndex = +params.get('pageIndex') || 1;
      this.search.pageCount = +params.get('pageCount') || 8;
      this.list();
    });
  }

  async list(pageIndex?: number) {
    if (pageIndex > 0) {
      this.search.pageIndex = pageIndex;
    }

    this.loading = true;
    this.data = await this.service.Topologies(this.search);
    this.loading = false;
  }

  onOpen(item: any) {
    this.router.navigate(['/workspace'], {
      queryParams: {
        id: item.id
      }
    });
  }

  async onFavorite(event: MouseEvent, item: any) {
    event.stopPropagation();

    item.favorited = true;
    if (await this.service.Favorite(item)) {
      this.list();
    }
  }

  onStar(event: MouseEvent, item: any) {
    event.stopPropagation();

    this.service.Star(item);
  }

  ngOnDestroy() {
    this.subRoute.unsubscribe();
  }
}
