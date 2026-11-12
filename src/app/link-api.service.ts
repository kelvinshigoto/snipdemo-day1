import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface ShortLink {
  code: string;
  url: string;
  shortUrl: string;
  hits: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class LinkApiService {
  private readonly linksUrl = '/api/links';

  constructor(private readonly http: HttpClient) {}

  listLinks(): Observable<ShortLink[]> {
    return this.http.get<ShortLink[]>(this.linksUrl);
  }

  createLink(url: string): Observable<ShortLink> {
    return this.http.post<ShortLink>(this.linksUrl, { url });
  }
}
