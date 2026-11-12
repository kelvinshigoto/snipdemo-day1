import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AppComponent } from './app.component';
import { LinkApiService, ShortLink } from './link-api.service';

describe('AppComponent', () => {
  const link: ShortLink = {
    code: 'a1B2c3',
    url: 'https://example.com/article',
    shortUrl: 'http://localhost:3000/a1B2c3',
    hits: 0,
    createdAt: '2026-01-01T00:00:00.000Z'
  };
  let api: jasmine.SpyObj<LinkApiService>;
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<LinkApiService>('LinkApiService', ['listLinks', 'createLink']);
    api.listLinks.and.returnValue(of([]));
    api.createLink.and.returnValue(of(link));

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: LinkApiService, useValue: api }]
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
  });

  it('validates HTTP and HTTPS URLs before submitting', () => {
    const component = fixture.componentInstance;
    component.urlControl.setValue('ftp://example.com');
    component.submitLink();

    expect(component.urlControl.hasError('httpUrl')).toBeTrue();
    expect(api.createLink).not.toHaveBeenCalled();
  });

  it('creates a link and refreshes the list', () => {
    api.listLinks.and.returnValue(of([link]));
    const component = fixture.componentInstance;
    component.urlControl.setValue(link.url);
    component.submitLink();

    expect(api.createLink).toHaveBeenCalledWith(link.url);
    expect(api.listLinks).toHaveBeenCalledTimes(2);
    expect(component.links()).toEqual([link]);
    expect(component.successLink()).toEqual(link);
  });

  it('shows API errors inline and re-enables submission', () => {
    api.createLink.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { error: 'Invalid URL' } }))
    );
    const component = fixture.componentInstance;
    component.urlControl.setValue('https://example.com');
    component.submitLink();

    expect(component.submitError()).toBe('Invalid URL');
    expect(component.submitting()).toBeFalse();
  });
});
