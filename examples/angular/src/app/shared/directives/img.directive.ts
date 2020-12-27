import { OnInit, Directive, Input, Renderer2, ElementRef } from '@angular/core';
import { Cookie } from 'le5le-store';

import { environment } from 'src/environments/environment';

@Directive({
  selector: '[appImgAuthSrc]'
})
export class ImageAuthDirective implements OnInit {
  @Input() appImgAuthSrc = '';
  constructor(private el: ElementRef, private renderer: Renderer2) { }

  ngOnInit() {
    this.renderer.setAttribute(
      this.el.nativeElement,
      'src',
      `${this.appImgAuthSrc}?Authorization=${Cookie.get(environment.token)}`
    );
  }
}
