import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'danger';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  timeoutMs: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);

  show(type: ToastType, message: string, timeoutMs = 3500) {
    const id = crypto.randomUUID();
    const toast: Toast = { id, type, message, timeoutMs };
    this.toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(id), timeoutMs);
    return id;
  }

  success(message: string, timeoutMs?: number) {
    return this.show('success', message, timeoutMs);
  }

  error(message: string, timeoutMs?: number) {
    return this.show('error', message, timeoutMs ?? 4500);
  }

  info(message: string, timeoutMs?: number) {
    return this.show('info', message, timeoutMs);
  }

  danger(message: string, timeoutMs?: number) {
    return this.show('danger', message, timeoutMs);
  }

  dismiss(id: string) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  clear() {
    this.toasts.set([]);
  }
}
