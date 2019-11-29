import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NodePropsComponent } from './props.component';

describe('NodePropsComponent', () => {
  let component: NodePropsComponent;
  let fixture: ComponentFixture<NodePropsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [NodePropsComponent]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NodePropsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
