import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-pen-tree-item',
  templateUrl: './tree-item.component.html',
  styleUrls: ['./tree-item.component.scss']
})
export class PenTreeItemComponent implements OnInit {
  @Input() pen: any;
  @Output() selected = new EventEmitter<any>();
  constructor() { }

  ngOnInit() {
  }

  onClick(pen: any) {
    pen.opened = !pen.opened;
    this.selected.emit(pen);
  }

  onSelect(pen: any) {
    this.selected.emit(pen);
  }
}
