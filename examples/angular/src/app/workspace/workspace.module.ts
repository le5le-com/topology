import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { WorkspaceHeaderComponent } from './header/header.component';
import { ContextMenuComponent } from './context-menu/context-menu.component';
import { WorkspaceRoutingModule } from './workspace-routing.module';
import { WorkspaceComponent } from './workspace.component';
import { FilePropsComponent } from './fileProps/fileProps.component';
import { PenPropsComponent } from './penProps/penProps.component';
import { ToolsComponent } from './tools/tools.component';
import { PenTreeItemComponent } from './penProps/tree-item/tree-item.component';

@NgModule({
  imports: [SharedModule, WorkspaceRoutingModule],
  declarations: [
    WorkspaceHeaderComponent,
    WorkspaceComponent,
    FilePropsComponent,
    PenPropsComponent,
    ContextMenuComponent,
    ToolsComponent,
    PenTreeItemComponent,
  ]
})
export class WorkspaceModule { }
