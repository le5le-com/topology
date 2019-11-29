import { NgModule } from '@angular/core';

import { SharedModule } from '../shared/shared.module';
import { UserRoutingModule } from './user-routing.module';
import { UserComponent } from './user.component';
import { UserHomeComponent } from './home/home.component';
import { UserFavoriteComponent } from './favorite/favorite.component';
import { UserHistoryComponent } from './history/history.component';

@NgModule({
  imports: [SharedModule, UserRoutingModule],
  declarations: [UserComponent, UserHomeComponent, UserFavoriteComponent, UserHistoryComponent]
})
export class UserModule {}
