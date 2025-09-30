import { Injectable, signal } from '@angular/core';

export type Toast = {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
};

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  #nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  show(t: Omit<Toast, 'id'>) {
    const id = this.#nextId++;
    const toast: Toast = { id, ...t };
    this.toasts.update((list) => [toast, ...list]);
    // auto dismiss
    setTimeout(() => this.dismiss(id), 4000);
  }

  dismiss(id: number) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  clear() {
    this.toasts.set([]);
  }
}
