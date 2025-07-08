import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { User } from '@angular/fire/auth';

@Component({
  selector: 'app-mobile-nav',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Mobile Header -->
    <div class="mobile-header">
      <button class="mobile-menu-btn" (click)="toggleMenu()" aria-label="Toggle menu">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <div class="mobile-logo" (click)="navigateTo('/home')">
        <img src="assets/logo.png" alt="TrainLink Logo" class="logo-image">
        <span class="logo-text">TrainLink</span>
      </div>
      <div class="mobile-user" *ngIf="user">
        <div class="user-avatar" (click)="onUserClick()">
          <span>{{ getInitials(user?.displayName || user?.email || '') }}</span>
        </div>
      </div>
    </div>

    <!-- Mobile Overlay -->
    <div class="mobile-overlay" [class.active]="isMenuOpen" (click)="closeMenu()"></div>

    <!-- Mobile Menu -->
    <nav class="mobile-menu" [class.active]="isMenuOpen">
      <div class="mobile-menu-header">
        <div class="menu-logo">
          <img src="assets/logo.png" alt="TrainLink Logo" class="logo-image">
          <span class="logo-text">TrainLink</span>
        </div>
        <button class="mobile-close-btn" (click)="closeMenu()" aria-label="Close menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="mobile-menu-nav">
        <div class="nav-item" [class.active]="currentPage === 'dashboard'" (click)="navigateTo('/dashboard')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="7" height="9"/>
            <rect x="14" y="3" width="7" height="5"/>
            <rect x="14" y="12" width="7" height="9"/>
            <rect x="3" y="16" width="7" height="5"/>
          </svg>
          <span>Dashboard</span>
        </div>

        <div class="nav-item" [class.active]="currentPage === 'home'" (click)="navigateTo('/home')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
          <span>Home</span>
        </div>

        <div class="nav-item" (click)="onSignOut()" *ngIf="user">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16,17 21,12 16,7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Sign Out</span>
        </div>
      </div>

      <div class="mobile-menu-footer" *ngIf="user">
        <div class="user-info" (click)="onUserClick()">
          <div class="user-avatar">
            <img *ngIf="user?.photoURL" [src]="user.photoURL" [alt]="user?.displayName || 'User'">
            <span *ngIf="!user?.photoURL">{{ getInitials(user?.displayName || user?.email || 'U') }}</span>
          </div>
          <div class="user-details">
            <span class="user-name">{{ user?.displayName || 'User' }}</span>
            <span class="user-email">{{ user?.email }}</span>
          </div>
        </div>
      </div>
    </nav>
  `,
  styleUrls: ['./mobile-nav.component.scss']
})
export class MobileNavComponent {
  @Input() user: User | null = null;
  @Input() currentPage: string = '';
  @Output() userAction = new EventEmitter<string>();
  
  isMenuOpen = false;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
    this.closeMenu();
  }

  onUserClick() {
    this.userAction.emit('account');
    this.closeMenu();
  }

  async onSignOut() {
    try {
      await this.authService.signOut();
      this.closeMenu();
    } catch (error) {
      console.error('Sign out error:', error);
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
} 