import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '@angular/fire/auth';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-account-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './account-management.component.html',
  styleUrl: './account-management.component.scss'
})
export class AccountManagementComponent {
  @Input() isOpen = false;
  @Input() currentUser: User | null = null;
  @Output() closeModal = new EventEmitter<void>();

  // Form data
  displayName = '';
  isEditingName = false;
  isSaving = false;
  isDeleting = false;
  showDeleteConfirmation = false;
  showDeleteSuccess = false;
  deleteConfirmationText = '';
  error: string | null = null;
  successMessage: string | null = null;

  constructor(private authService: AuthService) {}

  ngOnInit() {
    if (this.currentUser) {
      this.displayName = this.currentUser.displayName || '';
    }
  }

  ngOnChanges() {
    if (this.currentUser) {
      this.displayName = this.currentUser.displayName || '';
    }
    if (this.isOpen) {
      this.resetForm();
    }
  }

  resetForm() {
    this.isEditingName = false;
    this.isSaving = false;
    this.isDeleting = false;
    this.showDeleteConfirmation = false;
    this.showDeleteSuccess = false;
    this.deleteConfirmationText = '';
    this.error = null;
    this.successMessage = null;
    this.displayName = this.currentUser?.displayName || '';
  }

  close() {
    this.resetForm();
    this.closeModal.emit();
  }

  startEditingName() {
    this.isEditingName = true;
    this.error = null;
    this.successMessage = null;
  }

  cancelEditingName() {
    this.isEditingName = false;
    this.displayName = this.currentUser?.displayName || '';
    this.error = null;
  }

  async saveDisplayName() {
    if (!this.displayName.trim()) {
      this.error = 'Display name cannot be empty';
      return;
    }

    this.isSaving = true;
    this.error = null;

    try {
      await this.authService.updateDisplayName(this.displayName.trim());
      this.successMessage = 'Display name updated successfully';
      this.isEditingName = false;
    } catch (error: any) {
      console.error('Error updating display name:', error);
      this.error = error.message || 'Failed to update display name';
    } finally {
      this.isSaving = false;
    }
  }

  showDeleteDialog() {
    this.showDeleteConfirmation = true;
    this.deleteConfirmationText = '';
    this.error = null;
  }

  cancelDelete() {
    this.showDeleteConfirmation = false;
    this.deleteConfirmationText = '';
    this.error = null;
  }

  async deleteAccount() {
    if (this.deleteConfirmationText !== 'DELETE') {
      this.error = 'Please type "DELETE" to confirm account deletion';
      return;
    }

    this.isDeleting = true;
    this.error = null;

    try {
      await this.authService.deleteAccount();
      
      // Show success message
      this.isDeleting = false;
      this.showDeleteConfirmation = false;
      this.showDeleteSuccess = true;
      
      // Redirect to home page after 3 seconds
      setTimeout(() => {
        window.location.href = '/home';
      }, 3000);
      
    } catch (error: any) {
      console.error('Error deleting account:', error);
      this.error = error.message || 'Failed to delete account. You may need to sign in again.';
      this.isDeleting = false;
    }
  }

  getUserInitials(): string {
    if (!this.currentUser) return 'U';
    
    const name = this.currentUser.displayName || this.currentUser.email || 'User';
    return name.split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }

  getJoinDate(): string {
    if (!this.currentUser?.metadata?.creationTime) return 'Unknown';
    
    const date = new Date(this.currentUser.metadata.creationTime);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  clearMessages() {
    this.error = null;
    this.successMessage = null;
  }
} 