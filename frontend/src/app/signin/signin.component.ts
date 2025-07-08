import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-signin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './signin.component.html',
  styleUrl: './signin.component.scss'
})
export class SigninComponent {
  email = '';
  password = '';
  isLoading = false;
  errorMessage = '';

  constructor(private authService: AuthService) {}

  async signInWithEmail() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.signInWithEmail(this.email, this.password);
      // Navigation is handled in the auth service
    } catch (error: any) {
      this.errorMessage = this.authService.getErrorMessage(error);
    } finally {
      this.isLoading = false;
    }
  }

  async signInWithGoogle() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.signInWithGoogle();
      // Navigation is handled in the auth service
    } catch (error: any) {
      this.errorMessage = this.authService.getErrorMessage(error);
    } finally {
      this.isLoading = false;
    }
  }
}
