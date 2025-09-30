import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { API_BASE } from '../tokens/api-base.token';
import { User } from '../models/user.model';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  #http = inject(HttpClient);
  #api = inject(API_BASE);

  readonly #token = signal<string | null>(null);
  readonly #user = signal<User | null>(null);

  readonly isLoggedIn = computed(() => !!this.#token());
  readonly user = computed(() => this.#user());

  token() {
    return this.#token();
  }

  setToken(token: string | null) {
    this.#token.set(token);
  }

  setUser(user: User | null) {
    this.#user.set(user);
  }

  async login(username: string, pin: string) {
    const res = await firstValueFrom(
      this.#http.post<{ token: string; user: User }>(`${this.#api}/login`, {
        username,
        pin,
      })
    );

    if (res) {
      this.setToken(res.token);
      this.setUser(res.user);
    }
  }

  logout() {
    this.setToken(null);
    this.setUser(null);
  }
}
