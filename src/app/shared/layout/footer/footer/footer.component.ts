import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  imports: [],
  template: ` <footer class="footer">© {{ year }} Campus Club Manager</footer>`,
  styles: `
  [
    .footer {
      margin-top: 2rem;
      padding: 1rem 0;
      color: #666;
      border-top: 1px solid #eee;
      text-algin: center;
    }
  ]
  `,
})
export class FooterComponent {
  year = new Date().getFullYear();
}
