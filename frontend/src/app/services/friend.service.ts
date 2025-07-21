import { Injectable } from '@angular/core';
import { Observable, from, map, switchMap, of, throwError, combineLatest, BehaviorSubject } from 'rxjs';
import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  DocumentData
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { 
  UserProfile, 
  FriendRequest, 
  FriendRequestStatus, 
  Friendship, 
  FriendSearchResult,
  FriendInvite
} from '../models/friend.model';

@Injectable({
  providedIn: 'root'
})
export class FriendService {
  
  // Observable for friend request count notifications
  private friendRequestCountSubject = new BehaviorSubject<number>(0);
  public friendRequestCount$ = this.friendRequestCountSubject.asObservable();
  
  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) { }

  // ====================== USER PROFILE METHODS ======================
  
  /**
   * Create or update user profile in Firestore
   */
  createUserProfile(profile: Omit<UserProfile, 'id'>): Observable<string> {
    const user = this.authService.currentUser;
    if (!user) {
      return throwError(() => new Error('User not authenticated'));
    }

    const profileData = this.cleanFirestoreData({
      ...profile,
      dateJoined: Timestamp.fromDate(profile.dateJoined),
      lastSeen: profile.lastSeen ? Timestamp.fromDate(profile.lastSeen) : null
    });

    const profilesRef = collection(this.firestore, 'userProfiles');
    return from(addDoc(profilesRef, profileData)).pipe(
      map(docRef => docRef.id)
    );
  }

  /**
   * Get user profile by user ID
   */
  getUserProfile(userId: string): Observable<UserProfile | null> {
    console.log('Getting user profile for userId:', userId);
    const profileRef = doc(this.firestore, 'userProfiles', userId);

    return from(getDoc(profileRef)).pipe(
      map(docSnapshot => {
        console.log('User profile doc exists:', docSnapshot.exists());
        if (!docSnapshot.exists()) {
          console.log('No user profile found for userId:', userId);
          return null;
        }
        const profile = this.convertFirestoreUserProfile(docSnapshot.id, docSnapshot.data());
        console.log('Retrieved user profile:', profile);
        return profile;
      })
    );
  }

  /**
   * Search for users by email or username
   */
  searchUsers(searchTerm: string): Observable<FriendSearchResult[]> {
    if (!searchTerm.trim()) {
      return of([]);
    }

    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return throwError(() => new Error('User not authenticated'));
    }

    const profilesRef = collection(this.firestore, 'userProfiles');
    
    // Create queries for email and username search
    const emailQuery = query(
      profilesRef,
      where('email', '>=', searchTerm.toLowerCase()),
      where('email', '<=', searchTerm.toLowerCase() + '\uf8ff'),
      where('isPublic', '==', true),
      limit(10)
    );

    const usernameQuery = query(
      profilesRef,
      where('username', '>=', searchTerm.toLowerCase()),
      where('username', '<=', searchTerm.toLowerCase() + '\uf8ff'),
      where('isPublic', '==', true),
      limit(10)
    );

    return combineLatest([
      from(getDocs(emailQuery)),
      from(getDocs(usernameQuery))
    ]).pipe(
      switchMap(([emailSnapshot, usernameSnapshot]) => {
        const users = new Map<string, UserProfile>();
        
        // Combine results and remove duplicates
        [...emailSnapshot.docs, ...usernameSnapshot.docs].forEach(doc => {
          const profile = this.convertFirestoreUserProfile(doc.id, doc.data());
          if (profile.id !== currentUser.uid) { // Exclude current user
            users.set(profile.id, profile);
          }
        });

        // Get relationship status for each user
        const userArray = Array.from(users.values());
        if (userArray.length === 0) {
          return of([]);
        }

        // Get relationship status for all users in parallel
        const relationshipObservables = userArray.map(user => 
          this.getRelationshipStatus(user.id).pipe(
            map(relationship => ({
              user,
              relationship
            }))
          )
        );

        return combineLatest(relationshipObservables);
      })
    );
  }

  /**
   * Get relationship status between current user and another user
   */
  getRelationshipStatus(userId: string): Observable<'none' | 'pending_sent' | 'pending_received' | 'friends'> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return of('none');
    }

    // Check if they are already friends
    return this.checkIfFriends(currentUser.uid, userId).pipe(
      switchMap(areFriends => {
        if (areFriends) {
          return of('friends' as const);
        }

        // Check for pending friend requests
        return this.checkPendingRequests(currentUser.uid, userId);
      })
    );
  }

  /**
   * Check if two users are friends
   */
  private checkIfFriends(userId1: string, userId2: string): Observable<boolean> {
    const friendshipsRef = collection(this.firestore, 'friendships');
    
    const query1 = query(
      friendshipsRef,
      where('user1Id', '==', userId1),
      where('user2Id', '==', userId2),
      where('isActive', '==', true)
    );

    const query2 = query(
      friendshipsRef,
      where('user1Id', '==', userId2),
      where('user2Id', '==', userId1),
      where('isActive', '==', true)
    );

    return combineLatest([
      from(getDocs(query1)),
      from(getDocs(query2))
    ]).pipe(
      map(([snapshot1, snapshot2]) => {
        return snapshot1.docs.length > 0 || snapshot2.docs.length > 0;
      })
    );
  }

  /**
   * Check for pending friend requests between users
   */
  private checkPendingRequests(currentUserId: string, otherUserId: string): Observable<'none' | 'pending_sent' | 'pending_received'> {
    const requestsRef = collection(this.firestore, 'friendRequests');
    
    // Check if current user sent a request to other user
    const sentQuery = query(
      requestsRef,
      where('fromUserId', '==', currentUserId),
      where('toUserId', '==', otherUserId),
      where('status', '==', FriendRequestStatus.PENDING)
    );

    // Check if other user sent a request to current user
    const receivedQuery = query(
      requestsRef,
      where('fromUserId', '==', otherUserId),
      where('toUserId', '==', currentUserId),
      where('status', '==', FriendRequestStatus.PENDING)
    );

    return combineLatest([
      from(getDocs(sentQuery)),
      from(getDocs(receivedQuery))
    ]).pipe(
      map(([sentSnapshot, receivedSnapshot]) => {
        if (sentSnapshot.docs.length > 0) {
          return 'pending_sent' as const;
        }
        if (receivedSnapshot.docs.length > 0) {
          return 'pending_received' as const;
        }
        return 'none' as const;
      })
    );
  }

  // ====================== FRIEND REQUEST METHODS ======================

  /**
   * Send a friend request
   */
  sendFriendRequest(toUserId: string, message?: string): Observable<string> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return throwError(() => new Error('User not authenticated'));
    }

    // First get both user profiles
    return combineLatest([
      this.getUserProfile(currentUser.uid),
      this.getUserProfile(toUserId)
    ]).pipe(
      switchMap(([fromProfile, toProfile]) => {
        if (!fromProfile || !toProfile) {
          return throwError(() => new Error('User profiles not found'));
        }

        const requestData = this.cleanFirestoreData({
          fromUserId: currentUser.uid,
          toUserId: toUserId,
          fromUserProfile: fromProfile,
          toUserProfile: toProfile,
          status: FriendRequestStatus.PENDING,
          message: message || '',
          dateCreated: Timestamp.fromDate(new Date())
        });

        const requestsRef = collection(this.firestore, 'friendRequests');
        return from(addDoc(requestsRef, requestData)).pipe(
          map(docRef => docRef.id)
        );
      })
    );
  }

  /**
   * Get incoming friend requests for current user
   */
  getIncomingFriendRequests(): Observable<FriendRequest[]> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      this.friendRequestCountSubject.next(0);
      return of([]);
    }

    const requestsRef = collection(this.firestore, 'friendRequests');
    const q = query(
      requestsRef,
      where('toUserId', '==', currentUser.uid),
      where('status', '==', FriendRequestStatus.PENDING),
      orderBy('dateCreated', 'desc')
    );

    return from(getDocs(q)).pipe(
      map(querySnapshot => {
        const requests = querySnapshot.docs.map(doc => 
          this.convertFirestoreFriendRequest(doc.id, doc.data())
        );
        
        // Update the notification count
        this.friendRequestCountSubject.next(requests.length);
        
        return requests;
      })
    );
  }

  /**
   * Get outgoing friend requests for current user
   */
  getOutgoingFriendRequests(): Observable<FriendRequest[]> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return of([]);
    }

    const requestsRef = collection(this.firestore, 'friendRequests');
    const q = query(
      requestsRef,
      where('fromUserId', '==', currentUser.uid),
      where('status', '==', FriendRequestStatus.PENDING),
      orderBy('dateCreated', 'desc')
    );

    return from(getDocs(q)).pipe(
      map(querySnapshot => {
        return querySnapshot.docs.map(doc => 
          this.convertFirestoreFriendRequest(doc.id, doc.data())
        );
      })
    );
  }

  /**
   * Accept a friend request
   */
  acceptFriendRequest(requestId: string): Observable<void> {
    const requestRef = doc(this.firestore, 'friendRequests', requestId);
    
    return from(getDoc(requestRef)).pipe(
      switchMap(docSnapshot => {
        if (!docSnapshot.exists()) {
          return throwError(() => new Error('Friend request not found'));
        }

        const requestData = docSnapshot.data() as any;
        
        // Update request status
        const updatePromise = updateDoc(requestRef, {
          status: FriendRequestStatus.ACCEPTED,
          dateResponded: Timestamp.fromDate(new Date())
        });

        // Create friendship
        const friendshipData = this.cleanFirestoreData({
          user1Id: requestData.fromUserId,
          user2Id: requestData.toUserId,
          user1Profile: requestData.fromUserProfile,
          user2Profile: requestData.toUserProfile,
          dateCreated: Timestamp.fromDate(new Date()),
          isActive: true
        });

        const friendshipsRef = collection(this.firestore, 'friendships');
        const createFriendshipPromise = addDoc(friendshipsRef, friendshipData);

        return from(Promise.all([updatePromise, createFriendshipPromise]));
      }),
      map(() => void 0)
    );
  }

  /**
   * Decline a friend request
   */
  declineFriendRequest(requestId: string): Observable<void> {
    const requestRef = doc(this.firestore, 'friendRequests', requestId);
    
    return from(updateDoc(requestRef, {
      status: FriendRequestStatus.DECLINED,
      dateResponded: Timestamp.fromDate(new Date())
    })).pipe(
      map(() => void 0)
    );
  }

  // ====================== FRIENDSHIP METHODS ======================

  /**
   * Get user's friends with current profile information
   */
  getUserFriends(): Observable<UserProfile[]> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      console.log('No current user, returning empty friends list');
      return of([]);
    }

    console.log('Getting friends for user:', currentUser.uid);
    const friendshipsRef = collection(this.firestore, 'friendships');
    
    // Create two separate queries instead of using 'or'
    const user1Query = query(
      friendshipsRef,
      where('user1Id', '==', currentUser.uid),
      where('isActive', '==', true)
    );

    const user2Query = query(
      friendshipsRef,
      where('user2Id', '==', currentUser.uid),
      where('isActive', '==', true)
    );

    return combineLatest([
      from(getDocs(user1Query)),
      from(getDocs(user2Query))
    ]).pipe(
      switchMap(([user1Snapshot, user2Snapshot]) => {
        console.log('User1 friendships found:', user1Snapshot.docs.length);
        console.log('User2 friendships found:', user2Snapshot.docs.length);
        
        const friendUserIds = new Set<string>();
        
        // Collect friend user IDs from both queries
        user1Snapshot.docs.forEach(doc => {
          const friendship = this.convertFirestoreFriendship(doc.id, doc.data());
          friendUserIds.add(friendship.user2Id);
        });
        
        user2Snapshot.docs.forEach(doc => {
          const friendship = this.convertFirestoreFriendship(doc.id, doc.data());
          friendUserIds.add(friendship.user1Id);
        });

        // If no friends, return empty array
        if (friendUserIds.size === 0) {
          console.log('No friends found');
          return of([]);
        }

        // Fetch current profiles for all friends
        const friendProfileObservables = Array.from(friendUserIds).map(userId => 
          this.getUserProfile(userId).pipe(
            map(profile => profile) // Keep null profiles for filtering later
          )
        );

        return combineLatest(friendProfileObservables).pipe(
          map(profiles => {
            // Filter out null profiles (users that no longer exist)
            const validProfiles = profiles.filter(profile => profile !== null) as UserProfile[];
            console.log('Final friends list with current profiles:', validProfiles);
            return validProfiles;
          })
        );
      })
    );
  }

  /**
   * Remove a friendship
   */
  removeFriend(friendUserId: string): Observable<void> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return throwError(() => new Error('User not authenticated'));
    }

    const friendshipsRef = collection(this.firestore, 'friendships');
    
    // Find the friendship document to deactivate
    const user1Query = query(
      friendshipsRef,
      where('user1Id', '==', currentUser.uid),
      where('user2Id', '==', friendUserId),
      where('isActive', '==', true)
    );

    const user2Query = query(
      friendshipsRef,
      where('user1Id', '==', friendUserId),
      where('user2Id', '==', currentUser.uid),
      where('isActive', '==', true)
    );

    return combineLatest([
      from(getDocs(user1Query)),
      from(getDocs(user2Query))
    ]).pipe(
      switchMap(([user1Snapshot, user2Snapshot]) => {
        const allDocs = [...user1Snapshot.docs, ...user2Snapshot.docs];
        
        if (allDocs.length === 0) {
          return throwError(() => new Error('Friendship not found'));
        }

        // Deactivate the friendship (mark as inactive rather than delete)
        const updatePromises = allDocs.map(doc => 
          updateDoc(doc.ref, { isActive: false })
        );

        return from(Promise.all(updatePromises));
      }),
      map(() => void 0)
    );
  }

  // ====================== INVITE METHODS ======================

  /**
   * Send email invite to non-user
   */
  sendEmailInvite(email: string, message?: string): Observable<string> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return throwError(() => new Error('User not authenticated'));
    }

    return this.getUserProfile(currentUser.uid).pipe(
      switchMap(fromProfile => {
        if (!fromProfile) {
          return throwError(() => new Error('User profile not found'));
        }

        const inviteData = this.cleanFirestoreData({
          fromUserId: currentUser.uid,
          fromUserProfile: fromProfile,
          email: email.toLowerCase(),
          message: message || '',
          dateCreated: Timestamp.fromDate(new Date()),
          isUsed: false
        });

        const invitesRef = collection(this.firestore, 'friendInvites');
        return from(addDoc(invitesRef, inviteData)).pipe(
          map(docRef => docRef.id)
        );
      })
    );
  }

  // ====================== UTILITY METHODS ======================

  /**
   * Convert Firestore document to UserProfile
   */
  private convertFirestoreUserProfile(id: string, data: DocumentData): UserProfile {
    return {
      id: data['id'] || id,
      email: data['email'],
      displayName: data['displayName'],
      username: data['username'],
      photoURL: data['photoURL'],
      dateJoined: data['dateJoined']?.toDate() || new Date(),
      lastSeen: data['lastSeen']?.toDate(),
      isPublic: data['isPublic'] || false
    };
  }

  /**
   * Convert Firestore document to FriendRequest
   */
  private convertFirestoreFriendRequest(id: string, data: DocumentData): FriendRequest {
    return {
      id,
      fromUserId: data['fromUserId'],
      toUserId: data['toUserId'],
      fromUserProfile: data['fromUserProfile'],
      toUserProfile: data['toUserProfile'],
      status: data['status'],
      message: data['message'],
      dateCreated: data['dateCreated']?.toDate() || new Date(),
      dateResponded: data['dateResponded']?.toDate()
    };
  }

  /**
   * Convert Firestore document to Friendship
   */
  private convertFirestoreFriendship(id: string, data: DocumentData): Friendship {
    return {
      id,
      user1Id: data['user1Id'],
      user2Id: data['user2Id'],
      user1Profile: data['user1Profile'],
      user2Profile: data['user2Profile'],
      dateCreated: data['dateCreated']?.toDate() || new Date(),
      isActive: data['isActive']
    };
  }

  /**
   * Clean data for Firestore by removing undefined values
   */
  private cleanFirestoreData(data: any): any {
    if (data === null || data === undefined) {
      return null;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.cleanFirestoreData(item));
    }

    if (typeof data === 'object' && data.constructor === Object) {
      const cleaned: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          cleaned[key] = this.cleanFirestoreData(value);
        }
      }
      
      return cleaned;
    }

    return data;
  }
} 