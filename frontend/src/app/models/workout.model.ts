export interface Workout {
  id: string;
  userId: string; // Firebase Auth UID
  title: string;
  description?: string;
  youtubeUrl: string;
  youtubeId: string;
  thumbnailUrl: string;
  duration: number; // in seconds
  trainer: string; // channel name
  category: WorkoutCategory;
  difficulty?: WorkoutDifficulty;
  equipment?: string[];
  bodyParts?: string[];
  calories?: number;
  dateAdded: Date;
  dateCompleted?: Date;
  completedCount: number;
  completionLog?: WorkoutCompletion[]; // New: Track individual completions
  isFavorite: boolean;
  notes?: string;
  schedule?: WorkoutSchedule;
  weeklyOverrides?: WorkoutWeeklyOverrides;
}

export interface WorkoutCompletion {
  id: string; // Unique ID for this completion
  completedAt: Date; // When the workout was completed
  duration?: number; // How long the workout actually took (in seconds)
  notes?: string; // Optional notes about this completion
  location?: string; // Where the workout was done (optional)
  mood?: 'great' | 'good' | 'okay' | 'challenging'; // How they felt (optional)
}

export interface WorkoutCategory {
  id: string;
  name: string;
  icon: string;
  color?: string;
}

export enum WorkoutDifficulty {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced'
}

export interface YouTubeVideoInfo {
  id: string;
  title: string;
  description: string;
  duration: number; // in seconds
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
}

export interface WorkoutFormData {
  youtubeUrl: string;
  customTitle?: string;
  category: string;
  difficulty?: WorkoutDifficulty;
  duration: number; // in minutes
  equipment?: string[];
  bodyParts?: string[];
  notes?: string;
  // Scheduling data
  scheduleDays?: DayOfWeek[];
  scheduleTime?: string;
  repeatWeekly?: boolean;
}

export interface WorkoutSchedule {
  daysOfWeek: DayOfWeek[]; // Array of selected days
  time?: string; // Optional time in HH:MM format
  repeatWeekly: boolean; // Whether to repeat every week
  isActive: boolean; // Whether the schedule is currently active
}

export interface WorkoutScheduleOverride {
  type: 'time_change' | 'workout_replacement' | 'removed';
  newTime?: string;
  replacementWorkoutId?: string;
}

export interface WorkoutWeeklyOverrides {
  [dateString: string]: WorkoutScheduleOverride; // Key format: "YYYY-MM-DD"
}

export enum DayOfWeek {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6
}

export interface DayOption {
  value: DayOfWeek;
  label: string;
  shortLabel: string;
} 

export interface TrainingProgram {
  id: string;
  userId: string;
  name: string;
  description?: string;
  duration: number; // Duration in weeks
  workouts: Workout[];
  weeklySchedule: ProgramDay[];
  isActive: boolean;
  dateCreated: Date;
  dateStarted?: Date;
  dateCompleted?: Date;
}

// User Goals and Preferences
export interface UserGoals {
  id?: string;
  userId: string;
  weeklyWorkoutGoal: number; // Number of workouts per week
  weeklyMinuteGoal: number; // Minutes of exercise per week
  dateCreated: Date;
  lastUpdated: Date;
}

export interface UserPreferences {
  id?: string;
  userId: string;
  goals: UserGoals;
  hasCompletedOnboarding: boolean;
  dateCreated: Date;
  lastUpdated: Date;
}

export interface ProgramDay {
  dayOfWeek: DayOfWeek;
  workouts: ProgramWorkout[];
}

export interface ProgramWorkout {
  workoutId: string;
  dayOfWeek: DayOfWeek;
  time?: string; // Optional time in HH:MM format
  order: number; // Order within the day
  restDayAfter?: boolean; // Whether this is followed by a rest day
}