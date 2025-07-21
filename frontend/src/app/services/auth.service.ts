import { Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { 
  Auth, 
  User, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  deleteUser,
  UserCredential
} from '@angular/fire/auth';
import { 
  Firestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  Timestamp 
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { UserProfile } from '../models/friend.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  private googleProvider = new GoogleAuthProvider();

  constructor(
    private auth: Auth,
    private router: Router,
    private injector: Injector,
    private firestore: Firestore
  ) {
    // Listen to auth state changes
    onAuthStateChanged(this.auth, (user) => {
      this.currentUserSubject.next(user);
      
      // If user logs out, clear localStorage
      if (!user) {
        this.clearUserData();
      } else {
        // Ensure user profile exists when user logs in
        this.ensureUserProfile(user);
      }
    });
  }

  private clearUserData(): void {
    // Clear localStorage data when user logs out
    try {
      localStorage.removeItem('trainlink_workouts');
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
  }

  // Get current user
  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // Check if user is logged in
  get isLoggedIn(): boolean {
    return this.currentUser !== null;
  }

  // Sign up with email and password
  async signUpWithEmail(email: string, password: string): Promise<UserCredential> {
    try {
      const result = await createUserWithEmailAndPassword(this.auth, email, password);
      // Ensure user profile is created immediately after signup
      await this.ensureUserProfile(result.user);
      await this.router.navigate(['/dashboard']);
      return result;
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  }

  // Sign in with email and password
  async signInWithEmail(email: string, password: string): Promise<UserCredential> {
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      // Ensure user profile exists on sign in (for existing users who didn't have profiles)
      await this.ensureUserProfile(result.user);
      await this.router.navigate(['/dashboard']);
      return result;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  // Sign up with Google
  async signUpWithGoogle(): Promise<UserCredential> {
    try {
      const result = await signInWithPopup(this.auth, this.googleProvider);
      // Ensure user profile is created for Google signup
      await this.ensureUserProfile(result.user);
      await this.router.navigate(['/dashboard']);
      return result;
    } catch (error) {
      console.error('Google sign up error:', error);
      throw error;
    }
  }

  // Sign in with Google
  async signInWithGoogle(): Promise<UserCredential> {
    try {
      const result = await signInWithPopup(this.auth, this.googleProvider);
      // Ensure user profile exists for Google sign in
      await this.ensureUserProfile(result.user);
      await this.router.navigate(['/dashboard']);
      return result;
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      // Clear user data before signing out
      this.clearUserData();
      await signOut(this.auth);
      await this.router.navigate(['/home']);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  // Update display name
  async updateDisplayName(displayName: string): Promise<void> {
    const user = this.currentUser;
    if (!user) {
      throw new Error('No user is currently signed in');
    }

    try {
      await updateProfile(user, { displayName });
      // Update the current user subject to reflect the change
      this.currentUserSubject.next(user);
    } catch (error) {
      console.error('Update display name error:', error);
      throw error;
    }
  }

  // Delete user account
  async deleteAccount(): Promise<void> {
    const user = this.currentUser;
    if (!user) {
      throw new Error('No user is currently signed in');
    }

    try {
      // Clear user data before deleting account
      this.clearUserData();
      await deleteUser(user);
      // Note: Navigation will be handled by the calling component
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    }
  }

  // Get error message for display
  getErrorMessage(error: any): string {
    switch (error.code) {
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      case 'auth/wrong-password':
        return 'Incorrect password.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/invalid-email':
        return 'Invalid email address.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in was cancelled.';
      case 'auth/popup-blocked':
        return 'Please allow popups for this site to sign in with Google.';
      default:
        return 'An error occurred. Please try again.';
    }
  }

  private async ensureUserProfile(user: User): Promise<void> {
    try {
      // Check if user profile already exists in userProfiles collection
      const profilesRef = collection(this.firestore, 'userProfiles');
      const userProfileQuery = doc(profilesRef, user.uid);
      const docSnap = await getDoc(userProfileQuery);

      if (!docSnap.exists()) {
        // Create new user profile matching the UserProfile interface
        // Remove undefined values since Firestore doesn't support them
        const firestoreData: any = {
          id: user.uid,
          email: user.email || '',
          dateJoined: Timestamp.fromDate(new Date()),
          lastSeen: Timestamp.fromDate(new Date()),
          isPublic: true // Default to public so users can be found by friends
        };

        // Only add optional fields if they have values
        if (user.displayName) {
          firestoreData.displayName = user.displayName;
        }
        if (user.photoURL) {
          firestoreData.photoURL = user.photoURL;
        }

        await setDoc(userProfileQuery, firestoreData);
        console.log('User profile created for:', user.displayName || user.email);
      } else {
        // Update last seen timestamp for existing users
        await setDoc(userProfileQuery, {
          lastSeen: Timestamp.fromDate(new Date())
        }, { merge: true });
        console.log('User profile updated for:', user.displayName || user.email);
      }
    } catch (error) {
      console.error('Error ensuring user profile:', error);
    }
  }
} 