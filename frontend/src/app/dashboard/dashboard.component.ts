import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '@angular/fire/auth';
import { Subscription, combineLatest } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { DataService } from '../services/data.service';
import { FriendService } from '../services/friend.service';
import { AddWorkoutModalComponent } from '../components/add-workout-modal/add-workout-modal.component';
import { WorkoutPlayerComponent } from '../components/workout-player/workout-player.component';
import { FeedbackComponent } from '../components/feedback/feedback.component';
import { FriendsComponent } from '../components/friends/friends.component';
import { AccountManagementComponent } from '../components/account-management/account-management.component';
import { OnboardingComponent } from '../components/onboarding/onboarding.component';
import { GoalsEditorComponent } from '../components/goals-editor/goals-editor.component';
import { Workout, WorkoutSchedule, WorkoutScheduleOverride, WorkoutWeeklyOverrides, UserGoals } from '../models/workout.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, AddWorkoutModalComponent, WorkoutPlayerComponent, FeedbackComponent, FriendsComponent, AccountManagementComponent, OnboardingComponent, GoalsEditorComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  activeSection = 'dashboard'; // Default to dashboard overview
  currentQuote = '';
  isAddWorkoutModalOpen = false;
  isWorkoutPlayerOpen = false;
  isAccountModalOpen = false;
  isOnboardingOpen = false;
  isGoalsEditorOpen = false;
  currentWorkout: Workout | null = null;
  workouts: Workout[] = [];
  isLoading = false;
  error: string | null = null;
  
  // User goals
  userGoals: UserGoals | null = null;
  hasCompletedOnboarding = false;
  
  private authSubscription?: Subscription;
  private workoutsSubscription?: Subscription;

  // Scheduled workouts
  todaysWorkouts: Workout[] = [];
  tomorrowsWorkouts: Workout[] = [];
  private todaysWorkoutsSubscription?: Subscription;
  private tomorrowsWorkoutsSubscription?: Subscription;

  // Calendar-related properties
  currentCalendarDate = new Date();
  calendarWorkouts: {date: Date, workouts: Workout[]}[] = [];
  calendarDays: {date: Date, workouts: Workout[], isCurrentMonth: boolean, isToday: boolean}[] = [];
  private calendarSubscription?: Subscription;

  // Workout modification properties
  isWorkoutModifierOpen = false;
  selectedWorkoutForModification: Workout | null = null;
  selectedReplacementWorkout: Workout | null = null;
  newScheduledTime: string = '';

  // Workout completion log properties
  completionLog: {workout: Workout, completion: any}[] = [];
  private completionLogSubscription?: Subscription;

  // Pagination properties for completion log
  currentPage = 1;
  itemsPerPage = 5;
  totalPages = 0;
  paginatedCompletionLog: {workout: Workout, completion: any}[] = [];

  // Workout pagination and filtering properties
  workoutCurrentPage = 1;
  workoutsPerPage = 3; // Default for medium screens
  workoutTotalPages = 0;
  paginatedWorkouts: Workout[] = [];
  selectedCategoryFilter: string | null = null;
  filteredWorkouts: Workout[] = [];

  // Mobile navigation
  isMobileSidebarOpen = false;

  // Friend notifications
  friendRequestCount = 0;
  private friendRequestSubscription?: Subscription;


  private motivationalQuotes = [
    "Your body can do it. It's your mind you need to convince.",
    "The only bad workout is the one that didn't happen.",
    "Strong is what happens when you run out of weak.",
    "Fitness is not about being better than someone else. It's about being better than you used to be.",
    "Don't put off tomorrow what you can do today.",
    "A one hour workout is only 4% of your day. No excuses.",
    "The groundwork for all happiness is good health.",
    "Take care of your body. It's the only place you have to live.",
    "Success starts with self-discipline.",
    "The pain you feel today will be the strength you feel tomorrow."
  ];

  constructor(
    private authService: AuthService,
    private dataService: DataService,
    private friendService: FriendService
  ) {}

  ngOnInit() {
    // Initialize responsive calculations
    this.calculateWorkoutsPerPage();
    
    // Add window resize listener for responsive updates
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        this.calculateWorkoutsPerPage();
      });
    }

    // Subscribe to auth state changes
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        // Load workouts and check onboarding when user is authenticated
        this.loadWorkouts();
        this.checkOnboardingStatus();
        // Subscribe to friend request notifications
        this.subscribeToFriendNotifications();
      } else {
        // Clear data when user is not authenticated
        this.workouts = [];
        this.userGoals = null;
        this.hasCompletedOnboarding = false;
        this.filteredWorkouts = [];
        this.paginatedWorkouts = [];
        this.friendRequestCount = 0;
      }
    });

    // Set a random motivational quote
    this.currentQuote = this.getRandomQuote();
  }

  ngOnDestroy() {
    // Clean up subscriptions
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.workoutsSubscription) {
      this.workoutsSubscription.unsubscribe();
    }
    if (this.todaysWorkoutsSubscription) {
      this.todaysWorkoutsSubscription.unsubscribe();
    }
    if (this.tomorrowsWorkoutsSubscription) {
      this.tomorrowsWorkoutsSubscription.unsubscribe();
    }
    if (this.calendarSubscription) {
      this.calendarSubscription.unsubscribe();
    }
    if (this.completionLogSubscription) {
      this.completionLogSubscription.unsubscribe();
    }
    if (this.friendRequestSubscription) {
      this.friendRequestSubscription.unsubscribe();
    }
  }

  private subscribeToFriendNotifications() {
    this.friendRequestSubscription = this.friendService.friendRequestCount$.subscribe(count => {
      this.friendRequestCount = count;
    });
  }

  private getRandomQuote(): string {
    const randomIndex = Math.floor(Math.random() * this.motivationalQuotes.length);
    return this.motivationalQuotes[randomIndex];
  }

  // Removed duplicate - moved to bottom with calendar logic

  openAddWorkoutModal() {
    this.isAddWorkoutModalOpen = true;
  }

  closeAddWorkoutModal() {
    this.isAddWorkoutModalOpen = false;
  }

  openWorkoutPlayer(workout: Workout) {
    this.currentWorkout = workout;
    this.isWorkoutPlayerOpen = true;
  }

  closeWorkoutPlayer() {
    this.isWorkoutPlayerOpen = false;
    this.currentWorkout = null;
  }

  openAccountModal() {
    this.isAccountModalOpen = true;
  }

  closeAccountModal() {
    this.isAccountModalOpen = false;
  }

  openGoalsEditor() {
    this.isGoalsEditorOpen = true;
  }

  closeGoalsEditor() {
    this.isGoalsEditorOpen = false;
  }

  onGoalsUpdated(updatedGoals: UserGoals) {
    this.userGoals = updatedGoals;
    console.log('Goals updated:', updatedGoals);
  }

  onWorkoutAdded(workout: Omit<Workout, 'id' | 'userId'>) {
    this.isLoading = true;
    this.error = null;

    // Create workout in Firestore (localStorage is updated optimistically in the service)
    this.workoutsSubscription = this.dataService.createWorkout(workout).subscribe({
      next: (workoutId) => {
        console.log('Workout created successfully with ID:', workoutId);
        
        // Refresh workouts to get the updated list
        this.loadWorkouts();
        
        // Close modal
        this.closeAddWorkoutModal();
        
        // Switch to workouts section
        this.setActiveSection('workouts');
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error creating workout:', error);
        this.error = 'Failed to save workout. Please try again.';
        this.isLoading = false;
      }
    });
  }

  completeWorkout(workout: Workout) {
    this.isLoading = true;
    this.error = null;

    this.workoutsSubscription = this.dataService.completeWorkout(workout.id).subscribe({
      next: () => {
        // Refresh workouts to get the updated data from localStorage
        this.loadWorkouts();
        
        // Close player
        this.closeWorkoutPlayer();
        
        console.log('Workout completed successfully:', workout.title);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error completing workout:', error);
        this.error = 'Failed to mark workout as completed. Please try again.';
        this.isLoading = false;
      }
    });
  }

  deleteWorkout(workout: Workout, event: Event) {
    // Prevent card click event from firing
    event.stopPropagation();
    
    // Confirm deletion
    if (confirm(`Are you sure you want to delete "${workout.title}"?`)) {
      this.isLoading = true;
      this.error = null;

      this.workoutsSubscription = this.dataService.deleteWorkout(workout.id).subscribe({
        next: () => {
          // Refresh workouts to get the updated data from localStorage
          this.loadWorkouts();
          
          console.log('Workout deleted successfully:', workout.title);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error deleting workout:', error);
          this.error = 'Failed to delete workout. Please try again.';
          this.isLoading = false;
        }
      });
    }
  }

  toggleWorkoutFavorite(workout: Workout, event: Event) {
    // Prevent card click event from firing
    event.stopPropagation();
    
    this.workoutsSubscription = this.dataService.toggleWorkoutFavorite(workout.id).subscribe({
      next: () => {
        // Refresh workouts to get the updated data from localStorage
        this.loadWorkouts();
        
        console.log('Workout favorite status updated:', workout.title);
      },
      error: (error) => {
        console.error('Error updating workout favorite status:', error);
        this.error = 'Failed to update favorite status. Please try again.';
      }
    });
  }

  private loadWorkouts() {
    if (!this.currentUser) {
      return;
    }

    this.isLoading = true;
    this.error = null;

    // Load scheduled workouts first from cache for instant display
    this.loadScheduledWorkouts();

    this.workoutsSubscription = this.dataService.getUserWorkouts().subscribe({
      next: (workouts) => {
        this.workouts = workouts;
        this.isLoading = false;
        console.log('Loaded workouts:', workouts.length);
        
        // Initialize filtering and pagination
        this.filterWorkoutsByCategory(this.selectedCategoryFilter);
        
        // Load completion log when workouts are loaded
        this.loadCompletionLog();
        
        // Refresh scheduled workouts with updated data
        this.loadScheduledWorkouts();
      },
      error: (error) => {
        console.error('Error loading workouts:', error);
        this.error = 'Failed to load workouts. Please refresh the page.';
        this.isLoading = false;
        
        // Fallback to empty array
        this.workouts = [];
        this.filteredWorkouts = [];
        this.paginatedWorkouts = [];
      }
    });
  }

  private loadScheduledWorkouts() {
    if (!this.currentUser) {
      return;
    }

    // Load today's scheduled workouts
    this.todaysWorkoutsSubscription = this.dataService.getTodaysScheduledWorkouts().subscribe({
      next: (workouts) => {
        this.todaysWorkouts = workouts;
        console.log('Loaded today\'s scheduled workouts:', workouts.length);
      },
      error: (error) => {
        console.error('Error loading today\'s scheduled workouts:', error);
        this.todaysWorkouts = [];
      }
    });

    // Load tomorrow's scheduled workouts
    this.tomorrowsWorkoutsSubscription = this.dataService.getTomorrowsScheduledWorkouts().subscribe({
      next: (workouts) => {
        this.tomorrowsWorkouts = workouts;
        console.log('Loaded tomorrow\'s scheduled workouts:', workouts.length);
      },
      error: (error) => {
        console.error('Error loading tomorrow\'s scheduled workouts:', error);
        this.tomorrowsWorkouts = [];
      }
    });
  }

  // Stats computed from workouts
  getTotalWorkouts(): number {
    return this.workouts.length;
  }

  getCompletedWorkoutsThisWeek(): number {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return this.workouts.filter(workout => 
      workout.dateCompleted && workout.dateCompleted >= oneWeekAgo
    ).length;
  }

  getCurrentStreak(): number {
    // Simple streak calculation - consecutive days with completed workouts
    const today = new Date();
    const sortedCompletedWorkouts = this.workouts
      .filter(w => w.dateCompleted)
      .sort((a, b) => (b.dateCompleted!.getTime() - a.dateCompleted!.getTime()));

    let streak = 0;
    let currentDate = new Date(today);

    for (const workout of sortedCompletedWorkouts) {
      const workoutDate = new Date(workout.dateCompleted!);
      const diffInDays = Math.floor((currentDate.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffInDays === streak) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (diffInDays > streak) {
        break;
      }
    }

    return streak;
  }

  getTotalTimeThisMonth(): number {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    return this.workouts
      .filter(workout => 
        workout.dateCompleted && workout.dateCompleted >= oneMonthAgo
      )
      .reduce((total, workout) => total + workout.duration, 0);
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    } else {
      return `${minutes}min`;
    }
  }

  // ================ ONBOARDING & GOALS ================

  private checkOnboardingStatus() {
    if (!this.currentUser) return;

    combineLatest([
      this.dataService.hasCompletedOnboarding(),
      this.dataService.getUserGoals()
    ]).subscribe({
      next: ([hasCompleted, goals]) => {
        this.hasCompletedOnboarding = hasCompleted;
        this.userGoals = goals;
        
        if (!hasCompleted) {
          this.isOnboardingOpen = true;
        }
      },
      error: (error) => {
        console.error('Error checking onboarding status:', error);
        // If there's an error, assume they need onboarding
        this.hasCompletedOnboarding = false;
        this.isOnboardingOpen = true;
      }
    });
  }

  onOnboardingCompleted() {
    this.isOnboardingOpen = false;
    this.hasCompletedOnboarding = true;
    // Reload goals after onboarding completion
    this.loadUserGoals();
  }

  private loadUserGoals() {
    if (!this.currentUser) return;

    this.dataService.getUserGoals().subscribe({
      next: (goals) => {
        this.userGoals = goals;
      },
      error: (error) => {
        console.error('Error loading user goals:', error);
      }
    });
  }

  getWeeklyWorkoutGoal(): number {
    return this.userGoals?.weeklyWorkoutGoal || 3;
  }

  getWeeklyMinuteGoal(): number {
    return this.userGoals?.weeklyMinuteGoal || 150;
  }

  getCompletedMinutesThisWeek(): number {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    let totalMinutes = 0;
    this.workouts.forEach(workout => {
      if (workout.completionLog) {
        workout.completionLog.forEach(completion => {
          if (new Date(completion.completedAt) >= startOfWeek) {
            totalMinutes += Math.round(workout.duration / 60); // Convert seconds to minutes
          }
        });
      }
    });
    
    return totalMinutes;
  }

  // Get workouts grouped by category
  getWorkoutsByCategory() {
    const categories = new Map();
    
    this.workouts.forEach(workout => {
      const categoryId = workout.category.id;
      if (!categories.has(categoryId)) {
        categories.set(categoryId, {
          category: workout.category,
          workouts: []
        });
      }
      categories.get(categoryId).workouts.push(workout);
    });

    return Array.from(categories.values());
  }

  // Refresh workouts manually
  refreshWorkouts() {
    this.loadWorkouts();
  }

  // Clear any error message
  clearError() {
    this.error = null;
  }

  // Helper methods for template
  getTodayDate(): string {
    return new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  getTomorrowDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
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
      // Clear localStorage before signing out
      this.dataService.clearUserData();
      await this.authService.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  // Scheduled workout helper methods
  getTodaysWorkoutTime(workout: Workout): string {
    if (workout.schedule && workout.schedule.time) {
      return workout.schedule.time;
    }
    return 'No time set';
  }

  getWorkoutScheduleText(workout: Workout): string {
    if (!workout.schedule) {
      return 'No schedule';
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const scheduledDays = workout.schedule.daysOfWeek
      .map(day => dayNames[day])
      .join(', ');

    if (workout.schedule.time) {
      return `${scheduledDays} at ${workout.schedule.time}`;
    }
    return scheduledDays;
  }

  hasScheduledWorkoutsToday(): boolean {
    return this.todaysWorkouts.length > 0;
  }

  hasScheduledWorkoutsTomorrow(): boolean {
    return this.tomorrowsWorkouts.length > 0;
  }

  // Calendar functionality
  getCurrentMonthName(): string {
    return this.currentCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  previousMonth() {
    this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
    this.loadCalendarData();
  }

  nextMonth() {
    this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
    this.loadCalendarData();
  }

  goToCurrentMonth() {
    this.currentCalendarDate = new Date();
    this.loadCalendarData();
  }

  loadCalendarData() {
    if (!this.currentUser) {
      return;
    }

    const year = this.currentCalendarDate.getFullYear();
    const month = this.currentCalendarDate.getMonth();

    this.calendarSubscription = this.dataService.getScheduledWorkoutsForMonth(year, month).subscribe({
      next: (workouts) => {
        this.calendarWorkouts = workouts;
        this.generateCalendarDays();
      },
      error: (error) => {
        console.error('Error loading calendar workouts:', error);
        this.calendarWorkouts = [];
        this.generateCalendarDays();
      }
    });
  }

  generateCalendarDays() {
    const year = this.currentCalendarDate.getFullYear();
    const month = this.currentCalendarDate.getMonth();
    
    // Get first day of month and last day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get first day of calendar (may include days from previous month)
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // Get last day of calendar (may include days from next month)
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
    
    // Generate calendar days
    this.calendarDays = [];
    const currentDate = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    while (currentDate <= endDate) {
      const dayDate = new Date(currentDate);
      const isCurrentMonth = dayDate.getMonth() === month;
      const isToday = dayDate.getTime() === today.getTime();
      
      // Find workouts for this day
      const dayWorkouts = this.calendarWorkouts.find(cw => 
        cw.date.toDateString() === dayDate.toDateString()
      )?.workouts || [];
      
      this.calendarDays.push({
        date: dayDate,
        workouts: dayWorkouts,
        isCurrentMonth,
        isToday
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  onCalendarDayClick(day: {date: Date, workouts: Workout[], isCurrentMonth: boolean, isToday: boolean}) {
    if (day.workouts.length > 0) {
      // Could open a day detail modal or navigate to workouts
      console.log('Selected day workouts:', day.workouts);
    }
  }

  getTruncatedTitle(title: string, maxLength: number): string {
    if (title.length <= maxLength) {
      return title;
    }
    return title.substring(0, maxLength) + '...';
  }

  // Set active section and load calendar data if needed
  setActiveSection(section: string) {
    this.activeSection = section;
    this.closeMobileSidebar(); // Close mobile menu when navigating
    
    if (section === 'calendar') {
      this.loadCalendarData();
    } else if (section === 'friends') {
      // Trigger friend request loading to update notification count
      this.loadFriendRequestCount();
    }
  }

  private loadFriendRequestCount() {
    if (this.currentUser) {
      // Trigger the friend service to load friend requests which will update the count
      this.friendService.getIncomingFriendRequests().subscribe();
    }
  }

  // Workout modification methods
  openWorkoutModifier(workout: Workout, event: Event) {
    event.stopPropagation();
    this.selectedWorkoutForModification = workout;
    this.selectedReplacementWorkout = null;
    this.newScheduledTime = '';
    this.isWorkoutModifierOpen = true;
  }

  closeWorkoutModifier() {
    this.isWorkoutModifierOpen = false;
    this.selectedWorkoutForModification = null;
    this.selectedReplacementWorkout = null;
    this.newScheduledTime = '';
  }

  getTimeForInput(time?: string): string {
    if (!time) return '';
    // Convert "9:00 AM" format to "09:00" format for input
    const [timePart, period] = time.split(' ');
    let [hours, minutes] = timePart.split(':');
    
    if (period === 'PM' && hours !== '12') {
      hours = (parseInt(hours) + 12).toString();
    } else if (period === 'AM' && hours === '12') {
      hours = '00';
    }
    
    return `${hours.padStart(2, '0')}:${minutes}`;
  }

  onTimeChange(event: any) {
    this.newScheduledTime = event.target.value;
  }

  addTimeMinutes(minutes: number) {
    if (!this.selectedWorkoutForModification?.schedule?.time) return;
    
    // Get the current time from the input field if it has been modified, otherwise use the original time
    const timeInput = document.querySelector('.time-input') as HTMLInputElement;
    let currentTime: string;
    
    if (this.newScheduledTime) {
      // Use the already modified time
      currentTime = this.newScheduledTime;
    } else if (timeInput && timeInput.value) {
      // Use the current input value
      currentTime = timeInput.value;
    } else {
      // Fallback to original time
      currentTime = this.getTimeForInput(this.selectedWorkoutForModification.schedule.time);
    }
    
    if (!currentTime) return;
    
    const [hours, mins] = currentTime.split(':').map(Number);
    const currentDate = new Date();
    currentDate.setHours(hours, mins, 0, 0);
    
    const newDate = new Date(currentDate.getTime() + minutes * 60000);
    
    // Handle day overflow/underflow
    if (newDate.getDate() !== currentDate.getDate()) {
      // If we've gone to next/previous day, clamp to valid times
      if (minutes > 0) {
        // Going forward, set to 23:59
        newDate.setHours(23, 59, 0, 0);
      } else {
        // Going backward, set to 00:00
        newDate.setHours(0, 0, 0, 0);
      }
    }
    
    const newTimeValue = `${newDate.getHours().toString().padStart(2, '0')}:${newDate.getMinutes().toString().padStart(2, '0')}`;
    
    this.newScheduledTime = newTimeValue;
    
    // Update the input field to reflect the new time
    if (timeInput) {
      timeInput.value = newTimeValue;
    }
  }

  selectReplacementWorkout(workout: Workout) {
    this.selectedReplacementWorkout = workout;
  }

  getAvailableWorkoutsForSwap(): Workout[] {
    if (!this.selectedWorkoutForModification) return [];
    
    return this.workouts.filter(workout => 
      workout.id !== this.selectedWorkoutForModification!.id
    );
  }

  hasModifications(): boolean {
    return !!(this.newScheduledTime || this.selectedReplacementWorkout);
  }

  getActionButtonText(): string {
    if (this.selectedReplacementWorkout && this.newScheduledTime) {
      return 'Replace & Change Time';
    } else if (this.selectedReplacementWorkout) {
      return 'Replace Workout';
    } else if (this.newScheduledTime) {
      return 'Change Time';
    }
    return 'Save';
  }

  getScheduleDayName(): string {
    if (!this.selectedWorkoutForModification) return '';
    
    // Check if workout is scheduled for today or tomorrow
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isToday = this.filterWorkoutsForDate([this.selectedWorkoutForModification], today).length > 0;
    const isTomorrow = this.filterWorkoutsForDate([this.selectedWorkoutForModification], tomorrow).length > 0;
    
    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    
    return 'Schedule';
  }

  removeFromSchedule() {
    if (!this.selectedWorkoutForModification) return;

    const workout = this.selectedWorkoutForModification;
    
    if (confirm(`Remove "${workout.title}" from ${this.getScheduleDayName().toLowerCase()}'s schedule?`)) {
      // Get target date (today or tomorrow)
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const isToday = this.filterWorkoutsForDate([workout], today).length > 0;
      const targetDate = isToday ? today : tomorrow;
      
      // Create a weekly override to remove this workout for this specific date
      const override = {
        type: 'removed' as const
      };
      
      this.dataService.createWeeklyOverride(workout.id, targetDate, override).subscribe({
        next: () => {
          console.log('Workout removed from schedule for', this.getScheduleDayName());
          this.loadScheduledWorkouts();
          this.closeWorkoutModifier();
        },
        error: (error) => {
          console.error('Error removing workout from schedule:', error);
          this.error = 'Failed to update schedule. Please try again.';
        }
      });
    }
  }

  deleteWorkoutPermanently() {
    if (!this.selectedWorkoutForModification) return;

    const workout = this.selectedWorkoutForModification;
    
    if (confirm(`Permanently delete "${workout.title}"? This action cannot be undone.`)) {
      this.dataService.deleteWorkout(workout.id).subscribe({
        next: () => {
          console.log('Workout permanently deleted:', workout.title);
          this.loadWorkouts();
          this.closeWorkoutModifier();
        },
        error: (error) => {
          console.error('Error deleting workout:', error);
          this.error = 'Failed to delete workout. Please try again.';
        }
      });
    }
  }

  // Helper method that already exists, just making sure it's available
  private filterWorkoutsForDate(workouts: Workout[], targetDate: Date): Workout[] {
    const targetDayOfWeek = targetDate.getDay();
    
    return workouts.filter(workout => {
      if (!workout.schedule || !workout.schedule.daysOfWeek || workout.schedule.daysOfWeek.length === 0) {
        return false;
      }
      
      return workout.schedule.daysOfWeek.includes(targetDayOfWeek);
    });
  }

  saveWorkoutModification() {
    if (!this.selectedWorkoutForModification) return;

    const originalWorkout = this.selectedWorkoutForModification;
    
    console.log('Saving workout modification:', {
      workout: originalWorkout.title,
      replacement: this.selectedReplacementWorkout?.title,
      newTime: this.newScheduledTime
    });
    
    if (this.selectedReplacementWorkout) {
      // Handle workout replacement with potential swap
      this.handleWorkoutReplacement(originalWorkout, this.selectedReplacementWorkout);
    } else if (this.newScheduledTime) {
      // Handle time change only
      this.handleTimeChange(originalWorkout, this.newScheduledTime);
    }

    // Don't close the modal immediately, let the subscription handle it
  }

  private handleWorkoutReplacement(originalWorkout: Workout, replacementWorkout: Workout) {
    // Get target date (today or tomorrow)
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isToday = this.filterWorkoutsForDate([originalWorkout], today).length > 0;
    const targetDate = isToday ? today : tomorrow;
    
    console.log('Handling workout replacement:', {
      original: originalWorkout.title,
      replacement: replacementWorkout.title,
      targetDate: targetDate.toDateString(),
      newTime: this.newScheduledTime
    });
    
    // Create a weekly override to replace this workout for this specific date
    const override = {
      type: 'workout_replacement' as const,
      replacementWorkoutId: replacementWorkout.id,
      newTime: this.newScheduledTime ? this.formatTimeForDisplay(this.newScheduledTime) : undefined
    };
    
    this.dataService.createWeeklyOverride(originalWorkout.id, targetDate, override).subscribe({
      next: () => {
        console.log('Workout replaced successfully for', this.getScheduleDayName());
        this.loadScheduledWorkouts();
        this.closeWorkoutModifier();
      },
      error: (error) => {
        console.error('Error replacing workout:', error);
        this.error = 'Failed to replace workout. Please try again.';
      }
    });
  }

  private handleTimeChange(workout: Workout, newTime: string) {
    // Get target date (today or tomorrow)
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isToday = this.filterWorkoutsForDate([workout], today).length > 0;
    const targetDate = isToday ? today : tomorrow;
    
    console.log('Handling time change:', {
      workout: workout.title,
      targetDate: targetDate.toDateString(),
      oldTime: workout.schedule?.time,
      newTime: this.formatTimeForDisplay(newTime)
    });
    
    // Create a weekly override to change the time for this specific date
    const override = {
      type: 'time_change' as const,
      newTime: this.formatTimeForDisplay(newTime)
    };
    
    this.dataService.createWeeklyOverride(workout.id, targetDate, override).subscribe({
      next: () => {
        console.log('Workout time updated successfully for', this.getScheduleDayName());
        this.loadScheduledWorkouts();
        this.closeWorkoutModifier();
      },
      error: (error) => {
        console.error('Error updating workout time:', error);
        this.error = 'Failed to update workout time. Please try again.';
      }
    });
  }

  private findNextScheduledWorkout(): Workout | null {
    // Get all workouts scheduled for this week after today
    const today = new Date();
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
    
         const upcomingWorkouts = this.workouts.filter(workout => {
       if (!workout.schedule?.daysOfWeek || workout.schedule.daysOfWeek.length === 0) return false;
       
       const workoutDate = new Date();
       const dayIndex = workout.schedule.daysOfWeek[0]; // Assuming single day scheduling
       workoutDate.setDate(today.getDate() + ((dayIndex - today.getDay() + 7) % 7));
       
       return workoutDate > today && workoutDate <= endOfWeek;
     }).sort((a, b) => {
      // Sort by scheduled time
      const timeA = a.schedule?.time || '';
      const timeB = b.schedule?.time || '';
      return timeA.localeCompare(timeB);
    });
    
    return upcomingWorkouts[0] || null;
  }

  private formatTimeForDisplay(timeInput: string): string {
    // Convert "09:00" format to "9:00 AM" format
    const [hours, minutes] = timeInput.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const period = hour24 >= 12 ? 'PM' : 'AM';
    
    return `${hour12}:${minutes} ${period}`;
  }

  // Completion log methods
  private loadCompletionLog() {
    this.completionLogSubscription = this.dataService.getAllCompletions().subscribe({
      next: (completions) => {
        this.completionLog = completions;
        console.log('Completion log loaded:', completions.length, 'entries');
        this.paginateCompletionLog();
      },
      error: (error) => {
        console.error('Error loading completion log:', error);
      }
    });
  }

  getCompletionDate(completion: any): string {
    const date = new Date(completion.completedAt);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getCompletionTime(completion: any): string {
    const date = new Date(completion.completedAt);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  hasCompletions(): boolean {
    return this.completionLog.length > 0;
  }

  hasPaginatedCompletions(): boolean {
    return this.paginatedCompletionLog.length > 0;
  }

  // Note: Feedback now handled via email client, no need for submission handler

  // Pagination methods
  paginateCompletionLog() {
    this.totalPages = Math.ceil(this.completionLog.length / this.itemsPerPage);
    
    // Ensure current page is valid
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedCompletionLog = this.completionLog.slice(startIndex, endIndex);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.paginateCompletionLog();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.paginateCompletionLog();
    }
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.paginateCompletionLog();
    }
  }

  getPaginationRange(): number[] {
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  getCurrentPageEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.completionLog.length);
  }

  // Workout pagination and filtering methods
  calculateWorkoutsPerPage() {
    if (typeof window !== 'undefined') {
      const width = window.innerWidth;
      if (width < 768) {
        this.workoutsPerPage = 1; // Mobile: 1 workout
      } else if (width < 1200) {
        this.workoutsPerPage = 3; // Tablet: 3 workouts
      } else if (width < 1600) {
        this.workoutsPerPage = 4; // Desktop: 4 workouts
      } else {
        this.workoutsPerPage = 5; // Large desktop: 5 workouts
      }
    }
    this.paginateWorkouts();
  }

  filterWorkoutsByCategory(categoryId: string | null = null) {
    this.selectedCategoryFilter = categoryId;
    
    if (categoryId === null) {
      this.filteredWorkouts = [...this.workouts];
    } else {
      this.filteredWorkouts = this.workouts.filter(workout => workout.category.id === categoryId);
    }
    
    this.workoutCurrentPage = 1; // Reset to first page
    this.paginateWorkouts();
  }

  paginateWorkouts() {
    this.workoutTotalPages = Math.ceil(this.filteredWorkouts.length / this.workoutsPerPage);
    const startIndex = (this.workoutCurrentPage - 1) * this.workoutsPerPage;
    const endIndex = startIndex + this.workoutsPerPage;
    this.paginatedWorkouts = this.filteredWorkouts.slice(startIndex, endIndex);
  }

  nextWorkoutPage() {
    if (this.workoutCurrentPage < this.workoutTotalPages) {
      this.workoutCurrentPage++;
      this.paginateWorkouts();
    }
  }

  previousWorkoutPage() {
    if (this.workoutCurrentPage > 1) {
      this.workoutCurrentPage--;
      this.paginateWorkouts();
    }
  }

  goToWorkoutPage(page: number) {
    if (page >= 1 && page <= this.workoutTotalPages) {
      this.workoutCurrentPage = page;
      this.paginateWorkouts();
    }
  }

  getWorkoutPaginationRange(): number[] {
    const range = [];
    const maxPages = Math.min(5, this.workoutTotalPages); // Show max 5 page numbers
    let startPage = Math.max(1, this.workoutCurrentPage - Math.floor(maxPages / 2));
    const endPage = Math.min(this.workoutTotalPages, startPage + maxPages - 1);
    
    // Adjust start page if we're near the end
    startPage = Math.max(1, endPage - maxPages + 1);
    
    for (let i = startPage; i <= endPage; i++) {
      range.push(i);
    }
    return range;
  }

  onCategoryClick(categoryGroup: any) {
    if (this.selectedCategoryFilter === categoryGroup.category.id) {
      // If same category clicked, remove filter
      this.filterWorkoutsByCategory(null);
    } else {
      // Filter by selected category
      this.filterWorkoutsByCategory(categoryGroup.category.id);
    }
  }

  clearCategoryFilter() {
    this.filterWorkoutsByCategory(null);
  }

  // Mobile navigation methods
  toggleMobileSidebar() {
    this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
  }

  closeMobileSidebar() {
    this.isMobileSidebarOpen = false;
  }



}
