import { NgModule } from '@angular/core';
import { Routes, RouterModule, PreloadAllModules } from '@angular/router';

import { HotComponent } from './hot/hot.component';

const routes: Routes = [
  { path: '', component: HotComponent, pathMatch: 'full' },
  { path: 'workspace', loadChildren: './home/home.module#HomeModule' },
  { path: 'user', loadChildren: './user/user.module#UserModule' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
