import { Injectable } from '@angular/core';
import { Observable, from, map, switchMap, of, throwError } from 'rxjs';
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
  Timestamp,
  CollectionReference,
  DocumentData,
  QueryConstraint
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { Workout, WorkoutCompletion, WorkoutScheduleOverride, WorkoutWeeklyOverrides, TrainingProgram, UserGoals, UserPreferences } from '../models/workout.model';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private readonly STORAGE_KEY = 'trainlink_workouts';
  
  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) { }

  // localStorage management methods
  private saveWorkoutsToStorage(workouts: Workout[]): void {
    try {
      const currentUser = this.authService.currentUser;
      if (currentUser) {
        const storageData = {
          userId: currentUser.uid,
          workouts: workouts,
          lastUpdated: new Date().toISOString()
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storageData));
      }
    } catch (error) {
      console.warn('Failed to save workouts to localStorage:', error);
    }
  }

  private loadWorkoutsFromStorage(): Workout[] {
    try {
      const currentUser = this.authService.currentUser;
      if (!currentUser) return [];

      const storedData = localStorage.getItem(this.STORAGE_KEY);
      if (!storedData) return [];

      const parsedData = JSON.parse(storedData);
      
      // Check if data belongs to current user
      if (parsedData.userId !== currentUser.uid) {
        return [];
      }

      // Convert date strings back to Date objects
      const workouts = parsedData.workouts.map((workout: any) => ({
        ...workout,
        dateAdded: new Date(workout.dateAdded),
        dateCompleted: workout.dateCompleted ? new Date(workout.dateCompleted) : undefined
      }));

      return workouts;
    } catch (error) {
      console.warn('Failed to load workouts from localStorage:', error);
      return [];
    }
  }

  private updateWorkoutInStorage(updatedWorkout: Workout): void {
    const currentWorkouts = this.loadWorkoutsFromStorage();
    const index = currentWorkouts.findIndex(w => w.id === updatedWorkout.id);
    
    if (index !== -1) {
      currentWorkouts[index] = updatedWorkout;
    } else {
      currentWorkouts.unshift(updatedWorkout);
    }
    
    this.saveWorkoutsToStorage(currentWorkouts);
  }

  private removeWorkoutFromStorage(workoutId: string): void {
    const currentWorkouts = this.loadWorkoutsFromStorage();
    const filteredWorkouts = currentWorkouts.filter(w => w.id !== workoutId);
    this.saveWorkoutsToStorage(filteredWorkouts);
  }

  private clearWorkoutsStorage(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // Workout-specific methods

  /**
   * Create a new workout for the current user (with optimistic localStorage update)
   */
  createWorkout(workout: Omit<Workout, 'id' | 'userId'>): Observable<string> {
    const user = this.authService.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to create workouts');
    }

    // Generate temporary ID for optimistic update
    const tempId = 'temp_' + Date.now();
    const optimisticWorkout: Workout = {
      ...workout,
      id: tempId,
      userId: user.uid,
      dateAdded: workout.dateAdded || new Date()
    };

    // Optimistic update to localStorage
    this.updateWorkoutInStorage(optimisticWorkout);

    // Clean up the workout data to remove undefined values
    const cleanWorkoutData = this.cleanFirestoreData({
      ...workout,
      userId: user.uid,
      dateAdded: Timestamp.fromDate(workout.dateAdded || new Date()),
      dateCompleted: workout.dateCompleted ? Timestamp.fromDate(workout.dateCompleted) : null
    });

    const workoutsRef = collection(this.firestore, 'workouts');
    return from(addDoc(workoutsRef, cleanWorkoutData)).pipe(
      map(docRef => {
        // Replace temporary workout with real one
        this.removeWorkoutFromStorage(tempId);
        const finalWorkout: Workout = {
          ...optimisticWorkout,
          id: docRef.id
        };
        this.updateWorkoutInStorage(finalWorkout);
        
        return docRef.id;
      })
    );
  }

  /**
   * Get all workouts for the current user (with localStorage caching)
   */
  getUserWorkouts(): Observable<Workout[]> {
    const user = this.authService.currentUser;
    if (!user) {
      return of([]);
    }

    // First, return cached data if available for instant display
    const cachedWorkouts = this.loadWorkoutsFromStorage();

    const workoutsRef = collection(this.firestore, 'workouts');
    const userWorkoutsQuery = query(
      workoutsRef,
      where('userId', '==', user.uid),
      orderBy('dateAdded', 'desc')
    );

    return from(getDocs(userWorkoutsQuery)).pipe(
      map(snapshot => {
        const workouts = snapshot.docs.map(doc => this.convertFirestoreWorkout(doc.id, doc.data()));
        
        // Update localStorage with fresh data
        this.saveWorkoutsToStorage(workouts);
        
        return workouts;
      })
    );
  }

  /**
   * Get a specific workout by ID
   */
  getWorkout(workoutId: string): Observable<Workout | null> {
    const workoutRef = doc(this.firestore, 'workouts', workoutId);
    return from(getDoc(workoutRef)).pipe(
      map(docSnapshot => {
        if (!docSnapshot.exists()) {
          return null;
        }
        return this.convertFirestoreWorkout(docSnapshot.id, docSnapshot.data());
      })
    );
  }

  /**
   * Update an existing workout (with optimistic localStorage update)
   */
  updateWorkout(workoutId: string, updates: Partial<Workout>): Observable<void> {
    const user = this.authService.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to update workouts');
    }

    // Optimistic update to localStorage
    const currentWorkouts = this.loadWorkoutsFromStorage();
    const workoutIndex = currentWorkouts.findIndex(w => w.id === workoutId);
    
    if (workoutIndex !== -1) {
      const updatedWorkout = { ...currentWorkouts[workoutIndex], ...updates };
      this.updateWorkoutInStorage(updatedWorkout);
    }

    // Convert Date objects to Firestore Timestamps and clean data
    const firestoreUpdates: any = { ...updates };
    if (firestoreUpdates.dateAdded) {
      firestoreUpdates.dateAdded = Timestamp.fromDate(firestoreUpdates.dateAdded);
    }
    if (firestoreUpdates.dateCompleted) {
      firestoreUpdates.dateCompleted = Timestamp.fromDate(firestoreUpdates.dateCompleted);
    }

    // Clean the updates to remove undefined values
    const cleanedUpdates = this.cleanFirestoreData(firestoreUpdates);

    const workoutRef = doc(this.firestore, 'workouts', workoutId);
    return from(updateDoc(workoutRef, cleanedUpdates));
  }

  /**
   * Delete a workout (with optimistic localStorage update)
   */
  deleteWorkout(workoutId: string): Observable<void> {
    const user = this.authService.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to delete workouts');
    }

    // Optimistic removal from localStorage
    this.removeWorkoutFromStorage(workoutId);

    const workoutRef = doc(this.firestore, 'workouts', workoutId);
    return from(deleteDoc(workoutRef));
  }

  /**
   * Mark a workout as completed with detailed logging
   */
  completeWorkout(workoutId: string, completionNotes?: string): Observable<void> {
    return this.getWorkout(workoutId).pipe(
      switchMap(workout => {
        if (!workout) {
          throw new Error('Workout not found');
        }
        
        const now = new Date();
        
        // Create new completion entry
        const newCompletion: any = {
          id: 'comp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          completedAt: now,
          duration: workout.duration, // Default to workout's expected duration
        };
        
        // Only add notes if they are provided
        if (completionNotes) {
          newCompletion.notes = completionNotes;
        }
        
        // Add to completion log (or create new array if it doesn't exist)
        const completionLog = [...(workout.completionLog || []), newCompletion];
        
        const updates = {
          dateCompleted: now,
          completedCount: workout.completedCount + 1,
          completionLog: completionLog
        };
        
        console.log('Completing workout with log entry:', newCompletion);
        
        return this.updateWorkout(workoutId, updates);
      })
    );
  }

  /**
   * Toggle favorite status of a workout
   */
  toggleWorkoutFavorite(workoutId: string): Observable<void> {
    return this.getWorkout(workoutId).pipe(
      switchMap(workout => {
        if (!workout) {
          throw new Error('Workout not found');
        }
        
        return this.updateWorkout(workoutId, { isFavorite: !workout.isFavorite });
      })
    );
  }

  /**
   * Get workouts by category for the current user
   */
  getWorkoutsByCategory(categoryId: string): Observable<Workout[]> {
    const user = this.authService.currentUser;
    if (!user) {
      return of([]);
    }

    const workoutsRef = collection(this.firestore, 'workouts');
    const categoryWorkoutsQuery = query(
      workoutsRef,
      where('userId', '==', user.uid),
      where('category.id', '==', categoryId),
      orderBy('dateAdded', 'desc')
    );

    return from(getDocs(categoryWorkoutsQuery)).pipe(
      map(snapshot => 
        snapshot.docs.map(doc => this.convertFirestoreWorkout(doc.id, doc.data()))
      )
    );
  }

  /**
   * Get recent completed workouts for the current user
   */
  getRecentCompletedWorkouts(limit: number = 10): Observable<Workout[]> {
    const user = this.authService.currentUser;
    if (!user) {
      return of([]);
    }

    const workoutsRef = collection(this.firestore, 'workouts');
    const recentWorkoutsQuery = query(
      workoutsRef,
      where('userId', '==', user.uid),
      where('dateCompleted', '!=', null),
      orderBy('dateCompleted', 'desc')
    );

    return from(getDocs(recentWorkoutsQuery)).pipe(
      map(snapshot => 
        snapshot.docs
          .slice(0, limit)
          .map(doc => this.convertFirestoreWorkout(doc.id, doc.data()))
      )
    );
  }

  /**
   * Get scheduled workouts for a specific date
   */
  getScheduledWorkoutsForDate(date: Date): Observable<Workout[]> {
    const user = this.authService.currentUser;
    if (!user) {
      return of([]);
    }

    return this.getUserWorkouts().pipe(
      map(workouts => this.filterWorkoutsForDate(workouts, date))
    );
  }

  /**
   * Get today's scheduled workouts (using cached data for instant response)
   */
  getTodaysScheduledWorkouts(): Observable<Workout[]> {
    // Use current cached workouts for instant response
    const cachedWorkouts = this.loadWorkoutsFromStorage();
    const todaysWorkouts = this.filterWorkoutsForDateWithOverrides(cachedWorkouts, new Date());
    
    console.log('Today\'s workouts with overrides:', todaysWorkouts);
    return of(todaysWorkouts);
  }

  /**
   * Get tomorrow's scheduled workouts (using cached data for instant response)  
   */
  getTomorrowsScheduledWorkouts(): Observable<Workout[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Use current cached workouts for instant response
    const cachedWorkouts = this.loadWorkoutsFromStorage();
    const tomorrowsWorkouts = this.filterWorkoutsForDateWithOverrides(cachedWorkouts, tomorrow);
    
    console.log('Tomorrow\'s workouts with overrides:', tomorrowsWorkouts);
    return of(tomorrowsWorkouts);
  }

  /**
   * Get scheduled workouts for a date range (for calendar view)
   */
  getScheduledWorkoutsForDateRange(startDate: Date, endDate: Date): Observable<{date: Date, workouts: Workout[]}[]> {
    const user = this.authService.currentUser;
    if (!user) {
      return of([]);
    }

    return this.getUserWorkouts().pipe(
      map(workouts => {
        const dateWorkouts: {date: Date, workouts: Workout[]}[] = [];
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          const scheduledWorkouts = this.filterWorkoutsForDate(workouts, new Date(currentDate));
          if (scheduledWorkouts.length > 0) {
            dateWorkouts.push({
              date: new Date(currentDate),
              workouts: scheduledWorkouts
            });
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return dateWorkouts;
      })
    );
  }

  /**
   * Get all scheduled workouts for the current month
   */
  getScheduledWorkoutsForMonth(year: number, month: number): Observable<{date: Date, workouts: Workout[]}[]> {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); // Last day of month
    return this.getScheduledWorkoutsForDateRange(startDate, endDate);
  }

  /**
   * Filter workouts that are scheduled for a specific date
   */
  private filterWorkoutsForDate(workouts: Workout[], targetDate: Date): Workout[] {
    const targetDayOfWeek = targetDate.getDay();
    
    return workouts.filter(workout => {
      if (!workout.schedule || !workout.schedule.daysOfWeek || workout.schedule.daysOfWeek.length === 0) {
        return false;
      }
      
      return workout.schedule.daysOfWeek.includes(targetDayOfWeek);
    });
  }

  // New method that checks for weekly overrides
  private filterWorkoutsForDateWithOverrides(workouts: Workout[], targetDate: Date): Workout[] {
    const targetDayOfWeek = targetDate.getDay();
    const dateString = this.formatDateForOverride(targetDate);
    
    console.log('Filtering workouts for date:', dateString, 'day:', targetDayOfWeek);
    
    const scheduledWorkouts = workouts.filter(workout => {
      if (!workout.schedule || !workout.schedule.daysOfWeek || workout.schedule.daysOfWeek.length === 0) {
        return false;
      }
      
      // Check if this workout is removed for this specific date
      if (workout.weeklyOverrides && workout.weeklyOverrides[dateString]?.type === 'removed') {
        console.log('Workout removed for date:', workout.title, dateString);
        return false;
      }
      
      const isScheduled = workout.schedule.daysOfWeek.includes(targetDayOfWeek);
      if (isScheduled) {
        console.log('Workout scheduled for day:', workout.title, 'overrides:', workout.weeklyOverrides);
      }
      return isScheduled;
    });

    // Apply workout replacements and time changes
    const result = scheduledWorkouts.map(workout => this.applyWorkoutOverrides(workout, targetDate));
    console.log('Final filtered workouts:', result);
    return result;
  }

  private applyWorkoutOverrides(workout: Workout, targetDate: Date): Workout {
    const dateString = this.formatDateForOverride(targetDate);
    const override = workout.weeklyOverrides?.[dateString];
    
    if (!override) {
      return workout; // No override for this date
    }

    if (override.type === 'time_change' && override.newTime) {
      return {
        ...workout,
        schedule: {
          ...workout.schedule!,
          time: override.newTime
        }
      };
    }

    if (override.type === 'workout_replacement' && override.replacementWorkoutId) {
      // Find the replacement workout
      const cachedWorkouts = this.loadWorkoutsFromStorage();
      const replacementWorkout = cachedWorkouts.find(w => w.id === override.replacementWorkoutId);
      
      if (replacementWorkout) {
        return {
          ...replacementWorkout,
          schedule: {
            ...workout.schedule!, // Keep the original schedule time unless overridden
            time: override.newTime || workout.schedule?.time
          }
        };
      }
    }

    return workout;
  }

  private formatDateForOverride(date: Date): string {
    return date.toISOString().split('T')[0]; // Format: "YYYY-MM-DD"
  }

  // Method to create a weekly override
  createWeeklyOverride(workoutId: string, targetDate: Date, override: WorkoutScheduleOverride): Observable<void> {
    const dateString = this.formatDateForOverride(targetDate);
    console.log('Creating weekly override:', { workoutId, dateString, override });
    
    const currentWorkouts = this.loadWorkoutsFromStorage();
    const workoutIndex = currentWorkouts.findIndex(w => w.id === workoutId);
    
    if (workoutIndex !== -1) {
      const workout = currentWorkouts[workoutIndex];
      
      // Initialize weeklyOverrides if it doesn't exist
      if (!workout.weeklyOverrides) {
        workout.weeklyOverrides = {};
      }
      
      // Add the override
      workout.weeklyOverrides[dateString] = override;
      
      console.log('Updated workout with override:', workout);
      
      // Update localStorage immediately
      this.updateWorkoutInStorage(workout);
      
      // Update in Firestore
      return this.updateWorkout(workoutId, { weeklyOverrides: workout.weeklyOverrides }).pipe(
        map(() => {
          console.log('Weekly override saved successfully');
          return;
        })
      );
    }
    
    return throwError(() => new Error('Workout not found'));
  }

  // Method to remove a weekly override
  removeWeeklyOverride(workoutId: string, targetDate: Date): Observable<void> {
    const dateString = this.formatDateForOverride(targetDate);
    const currentWorkouts = this.loadWorkoutsFromStorage();
    const workoutIndex = currentWorkouts.findIndex(w => w.id === workoutId);
    
    if (workoutIndex !== -1) {
      const workout = currentWorkouts[workoutIndex];
      
      if (workout.weeklyOverrides && workout.weeklyOverrides[dateString]) {
        delete workout.weeklyOverrides[dateString];
        
        // Clean up empty weeklyOverrides object
        if (Object.keys(workout.weeklyOverrides).length === 0) {
          delete workout.weeklyOverrides;
        }
        
        // Update localStorage immediately
        this.updateWorkoutInStorage(workout);
        
        // Update in Firestore
        return this.updateWorkout(workoutId, { weeklyOverrides: workout.weeklyOverrides });
      }
    }
    
    return of();
  }

  /**
   * Check if a workout is scheduled for today
   */
  isWorkoutScheduledForToday(workout: Workout): boolean {
    if (!workout.schedule || !workout.schedule.isActive) {
      return false;
    }
    
    const today = new Date().getDay();
    return workout.schedule.daysOfWeek.includes(today);
  }

  /**
   * Get the next scheduled date for a workout
   */
  getNextScheduledDate(workout: Workout): Date | null {
    if (!workout.schedule || !workout.schedule.isActive || workout.schedule.daysOfWeek.length === 0) {
      return null;
    }

    const today = new Date();
    const currentDay = today.getDay();
    
    // Find the next scheduled day
    let nextDay = -1;
    let daysToAdd = 1;
    
    // Look for the next scheduled day in the current week
    for (let i = 1; i <= 7; i++) {
      const checkDay = (currentDay + i) % 7;
      if (workout.schedule.daysOfWeek.includes(checkDay)) {
        nextDay = checkDay;
        daysToAdd = i;
        break;
      }
    }
    
    if (nextDay === -1) {
      return null; // No scheduled days found
    }
    
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysToAdd);
    
    // If there's a specific time, set it
    if (workout.schedule.time) {
      const [hours, minutes] = workout.schedule.time.split(':').map(Number);
      nextDate.setHours(hours, minutes, 0, 0);
    }
    
    return nextDate;
  }

  // Training Program methods

  /**
   * Create a new training program for the current user
   */
  createTrainingProgram(program: Omit<TrainingProgram, 'id' | 'userId'>): Observable<string> {
    const user = this.authService.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to create training programs');
    }

    // Clean up the program data to remove undefined values
    const cleanProgramData = this.cleanFirestoreData({
      ...program,
      userId: user.uid,
      dateCreated: Timestamp.fromDate(program.dateCreated || new Date()),
      dateStarted: program.dateStarted ? Timestamp.fromDate(program.dateStarted) : null,
      dateCompleted: program.dateCompleted ? Timestamp.fromDate(program.dateCompleted) : null
    });

    const programsRef = collection(this.firestore, 'trainingPrograms');
    return from(addDoc(programsRef, cleanProgramData)).pipe(
      map(docRef => docRef.id)
    );
  }

  /**
   * Get all training programs for the current user
   */
  getUserTrainingPrograms(): Observable<TrainingProgram[]> {
    const user = this.authService.currentUser;
    if (!user) {
      return of([]);
    }

    const programsRef = collection(this.firestore, 'trainingPrograms');
    const userProgramsQuery = query(
      programsRef,
      where('userId', '==', user.uid),
      orderBy('dateCreated', 'desc')
    );

    return from(getDocs(userProgramsQuery)).pipe(
      map(snapshot => {
        return snapshot.docs.map(doc => this.convertFirestoreTrainingProgram(doc.id, doc.data()));
      })
    );
  }

  /**
   * Get a specific training program by ID
   */
  getTrainingProgram(programId: string): Observable<TrainingProgram | null> {
    const programRef = doc(this.firestore, 'trainingPrograms', programId);
    return from(getDoc(programRef)).pipe(
      map(docSnapshot => {
        if (!docSnapshot.exists()) {
          return null;
        }
        return this.convertFirestoreTrainingProgram(docSnapshot.id, docSnapshot.data());
      })
    );
  }

  /**
   * Update an existing training program
   */
  updateTrainingProgram(programId: string, updates: Partial<TrainingProgram>): Observable<void> {
    const user = this.authService.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to update training programs');
    }

    // Convert Date objects to Firestore Timestamps and clean data
    const firestoreUpdates: any = { ...updates };
    if (firestoreUpdates.dateCreated) {
      firestoreUpdates.dateCreated = Timestamp.fromDate(firestoreUpdates.dateCreated);
    }
    if (firestoreUpdates.dateStarted) {
      firestoreUpdates.dateStarted = Timestamp.fromDate(firestoreUpdates.dateStarted);
    }
    if (firestoreUpdates.dateCompleted) {
      firestoreUpdates.dateCompleted = Timestamp.fromDate(firestoreUpdates.dateCompleted);
    }

    const cleanedUpdates = this.cleanFirestoreData(firestoreUpdates);
    const programRef = doc(this.firestore, 'trainingPrograms', programId);
    return from(updateDoc(programRef, cleanedUpdates));
  }

  /**
   * Delete a training program
   */
  deleteTrainingProgram(programId: string): Observable<void> {
    const user = this.authService.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to delete training programs');
    }

    const programRef = doc(this.firestore, 'trainingPrograms', programId);
    return from(deleteDoc(programRef));
  }

  /**
   * Convert Firestore document data to TrainingProgram interface
   */
  private convertFirestoreTrainingProgram(id: string, data: DocumentData): TrainingProgram {
    return {
      id,
      userId: data['userId'],
      name: data['name'],
      description: data['description'],
      duration: data['duration'],
      workouts: data['workouts'] || [],
      weeklySchedule: data['weeklySchedule'] || [],
      isActive: data['isActive'] || false,
      dateCreated: data['dateCreated']?.toDate() || new Date(),
      dateStarted: data['dateStarted']?.toDate() || undefined,
      dateCompleted: data['dateCompleted']?.toDate() || undefined
    };
  }

  // Generic Firestore methods (keeping for future use)

  /**
   * Create a document in any collection
   */
  create(collectionName: string, data: any): Observable<string> {
    const collectionRef = collection(this.firestore, collectionName);
    return from(addDoc(collectionRef, data)).pipe(
      map(docRef => docRef.id)
    );
  }

  /**
   * Read document(s) from a collection
   */
  read(collectionName: string, id?: string): Observable<any> {
    if (id) {
      // Read single document
      const docRef = doc(this.firestore, collectionName, id);
      return from(getDoc(docRef)).pipe(
        map(docSnapshot => {
          if (!docSnapshot.exists()) {
            return null;
          }
          return { id: docSnapshot.id, ...docSnapshot.data() };
        })
      );
    } else {
      // Read all documents in collection
      const collectionRef = collection(this.firestore, collectionName);
      return from(getDocs(collectionRef)).pipe(
        map(snapshot => 
          snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        )
      );
    }
  }

  /**
   * Update a document
   */
  update(collectionName: string, id: string, data: any): Observable<void> {
    const docRef = doc(this.firestore, collectionName, id);
    return from(updateDoc(docRef, data));
  }

  /**
   * Delete a document
   */
  delete(collectionName: string, id: string): Observable<void> {
    const docRef = doc(this.firestore, collectionName, id);
    return from(deleteDoc(docRef));
  }

  /**
   * Query documents with conditions
   */
  query(collectionName: string, conditions: QueryConstraint[]): Observable<any[]> {
    const collectionRef = collection(this.firestore, collectionName);
    const q = query(collectionRef, ...conditions);
    
    return from(getDocs(q)).pipe(
      map(snapshot => 
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      )
    );
  }

  /**
   * Convert Firestore document data to Workout interface
   */
  private convertFirestoreWorkout(id: string, data: DocumentData): Workout {
    // Convert completion log dates from Firestore timestamps
    let completionLog = data['completionLog'];
    if (completionLog && Array.isArray(completionLog)) {
      completionLog = completionLog.map((entry: any) => ({
        ...entry,
        completedAt: entry.completedAt?.toDate ? entry.completedAt.toDate() : new Date(entry.completedAt)
      }));
    }

    return {
      id,
      userId: data['userId'],
      title: data['title'],
      description: data['description'],
      youtubeUrl: data['youtubeUrl'],
      youtubeId: data['youtubeId'],
      thumbnailUrl: data['thumbnailUrl'],
      duration: data['duration'],
      trainer: data['trainer'],
      category: data['category'],
      difficulty: data['difficulty'],
      equipment: data['equipment'] || [],
      bodyParts: data['bodyParts'] || [],
      calories: data['calories'],
      dateAdded: data['dateAdded']?.toDate() || new Date(),
      dateCompleted: data['dateCompleted']?.toDate() || undefined,
      completedCount: data['completedCount'] || 0,
      completionLog: completionLog || [],
      isFavorite: data['isFavorite'] || false,
      notes: data['notes'],
      schedule: data['schedule'],
      weeklyOverrides: data['weeklyOverrides']
    };
  }

  /**
   * Clean data for Firestore by removing undefined values and handling nested objects
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
          // Special handling for schedule object
          if (key === 'schedule' && value) {
            const scheduleData = value as any;
            const cleanedSchedule: any = {};
            
            // Only include defined schedule fields
            if (scheduleData.daysOfWeek !== undefined) {
              cleanedSchedule.daysOfWeek = scheduleData.daysOfWeek;
            }
            if (scheduleData.time !== undefined && scheduleData.time !== null && scheduleData.time !== '') {
              cleanedSchedule.time = scheduleData.time;
            }
            if (scheduleData.repeatWeekly !== undefined) {
              cleanedSchedule.repeatWeekly = scheduleData.repeatWeekly;
            }
            if (scheduleData.isActive !== undefined) {
              cleanedSchedule.isActive = scheduleData.isActive;
            }
            
            // Only include schedule if it has meaningful data
            if (Object.keys(cleanedSchedule).length > 0) {
              cleaned[key] = cleanedSchedule;
            }
          } else if (key === 'completionLog' && Array.isArray(value)) {
            // Special handling for completion log to convert dates to Firestore timestamps
            cleaned[key] = value.map(entry => ({
              ...entry,
              completedAt: entry.completedAt instanceof Date ? Timestamp.fromDate(entry.completedAt) : entry.completedAt
            }));
          } else {
            cleaned[key] = this.cleanFirestoreData(value);
          }
        }
      }
      
      return cleaned;
    }

    return data;
  }

  private cleanUndefinedValues(obj: any): any {
    const cleaned: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          // Recursively clean nested objects
          const cleanedValue = this.cleanUndefinedValues(value);
          if (Object.keys(cleanedValue).length > 0) {
            cleaned[key] = cleanedValue;
          }
        } else {
          cleaned[key] = value;
        }
      }
    }
    
    return cleaned;
  }

  /**
   * Get all workout completions across all workouts, sorted by completion date
   */
  getAllCompletions(): Observable<{workout: Workout, completion: WorkoutCompletion}[]> {
    return this.getUserWorkouts().pipe(
      map(workouts => {
        const allCompletions: {workout: Workout, completion: WorkoutCompletion}[] = [];
        
        workouts.forEach(workout => {
          if (workout.completionLog && workout.completionLog.length > 0) {
            workout.completionLog.forEach(completion => {
              allCompletions.push({ workout, completion });
            });
          }
        });
        
        // Sort by completion date (most recent first)
        return allCompletions.sort((a, b) => 
          new Date(b.completion.completedAt).getTime() - new Date(a.completion.completedAt).getTime()
        );
      })
    );
  }

  /**
   * Get completion statistics
   */
  getCompletionStats(): Observable<{
    totalCompletions: number;
    thisWeek: number;
    thisMonth: number;
    currentStreak: number;
  }> {
    return this.getAllCompletions().pipe(
      map(completions => {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const thisWeek = completions.filter(c => 
          new Date(c.completion.completedAt) >= startOfWeek
        ).length;
        
        const thisMonth = completions.filter(c => 
          new Date(c.completion.completedAt) >= startOfMonth
        ).length;
        
        // Calculate current streak
        let currentStreak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 0; i >= -30; i--) { // Check last 30 days
          const checkDate = new Date(today);
          checkDate.setDate(today.getDate() + i);
          
          const hasCompletion = completions.some(c => {
            const completionDate = new Date(c.completion.completedAt);
            completionDate.setHours(0, 0, 0, 0);
            return completionDate.getTime() === checkDate.getTime();
          });
          
          if (hasCompletion) {
            currentStreak++;
          } else if (i < 0) {
            break; // Stop counting streak if we hit a day with no workouts
          }
        }
        
        return {
          totalCompletions: completions.length,
          thisWeek,
          thisMonth,
          currentStreak
        };
      })
    );
  }

  // Clear localStorage when user logs out
  clearUserData(): void {
    this.clearWorkoutsStorage();
  }

  // ====================== USER PREFERENCES & GOALS ======================

  /**
   * Create or update user preferences and goals
   */
  saveUserPreferences(preferences: Omit<UserPreferences, 'id'>): Observable<string> {
    if (!this.authService.currentUser) {
      return throwError(() => new Error('User not authenticated'));
    }

    const preferencesData = this.cleanFirestoreData({
      ...preferences,
      userId: this.authService.currentUser.uid,
      lastUpdated: new Date()
    });

    return from(addDoc(collection(this.firestore, 'userPreferences'), preferencesData)).pipe(
      map(docRef => {
        console.log('User preferences saved with ID:', docRef.id);
        return docRef.id;
      })
    );
  }

  /**
   * Get user preferences and goals
   */
  getUserPreferences(): Observable<UserPreferences | null> {
    if (!this.authService.currentUser) {
      return throwError(() => new Error('User not authenticated'));
    }

    const preferencesRef = collection(this.firestore, 'userPreferences');
    const q = query(preferencesRef, where('userId', '==', this.authService.currentUser.uid));

    return from(getDocs(q)).pipe(
      map(querySnapshot => {
        if (querySnapshot.empty) {
          return null;
        }

        const doc = querySnapshot.docs[0];
        return this.convertFirestoreUserPreferences(doc.id, doc.data());
      })
    );
  }

  /**
   * Update user preferences
   */
  updateUserPreferences(preferencesId: string, updates: Partial<UserPreferences>): Observable<void> {
    const cleanedUpdates = this.cleanFirestoreData({
      ...updates,
      lastUpdated: new Date()
    });

    return from(updateDoc(doc(this.firestore, 'userPreferences', preferencesId), cleanedUpdates));
  }

  /**
   * Update user goals only
   */
  updateUserGoals(goals: Partial<UserGoals>): Observable<void> {
    return this.getUserPreferences().pipe(
      switchMap(preferences => {
        if (!preferences) {
          // Create new preferences if none exist
          const newPreferences: Omit<UserPreferences, 'id'> = {
            userId: this.authService.currentUser!.uid,
            goals: {
              userId: this.authService.currentUser!.uid,
              weeklyWorkoutGoal: goals.weeklyWorkoutGoal || 3,
              weeklyMinuteGoal: goals.weeklyMinuteGoal || 150,
              dateCreated: new Date(),
              lastUpdated: new Date()
            },
            hasCompletedOnboarding: true,
            dateCreated: new Date(),
            lastUpdated: new Date()
          };
          return this.saveUserPreferences(newPreferences).pipe(map(() => void 0));
        } else {
          // Update existing preferences
          const updatedGoals = {
            ...preferences.goals,
            ...goals,
            lastUpdated: new Date()
          };
          
          return this.updateUserPreferences(preferences.id!, {
            goals: updatedGoals
          });
        }
      })
    );
  }

  /**
   * Mark onboarding as completed
   */
  completeOnboarding(goals: UserGoals): Observable<void> {
    const newPreferences: Omit<UserPreferences, 'id'> = {
      userId: this.authService.currentUser!.uid,
      goals: {
        ...goals,
        userId: this.authService.currentUser!.uid,
        dateCreated: new Date(),
        lastUpdated: new Date()
      },
      hasCompletedOnboarding: true,
      dateCreated: new Date(),
      lastUpdated: new Date()
    };

    return this.saveUserPreferences(newPreferences).pipe(map(() => void 0));
  }

  /**
   * Check if user has completed onboarding
   */
  hasCompletedOnboarding(): Observable<boolean> {
    return this.getUserPreferences().pipe(
      map(preferences => preferences?.hasCompletedOnboarding || false)
    );
  }

  /**
   * Get user's weekly goals with defaults
   */
  getUserGoals(): Observable<UserGoals> {
    return this.getUserPreferences().pipe(
      map(preferences => {
        if (preferences?.goals) {
          return preferences.goals;
        }
        
        // Return default goals if none exist
        return {
          userId: this.authService.currentUser!.uid,
          weeklyWorkoutGoal: 3,
          weeklyMinuteGoal: 150,
          dateCreated: new Date(),
          lastUpdated: new Date()
        };
      })
    );
  }

  /**
   * Convert Firestore document data to UserPreferences interface
   */
  private convertFirestoreUserPreferences(id: string, data: DocumentData): UserPreferences {
    return {
      id,
      userId: data['userId'],
      goals: {
        id: data['goals']?.id,
        userId: data['goals']?.userId || data['userId'],
        weeklyWorkoutGoal: data['goals']?.weeklyWorkoutGoal || 3,
        weeklyMinuteGoal: data['goals']?.weeklyMinuteGoal || 150,
        dateCreated: data['goals']?.dateCreated?.toDate() || new Date(),
        lastUpdated: data['goals']?.lastUpdated?.toDate() || new Date()
      },
      hasCompletedOnboarding: data['hasCompletedOnboarding'] || false,
      dateCreated: data['dateCreated']?.toDate() || new Date(),
      lastUpdated: data['lastUpdated']?.toDate() || new Date()
    };
  }
} 