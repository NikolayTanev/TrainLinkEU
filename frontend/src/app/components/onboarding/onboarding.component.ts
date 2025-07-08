import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { AuthService } from '../../services/auth.service';
import { UserGoals } from '../../models/workout.model';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss'
})
export class OnboardingComponent implements OnInit {
  @Output() onboardingCompleted = new EventEmitter<void>();

  currentStep = 1;
  totalSteps = 3;
  
  // User goals
  weeklyWorkoutGoal = 3;
  weeklyMinuteGoal = 150;
  
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

  isLoading = false;
  error: string | null = null;

  constructor(
    private dataService: DataService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Set reasonable defaults
    this.weeklyWorkoutGoal = 3;
    this.weeklyMinuteGoal = 150;
  }

  nextStep() {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  selectWorkoutGoal(value: number) {
    this.weeklyWorkoutGoal = value;
  }

  selectMinuteGoal(value: number) {
    this.weeklyMinuteGoal = value;
  }

  async completeOnboarding() {
    this.isLoading = true;
    this.error = null;

    try {
      const goals: UserGoals = {
        userId: this.authService.currentUser!.uid,
        weeklyWorkoutGoal: this.weeklyWorkoutGoal,
        weeklyMinuteGoal: this.weeklyMinuteGoal,
        dateCreated: new Date(),
        lastUpdated: new Date()
      };

      await this.dataService.completeOnboarding(goals).toPromise();
      
      this.onboardingCompleted.emit();
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      this.error = 'Failed to save your goals. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  getProgressPercentage(): number {
    return (this.currentStep / this.totalSteps) * 100;
  }

  isStepValid(): boolean {
    switch (this.currentStep) {
      case 1:
        return true; // Welcome step is always valid
      case 2:
        return this.weeklyWorkoutGoal > 0;
      case 3:
        return this.weeklyMinuteGoal > 0;
      default:
        return false;
    }
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