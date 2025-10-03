import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { ClubService } from './shared/services/club.service';
import { AuthService } from './shared/services/auth.service';
import { FooterComponent } from './shared/layout/footer/footer/footer.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'Campus-Club-Manager';
  clubSvc = inject(ClubService);
  authSvc = inject(AuthService);
  private router = inject(Router);
  isHome = signal(true);
  private currentUrl = signal<string>('');
  showPin = false;

  // Dyanmic page summary text showin in the subheader
  pageSummy = computed(() => {
    const url = this.currentUrl();
    if (!url) return '';
    if (url === '/' || url.startsWith('/?')) {
      return 'Welcome! Use search and filters to explore clubs';
    }
    if (url.startsWith('/clubs/new')) {
      return 'Create a new club: name it, set capacity, and add it to your directory.';
    }
    if (/^\/clubs\/.+\/edit/.test(url)) {
      return 'Edit club details and manage its settings.';
    }
    if (/^\/clubs\/.+/.test(url)) {
      return 'View club details, manage members, and add events.';
    }
    if (url.startsWith('/tools')) {
      return 'Import, export, or reset your data. Preview the JSON before downloading.';
    }
    return 'Explore and manage your campus clubs.';
  });

  constructor() {
    // Activated once router is configure (Class 18). Safe now; no events until then
    this.router.events.subscribe((ev) => {
      if (ev instanceof NavigationEnd) {
        const url = ev.urlAfterRedirects || ev.url;
        this.isHome.set(url === '/' || url.startsWith('/?'));
        this.currentUrl.set(url);
      }
    });
  }

  onRetry() {
    this.clubSvc.load();
  }

  onLogout() {
    this.authSvc.logout();
  }
}
