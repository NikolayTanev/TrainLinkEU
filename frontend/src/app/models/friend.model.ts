export interface UserProfile {
  id: string; // Firebase Auth UID
  email: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
  dateJoined: Date;
  lastSeen?: Date;
  isPublic: boolean; // Whether profile is searchable
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUserProfile: UserProfile;
  toUserProfile: UserProfile;
  status: FriendRequestStatus;
  message?: string;
  dateCreated: Date;
  dateResponded?: Date;
}

export enum FriendRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  CANCELLED = 'cancelled'
}

export interface Friendship {
  id: string;
  user1Id: string;
  user2Id: string;
  user1Profile: UserProfile;
  user2Profile: UserProfile;
  dateCreated: Date;
  isActive: boolean;
}

export interface FriendSearchResult {
  user: UserProfile;
  mutualFriends?: UserProfile[];
  relationship?: 'none' | 'pending_sent' | 'pending_received' | 'friends';
}

export interface FriendInvite {
  id: string;
  fromUserId: string;
  fromUserProfile: UserProfile;
  email: string;
  message?: string;
  dateCreated: Date;
  dateAccepted?: Date;
  isUsed: boolean;
} 