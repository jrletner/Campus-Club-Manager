import { Injectable, computed, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { User } from '../models/user.model';
import { API_BASE } from '../tokens/api-base.token';

interface LoginResponse {
  token: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private storageKey = 'ccm.auth';
  private apiBase = (inject(API_BASE, { optional: true }) ?? '/api').replace(
    /\/+$/,
    ''
  );

  token = signal<string | null>(null);
  user = signal<User | null>(null);
  isAdmin = computed(() => !!this.user()?.isAdmin);

  constructor() {
    // lazy init via window fetch isn't available here; rely on interceptor to attach token
    const raw =
      typeof localStorage === 'undefined'
        ? null
        : localStorage.getItem(this.storageKey);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (data?.token && data?.user) {
          this.token.set(data.token);
          this.user.set(data.user);
        }
      } catch {
        // ignore
      }
    }
  }

  async login(
    username: string,
    pin: string
  ): Promise<{ ok: boolean; message?: string }> {
    try {
      if (!/^\d{4}$/.test(pin)) {
        return { ok: false, message: 'PIN must be exactly 4 digits' };
      }
      const res = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.apiBase}/auth/login`, {
          username,
          pin,
        })
      );
      this.token.set(res.token);
      this.user.set(res.user);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(res));
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.error?.error ?? 'Login failed' };
    }
  }

  logout(): void {
    this.token.set(null);
    this.user.set(null);
    if (typeof localStorage !== 'undefined')
      localStorage.removeItem(this.storageKey);
    // Send user to login explicitly to avoid showing protected lists
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  // Update the current user and persist alongside the existing token
  setUser(user: User) {
    this.user.set(user);
    if (typeof localStorage !== 'undefined') {
      const token = this.token();
      if (token) {
        localStorage.setItem(this.storageKey, JSON.stringify({ token, user }));
      }
    }
  }
}
