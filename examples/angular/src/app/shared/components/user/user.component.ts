import { Component, OnInit, Input } from '@angular/core';

import { Store } from 'le5le-store';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserComponent implements OnInit {
  @Input() transparent = false;

  user: any;
  urls = environment.urls;
  constructor() { }

  ngOnInit() {
    Store.subscribe('user', (user: any) => {
      this.user = user;
    });
  }

  onSignup() {
    location.href = `${environment.urls.account}?signup=true`;
  }

  onLogin() {
    location.href = `${environment.urls.account}?cb=${encodeURIComponent(location.href)}`;
  }

  onSignout() {
    Store.set('auth', -1);
  }

}
