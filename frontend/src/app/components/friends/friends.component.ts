import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Subject } from 'rxjs';

import { FriendService } from '../../services/friend.service';
import { AuthService } from '../../services/auth.service';
import { FriendRequest, FriendSearchResult, UserProfile } from '../../models/friend.model';

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './friends.component.html',
  styleUrl: './friends.component.scss'
})
export class FriendsComponent implements OnInit, OnDestroy {
  
  // Search functionality
  searchTerm = '';
  searchResults: FriendSearchResult[] = [];
  isSearching = false;
  searchError = '';
  private searchSubject = new Subject<string>();

  // Friend requests
  incomingRequests: FriendRequest[] = [];
  outgoingRequests: FriendRequest[] = [];
  isLoadingRequests = false;

  // Friends list
  friends: UserProfile[] = [];
  isLoadingFriends = false;

  // UI state
  showInviteForm = false;
  inviteEmail = '';
  inviteMessage = '';
  isInviting = false;
  
  // Friend requests collapse state
  isFriendRequestsExpanded = false;
  
  // Friend dropdown menu state
  activeFriendMenu = '';

  private subscriptions: Subscription[] = [];

  constructor(
    private friendService: FriendService,
    private authService: AuthService
  ) {
    // Setup search with debouncing
    this.subscriptions.push(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(term => {
          if (!term.trim()) {
            this.searchResults = [];
            this.isSearching = false;
            return [];
          }
          
          this.isSearching = true;
          this.searchError = '';
          
          return this.friendService.searchUsers(term);
        })
      ).subscribe({
        next: (results) => {
          this.searchResults = results;
          this.isSearching = false;
        },
        error: (error) => {
          console.error('Search error:', error);
          this.searchError = 'Failed to search users. Please try again.';
          this.isSearching = false;
          this.searchResults = [];
        }
      })
    );
  }

  ngOnInit() {
    // Subscribe to auth state changes to load data when user is authenticated
    this.subscriptions.push(
      this.authService.currentUser$.subscribe(user => {
        if (user) {
          // User is authenticated, load friends and requests
          this.loadFriendRequests();
          this.loadFriends();
          // Auto-expand friend requests if there are pending requests
          if (this.incomingRequests.length > 0) {
            this.isFriendRequestsExpanded = true;
          }
        } else {
          // User is not authenticated, clear data
          this.friends = [];
          this.incomingRequests = [];
          this.outgoingRequests = [];
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    // Close friend dropdown menus when clicking outside
    const target = event.target as Element;
    if (target && !target.closest('.friend-dropdown')) {
      this.activeFriendMenu = '';
    }
  }

  // ================ SEARCH METHODS ================

  onSearchInput(term: string) {
    this.searchTerm = term;
    this.searchSubject.next(term);
  }

  clearSearch() {
    this.searchTerm = '';
    this.searchResults = [];
    this.searchError = '';
  }

  // ================ FRIEND REQUEST METHODS ================

  toggleFriendRequests() {
    this.isFriendRequestsExpanded = !this.isFriendRequestsExpanded;
  }

  shouldShowFriendRequests(): boolean {
    return this.isFriendRequestsExpanded || this.incomingRequests.length > 0;
  }

  sendFriendRequest(userId: string) {
    this.subscriptions.push(
      this.friendService.sendFriendRequest(userId).subscribe({
        next: () => {
          this.loadFriendRequests(); // Refresh requests
          // Refresh search results to update relationship status
          if (this.searchTerm.trim()) {
            this.searchSubject.next(this.searchTerm);
          }
        },
        error: (error) => {
          console.error('Failed to send friend request:', error);
          // Show error to user
        }
      })
    );
  }

  acceptFriendRequest(requestId: string) {
    this.subscriptions.push(
      this.friendService.acceptFriendRequest(requestId).subscribe({
        next: () => {
          this.loadFriendRequests();
          this.loadFriends();
          // Refresh search results to update relationship status
          if (this.searchTerm.trim()) {
            this.searchSubject.next(this.searchTerm);
          }
        },
        error: (error) => {
          console.error('Failed to accept friend request:', error);
        }
      })
    );
  }

  declineFriendRequest(requestId: string) {
    this.subscriptions.push(
      this.friendService.declineFriendRequest(requestId).subscribe({
        next: () => {
          this.loadFriendRequests();
          // Refresh search results to update relationship status
          if (this.searchTerm.trim()) {
            this.searchSubject.next(this.searchTerm);
          }
        },
        error: (error) => {
          console.error('Failed to decline friend request:', error);
        }
      })
    );
  }

  private loadFriendRequests() {
    this.isLoadingRequests = true;
    
    this.subscriptions.push(
      this.friendService.getIncomingFriendRequests().subscribe({
        next: (requests) => {
          this.incomingRequests = requests;
          this.isLoadingRequests = false;
        },
        error: (error) => {
          console.error('Failed to load incoming friend requests:', error);
          this.isLoadingRequests = false;
        }
      })
    );
  }

  private loadFriends() {
    console.log('Loading friends list...');
    this.isLoadingFriends = true;
    
    this.subscriptions.push(
      this.friendService.getUserFriends().subscribe({
        next: (friends) => {
          console.log('Friends loaded from service:', friends);
          this.friends = friends;
          this.isLoadingFriends = false;
        },
        error: (error) => {
          console.error('Failed to load friends:', error);
          this.isLoadingFriends = false;
        }
      })
    );
  }

  // ================ FRIEND MANAGEMENT METHODS ================

  toggleFriendMenu(friendId: string) {
    console.log('Toggle friend menu for:', friendId, 'Current active:', this.activeFriendMenu);
    this.activeFriendMenu = this.activeFriendMenu === friendId ? '' : friendId;
    console.log('New active menu:', this.activeFriendMenu);
  }

  removeFriend(friend: UserProfile) {
    if (confirm(`Remove ${friend.displayName || friend.email} from your friends?`)) {
      this.subscriptions.push(
        this.friendService.removeFriend(friend.id).subscribe({
          next: () => {
            console.log('Friend removed successfully');
            this.loadFriends(); // Refresh friends list
            // Refresh search results to update relationship status
            if (this.searchTerm.trim()) {
              this.searchSubject.next(this.searchTerm);
            }
          },
          error: (error: any) => {
            console.error('Failed to remove friend:', error);
            // Show error to user
          }
        })
      );
    }
  }

  // ================ INVITE METHODS ================

  toggleInviteForm() {
    this.showInviteForm = !this.showInviteForm;
    if (!this.showInviteForm) {
      this.inviteEmail = '';
      this.inviteMessage = '';
    }
  }

  sendEmailInvite() {
    if (!this.inviteEmail.trim()) {
      return;
    }

    this.isInviting = true;
    
    this.subscriptions.push(
      this.friendService.sendEmailInvite(this.inviteEmail, this.inviteMessage).subscribe({
        next: () => {
          this.inviteEmail = '';
          this.inviteMessage = '';
          this.showInviteForm = false;
          this.isInviting = false;
          // Show success message
        },
        error: (error) => {
          console.error('Failed to send invite:', error);
          this.isInviting = false;
          // Show error message
        }
      })
    );
  }

  // ================ UTILITY METHODS ================

  getInitials(name: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  }

  getRequestCount(): number {
    return this.incomingRequests.length;
  }

  getRelativeTime(date: Date | any): string {
    // Handle Firestore Timestamp objects
    let jsDate: Date;
    if (date && typeof date.toDate === 'function') {
      // Firestore Timestamp
      jsDate = date.toDate();
    } else if (date instanceof Date) {
      // Already a Date object
      jsDate = date;
    } else if (typeof date === 'string') {
      // Date string
      jsDate = new Date(date);
    } else {
      // Fallback to current date if date is invalid
      console.warn('Invalid date provided to getRelativeTime:', date);
      return 'Unknown';
    }

    const now = new Date();
    const diff = now.getTime() - jsDate.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
      }
      return `${hours}h ago`;
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days}d ago`;
    } else {
      return jsDate.toLocaleDateString();
    }
  }
}
