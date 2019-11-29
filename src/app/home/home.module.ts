import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { ContextMenuComponent } from './context-menu/context-menu.component';
import { HomeRoutingModule } from './home-routing.module';
import { HomeComponent } from './home.component';
import { PropsComponent } from './props/props.component';
import { TopologyService } from './topology.service';


@NgModule({
  imports: [SharedModule, HomeRoutingModule],
  declarations: [HomeComponent, PropsComponent, ContextMenuComponent],
  providers: [TopologyService]
})
export class HomeModule { }
