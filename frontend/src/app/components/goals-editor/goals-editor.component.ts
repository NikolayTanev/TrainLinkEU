import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { UserGoals } from '../../models/workout.model';

@Component({
  selector: 'app-goals-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './goals-editor.component.html',
  styleUrl: './goals-editor.component.scss'
})
export class GoalsEditorComponent implements OnInit {
  @Input() isOpen = false;
  @Input() currentGoals: UserGoals | null = null;
  @Output() closeModal = new EventEmitter<void>();
  @Output() goalsUpdated = new EventEmitter<UserGoals>();

  weeklyWorkoutGoal = 3;
  weeklyMinuteGoal = 150;
  
  isLoading = false;
  error: string | null = null;

  // Predefined options
  workoutGoalOptions = [
    { value: 1, label: '1 workout', description: 'Just getting started' },
    { value: 2, label: '2 workouts', description: 'Light activity' },
    { value: 3, label: '3 workouts', description: 'Recommended for health' },
    { value: 4, label: '4 workouts', description: 'Active lifestyle' },
    { value: 5, label: '5 workouts', description: 'Very active' },
    { value: 6, label: '6+ workouts', description: 'Fitness enthusiast' }
  ];

  minuteGoalOptions = [
    { value: 75, label: '75 minutes', description: 'Minimum recommendation' },
    { value: 150, label: '150 minutes', description: 'WHO recommended' },
    { value: 225, label: '225 minutes', description: 'Active lifestyle' },
    { value: 300, label: '300 minutes', description: 'Fitness focused' },
    { value: 450, label: '450+ minutes', description: 'High performance' }
  ];

  constructor(private dataService: DataService) {}

  ngOnInit() {
    // Initialize with current goals when component loads
    if (this.currentGoals) {
      this.weeklyWorkoutGoal = this.currentGoals.weeklyWorkoutGoal;
      this.weeklyMinuteGoal = this.currentGoals.weeklyMinuteGoal;
    }
  }

  ngOnChanges() {
    // Update when currentGoals input changes
    if (this.currentGoals) {
      this.weeklyWorkoutGoal = this.currentGoals.weeklyWorkoutGoal;
      this.weeklyMinuteGoal = this.currentGoals.weeklyMinuteGoal;
    }
  }

  onOverlayClick(event: Event) {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  close() {
    this.closeModal.emit();
    this.resetError();
  }

  selectWorkoutGoal(value: number) {
    this.weeklyWorkoutGoal = value;
  }

  selectMinuteGoal(value: number) {
    this.weeklyMinuteGoal = value;
  }

  async saveGoals() {
    this.isLoading = true;
    this.error = null;

    try {
      const updatedGoals: Partial<UserGoals> = {
        weeklyWorkoutGoal: this.weeklyWorkoutGoal,
        weeklyMinuteGoal: this.weeklyMinuteGoal
      };

      await this.dataService.updateUserGoals(updatedGoals).toPromise();
      
      // Emit the updated goals
      const newGoals: UserGoals = {
        ...this.currentGoals!,
        ...updatedGoals,
        lastUpdated: new Date()
      };
      
      this.goalsUpdated.emit(newGoals);
      this.close();
    } catch (error: any) {
      console.error('Error updating goals:', error);
      this.error = 'Failed to update your goals. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  private resetError() {
    this.error = null;
  }

  hasChanges(): boolean {
    if (!this.currentGoals) return true;
    
    return this.weeklyWorkoutGoal !== this.currentGoals.weeklyWorkoutGoal ||
           this.weeklyMinuteGoal !== this.currentGoals.weeklyMinuteGoal;
  }

  getSelectedWorkoutGoalDescription(): string {
    const option = this.workoutGoalOptions.find(opt => opt.value === this.weeklyWorkoutGoal);
    return option?.description || '';
  }

  getSelectedMinuteGoalDescription(): string {
    const option = this.minuteGoalOptions.find(opt => opt.value === this.weeklyMinuteGoal);
    return option?.description || '';
  }
} 