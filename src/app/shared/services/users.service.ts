import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { User } from '../models/user.model';
import { API_BASE } from '../tokens/api-base.token';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private http = inject(HttpClient);
  private apiBase = (inject(API_BASE, { optional: true }) ?? '/api').replace(
    /\/+$/,
    ''
  );
  private base = `${this.apiBase}/users`;

  list(): Promise<User[]> {
    return firstValueFrom(this.http.get<User[]>(this.base));
  }
  get(id: string): Promise<User> {
    return firstValueFrom(this.http.get<User>(`${this.base}/${id}`));
  }
  create(input: {
    username: string;
    pin: string;
    isAdmin?: boolean;
  }): Promise<User> {
    return firstValueFrom(this.http.post<User>(this.base, input));
  }
  update(
    id: string,
    changes: Partial<{ username: string; pin: string; isAdmin: boolean }>
  ): Promise<User> {
    return firstValueFrom(this.http.patch<User>(`${this.base}/${id}`, changes));
  }
  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }
}
