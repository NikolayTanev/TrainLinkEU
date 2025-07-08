import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrainingProgram, ProgramDay, ProgramWorkout, Workout, DayOfWeek } from '../../models/workout.model';

@Component({
  selector: 'app-create-program-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-program-modal.component.html',
  styleUrl: './create-program-modal.component.scss'
})
export class CreateProgramModalComponent {
  @Input() isOpen = false;
  @Input() workouts: Workout[] = [];
  @Output() closeModal = new EventEmitter<void>();
  @Output() programCreated = new EventEmitter<Omit<TrainingProgram, 'id' | 'userId'>>();

  // Form data
  programName = '';
  programDescription = '';
  programDuration = 4; // weeks
  selectedWorkouts: {[workoutId: string]: boolean} = {};
  weeklySchedule: {[day: number]: string[]} = {}; // day -> workout IDs

  readonly daysOfWeek = [
    { index: 0, name: 'Sunday', short: 'Sun' },
    { index: 1, name: 'Monday', short: 'Mon' },
    { index: 2, name: 'Tuesday', short: 'Tue' },
    { index: 3, name: 'Wednesday', short: 'Wed' },
    { index: 4, name: 'Thursday', short: 'Thu' },
    { index: 5, name: 'Friday', short: 'Fri' },
    { index: 6, name: 'Saturday', short: 'Sat' }
  ];

  constructor() {
    // Initialize weekly schedule
    this.daysOfWeek.forEach(day => {
      this.weeklySchedule[day.index] = [];
    });
  }

  close() {
    this.resetForm();
    this.closeModal.emit();
  }

  toggleWorkoutSelection(workoutId: string) {
    this.selectedWorkouts[workoutId] = !this.selectedWorkouts[workoutId];
  }

  isWorkoutSelected(workoutId: string): boolean {
    return !!this.selectedWorkouts[workoutId];
  }

  getSelectedWorkouts(): Workout[] {
    return this.workouts.filter(workout => this.selectedWorkouts[workout.id]);
  }

  addWorkoutToDay(dayIndex: number, workoutId: string) {
    if (!this.weeklySchedule[dayIndex].includes(workoutId)) {
      this.weeklySchedule[dayIndex].push(workoutId);
    }
  }

  removeWorkoutFromDay(dayIndex: number, workoutId: string) {
    const index = this.weeklySchedule[dayIndex].indexOf(workoutId);
    if (index > -1) {
      this.weeklySchedule[dayIndex].splice(index, 1);
    }
  }

  isWorkoutScheduledOnDay(dayIndex: number, workoutId: string): boolean {
    return this.weeklySchedule[dayIndex].includes(workoutId);
  }

  canCreateProgram(): boolean {
    return this.programName.trim().length > 0 && 
           this.getSelectedWorkouts().length > 0 &&
           this.hasScheduledWorkouts();
  }

  private hasScheduledWorkouts(): boolean {
    return Object.values(this.weeklySchedule).some(day => day.length > 0);
  }

  createProgram() {
    if (!this.canCreateProgram()) return;

    // Build the weekly schedule structure
    const weeklySchedule: ProgramDay[] = this.daysOfWeek.map(day => ({
      dayOfWeek: day.index as DayOfWeek,
      workouts: this.weeklySchedule[day.index].map(workoutId => ({
        workoutId: workoutId,
        dayOfWeek: day.index as DayOfWeek,
        order: this.weeklySchedule[day.index].indexOf(workoutId)
      }))
    }));

    const newProgram: Omit<TrainingProgram, 'id' | 'userId'> = {
      name: this.programName.trim(),
      description: this.programDescription.trim(),
      duration: this.programDuration,
      workouts: this.getSelectedWorkouts(), // Use actual Workout objects
      weeklySchedule: weeklySchedule,
      isActive: false,
      dateCreated: new Date()
    };

    this.programCreated.emit(newProgram);
    this.resetForm();
    this.close();
  }

  private resetForm() {
    this.programName = '';
    this.programDescription = '';
    this.programDuration = 4;
    this.selectedWorkouts = {};
    this.daysOfWeek.forEach(day => {
      this.weeklySchedule[day.index] = [];
    });
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}min`;
  }

  getWorkoutById(workoutId: string): Workout | undefined {
    return this.workouts.find(workout => workout.id === workoutId);
  }

  onWorkoutSelection(dayIndex: number, event: Event) {
    const select = event.target as HTMLSelectElement;
    if (select.value) {
      this.addWorkoutToDay(dayIndex, select.value);
      select.value = ''; // Reset the select
    }
  }
}
