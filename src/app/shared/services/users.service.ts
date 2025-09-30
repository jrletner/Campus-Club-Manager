import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE } from '../tokens/api-base.token';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  #http = inject(HttpClient);
  #api = inject(API_BASE);

  getAll() {
    return this.#http.get<User[]>(`${this.#api}/users`);
  }
}
