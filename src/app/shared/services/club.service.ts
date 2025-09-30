import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { API_BASE } from '../tokens/api-base.token';
import { Club, seatsLeft, toPlainClub } from '../models/club.model';
import { EventItem } from '../models/event-item.model';
import { AuthService } from './auth.service';
import { Member } from '../models/member.model';

type SortBy = 'name-asc' | 'name-desc' | 'seats-desc' | 'capacity-desc';

@Injectable({
  providedIn: 'root',
})
export class ClubService {
  #http = inject(HttpClient);
  #api = inject(API_BASE);
  #authSvc = inject(AuthService);

  // Data + status
  readonly #clubs = signal<Club[]>([]);
  readonly clubs = computed(() => this.#clubs());
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // Filters
  readonly searchText = signal('');
  readonly onlyOpen = signal(false);
  readonly sortBy = signal<SortBy>('name-asc');

  // Derived visible list
  readonly visible = computed(() => {
    let list = this.#clubs();
    const q = this.searchText().trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));
    if (this.onlyOpen()) list = list.filter((c) => seatsLeft(c) > 0);
    switch (this.sortBy()) {
      case 'name-asc':
        list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        list = [...list].sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'seats-desc':
        list = [...list].sort((a, b) => seatsLeft(b) - seatsLeft(a));
        break;
      case 'capacity-desc':
        list = [...list].sort((a, b) => b.capacity - a.capacity);
        break;
    }
    return list;
  });

  load() {
    this.loading.set(true);
    this.error.set(null);

    return this.#http.get<Club[]>(`${this.#api}/clubs`).subscribe({
      next: (list) => {
        this.#clubs.set(list);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(e?.message || 'Failed to load clubs');
        this.loading.set(false);
      },
    });
  }

  setClubs(list: Club[]) {
    this.#clubs.set(list);
  }

  getById(id: string) {
    return this.#clubs().find((c) => c.id === id) || null;
  }

  fetchClub(id: string) {
    return this.#http.get<Club>(`${this.#api}/clubs/${id}`);
  }

  exportAll(): Club[] {
    return this.#clubs().map(toPlainClub);
  }

  importAll(list: Club[]) {
    this.#clubs.set(list.map(toPlainClub));
  }

  resetToSeed() {
    return this.#http.post<Club[]>(`${this.#api}/reset`, {}).subscribe((l) => {
      this.#clubs.set(l);
    });
  }

  addEvent(
    clubId: string,
    payload: {
      title: string;
      dateIso: string;
      capacity: number;
      description: string;
    }
  ): { ok: true } | { ok: false; message?: string } {
    const cur = this.getById(clubId);
    if (!cur) return { ok: false, message: 'Club not found' };
    const newEvent: EventItem = {
      id: `e-${Date.now()}`,
      title: payload.title.trim(),
      dateIso: payload.dateIso,
      capacity: Math.max(1, payload.capacity),
      description: payload.description?.trim() || '',
    };

    const next: Club = { ...cur, events: [newEvent, ...cur.events] };
    // optimistic update; server rules allow: admin or non-admin adding exactly one event
    this.#updateLocal(next);
    this.#http
      .put(`${this.#api}/clubs/${clubId}`, toPlainClub(next))
      .subscribe({
        error: () => {
          this.#updateLocal(cur);
        },
      });
    return { ok: true };
  }

  holdSpot(clubId: string): { ok: true } | { ok: false; message?: string } {
    const cur = this.getById(clubId);
    const user = this.#authSvc.user();
    if (!cur || !user) return { ok: false, message: 'Not allowed' };
    if (seatsLeft(cur) <= 0) return { ok: false, message: 'At capacity' };
    if (cur.members.some((m) => m.id === user.id))
      return { ok: false, message: 'Already held' };
    const next: Club = {
      ...cur,
      members: [
        ...cur.members,
        { id: user.id, name: user.username } satisfies Member,
      ],
    };
    this.#updateLocal(next);
    this.#http
      .patch(`${this.#api}/clubs/${clubId}`, { members: next.members })
      .subscribe({
        error: () => this.#updateLocal(cur),
      });
    return { ok: true };
  }

  giveUpSpot(clubId: string): { ok: true } | { ok: false; message?: string } {
    const cur = this.getById(clubId);
    const user = this.#authSvc.user();
    if (!cur || !user) return { ok: false, message: 'Not allowed' };
    if (!cur.members.some((m) => m.id === user.id))
      return { ok: false, message: 'No spot held' };
    const next: Club = {
      ...cur,
      members: cur.members.filter((m) => m.id !== user.id),
    };
    this.#updateLocal(next);
    this.#http
      .patch(`${this.#api}/clubs/${clubId}`, { members: next.members })
      .subscribe({
        error: () => this.#updateLocal(cur),
      });
    return { ok: true };
  }

  addMember(clubId: string, member: Member) {
    const cur = this.getById(clubId);
    if (!cur) return;
    const next: Club = { ...cur, members: [member, ...cur.members] };
    this.#updateLocal(next);
  }

  removeMember(clubId: string, memberId: string) {
    const cur = this.getById(clubId);
    if (!cur) return;
    const next: Club = {
      ...cur,
      members: cur.members.filter((m) => m.id !== memberId),
    };
  }
  removeEvent(clubId: string, eventId: string) {
    const cur = this.getById(clubId);
    if (!cur) return;
    const next: Club = {
      ...cur,
      events: cur.events.filter((e) => e.id !== eventId),
    };
  }

  #updateLocal(next: Club) {
    this.#clubs.update((list) =>
      list.map((c) => (c.id === next.id ? next : c))
    );
  }
}
