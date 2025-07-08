import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';
import { User } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'trainlink-frontend';
  currentUser: User | null = null;
  showNavbar = true; // Show navbar by default
  private authSubscription?: Subscription;
  private routerSubscription?: Subscription;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    // Subscribe to auth state changes
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    // Subscribe to route changes to determine when to show navbar
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event) => {
        // Show navbar only on home, signin, and signup pages
        const publicRoutes = ['/home', '/signin', '/signup', '/'];
        this.showNavbar = publicRoutes.includes((event as NavigationEnd).url);
      });

    // Set initial navbar visibility based on current route
    const currentUrl = this.router.url;
    const publicRoutes = ['/home', '/signin', '/signup', '/'];
    this.showNavbar = publicRoutes.includes(currentUrl);
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    
    // If it's an email, use the first letter of the email
    if (name.includes('@')) {
      return name.charAt(0).toUpperCase();
    }
    
    // If it's a display name, use first letters of first and last name
    const nameParts = name.trim().split(' ');
    if (nameParts.length >= 2) {
      return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
    }
    
    return nameParts[0].charAt(0).toUpperCase();
  }

  async signOut() {
    try {
      await this.authService.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }
}
