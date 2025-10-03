import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ClubService } from '../services/club.service';
import { AuthService } from '../services/auth.service';

// Maps HTTP errors to friendly messages and surfaces them via ClubService.error
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const svc = inject(ClubService);
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((err: unknown) => {
      let msg = 'Something went wrong';
      if (err instanceof HttpErrorResponse) {
        if (err.status === 0) msg = 'Network error — check your connection';
        else if (err.status === 401) {
          // If unauthorized (and not the login call), force logout and redirect
          if (!req.url.includes('/auth/login')) {
            auth.logout();
          }
          msg = 'Please sign in to continue';
        } else if (err.status >= 500) msg = 'Server error — please try again';
        else if (err.status === 404) msg = 'Not found';
        else if (err.status === 400) msg = 'Invalid request';
        else msg = err.message || msg;
      }
      svc.error.set(msg);
      return throwError(() => err);
    })
  );
};
