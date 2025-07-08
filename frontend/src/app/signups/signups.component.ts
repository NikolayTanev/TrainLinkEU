import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-signups',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './signups.component.html',
  styleUrl: './signups.component.scss'
})
export class SignupsComponent {
  email = '';
  password = '';
  confirmPassword = '';
  isLoading = false;
  errorMessage = '';

  constructor(private authService: AuthService) {}

  async signUpWithEmail() {
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.signUpWithEmail(this.email, this.password);
      // Navigation is handled in the auth service
    } catch (error: any) {
      this.errorMessage = this.authService.getErrorMessage(error);
    } finally {
      this.isLoading = false;
    }
  }

  async signUpWithGoogle() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.signUpWithGoogle();
      // Navigation is handled in the auth service
    } catch (error: any) {
      this.errorMessage = this.authService.getErrorMessage(error);
    } finally {
      this.isLoading = false;
    }
  }
}
