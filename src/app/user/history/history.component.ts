import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { Store } from 'le5le-store';
import { NoticeService } from 'le5le-components/notice';

import { UserHistoryService } from './history.service';
import { CoreService } from 'src/app/core/core.service';

@Component({
  selector: 'app-user-history',
  templateUrl: 'history.component.html',
  styleUrls: ['./history.component.scss'],
  providers: [UserHistoryService],
  host: {
    '(document:mousedown)': 'onclickDocument()'
  }
})
export class UserHistoryComponent implements OnInit, OnDestroy {
  name = '';
  search = {
    fileId: '',
    pageIndex: 1,
    pageCount: 5
  };
  data = {
    list: [],
    count: 0
  };
  loading = true;

  user: any;
  subUser: any;
  isVip = false;
  showVip = false;

  desc = '';
  edited: any = {};

  subRoute: any;
  constructor(
    private service: UserHistoryService,
    private router: Router,
    private activateRoute: ActivatedRoute,
    private coreService: CoreService
  ) {}

  ngOnInit() {
    this.user = Store.get('user');
    this.subUser = Store.subscribe('user', (user: any) => {
      this.user = user;
      this.isVip = this.coreService.isVip(this.user);
    });

    this.isVip = this.coreService.isVip(this.user);

    this.subRoute = this.activateRoute.queryParamMap.subscribe(params => {
      this.name = params.get('name');
      this.search.fileId = params.get('id');
      this.search.pageIndex = +params.get('pageIndex') || 1;
      this.search.pageCount = +params.get('pageCount') || 5;
      this.list();
    });
  }

  async list(pageIndex?: number) {
    if (pageIndex > 0) {
      this.search.pageIndex = pageIndex;
    }

    this.loading = true;
    this.data = await this.service.List(this.search);
    this.loading = false;
  }

  onOpen(item: any) {
    this.router.navigate(['/workspace'], {
      queryParams: {
        id: item.id
      }
    });
  }

  onEditDesc(event: MouseEvent, item: any) {
    event.stopPropagation();

    this.desc = item.desc;
    item.edited = true;
    this.edited = item;
  }

  onclickDocument() {
    this.edited.edited = false;
  }

  onEnterDesc(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.keyCode !== 13) {
      return;
    }
    if (e.ctrlKey) {
      this.desc += '\n';
      return;
    }

    this.onSubmitDesc(!this.desc);
  }

  async onSubmitDesc(invalid: boolean) {
    if (invalid) {
      return;
    }

    if (
      !(await this.service.Patch({
        id: this.edited.id,
        desc: this.desc
      }))
    ) {
      return;
    }

    this.edited.desc = this.desc;
    this.edited.edited = false;
  }

  onDel(item: any) {
    const noticeService: NoticeService = new NoticeService();
    noticeService.dialog({
      title: '删除历史',
      theme: '',
      body: '确定删除此历史文件，将不可恢复？',
      callback: async (ret: boolean) => {
        if (ret && (await this.service.Del(item.id))) {
          noticeService.notice({
            body: '删除成功！',
            theme: 'success'
          });
          this.list();
          this.service.DelImage(item.image);
        }
      }
    });
  }

  ngOnDestroy() {
    this.subUser.unsubscribe();
    this.subRoute.unsubscribe();
  }
}
