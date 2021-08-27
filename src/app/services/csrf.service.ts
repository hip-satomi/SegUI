import { map, tap } from 'rxjs/operators';
import { of, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

interface TokenResult {
  data: string;
}

@Injectable({
  providedIn: 'root'
})
export class CsrfService {

  constructor(private httpClient: HttpClient) {  }

  token: string;

  getToken(forceNew = false): Observable<string> {
    if (this.token && !forceNew) {
      return of(this.token);
    } else {
      return this.httpClient.get('/omero/api/token/').pipe(
        map((r: TokenResult) => r.data),
        tap(data => console.log(data)),
        // store the token
        tap(data => this.token=data)
      );
    }
  }
}
