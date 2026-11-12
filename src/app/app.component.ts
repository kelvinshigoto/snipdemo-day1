import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { LinkApiService, ShortLink } from './link-api.service';

function isHttpUrl(control: AbstractControl): ValidationErrors | null {
  const value = typeof control.value === 'string' ? control.value.trim() : '';
  if (!value) return null;

  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !!url.hostname ? null : { httpUrl: true };
  } catch {
    return { httpUrl: true };
  }
}

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  readonly linkForm = new FormGroup({
    url: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, isHttpUrl]
    })
  });
  readonly links = signal<ShortLink[]>([]);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly listError = signal('');
  readonly submitError = signal('');
  readonly successLink = signal<ShortLink | null>(null);

  constructor(private readonly linkApi: LinkApiService) {}

  get urlControl(): FormControl<string> {
    return this.linkForm.controls.url;
  }

  ngOnInit(): void {
    this.refreshLinks();
  }

  submitLink(): void {
    if (this.submitting()) return;
    if (this.linkForm.invalid) {
      this.linkForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.submitError.set('');
    this.successLink.set(null);

    this.linkApi.createLink(this.urlControl.value.trim()).subscribe({
      next: (link) => {
        this.successLink.set(link);
        this.linkForm.reset();
        this.submitting.set(false);
        this.refreshLinks();
      },
      error: (error: unknown) => {
        this.submitError.set(this.errorMessage(error, 'Could not shorten that link. Please try again.'));
        this.submitting.set(false);
      }
    });
  }

  refreshLinks(): void {
    this.loading.set(true);
    this.listError.set('');
    this.linkApi.listLinks().subscribe({
      next: (links) => {
        this.links.set(links);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.listError.set(this.errorMessage(error, 'Could not load your links. Please try again.'));
        this.loading.set(false);
      }
    });
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const body: unknown = error.error;
      if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
        return body.error;
      }
      if (error.status === 0) return 'Cannot reach Snip right now. Check your connection and try again.';
    }
    return fallback;
  }
}
