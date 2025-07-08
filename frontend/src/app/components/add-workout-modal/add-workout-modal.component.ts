import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { YouTubeService } from '../../services/youtube.service';
import { Workout, WorkoutCategory, WorkoutDifficulty, WorkoutFormData, YouTubeVideoInfo, DayOfWeek, DayOption, WorkoutSchedule } from '../../models/workout.model';

@Component({
  selector: 'app-add-workout-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './add-workout-modal.component.html',
  styleUrl: './add-workout-modal.component.scss'
})
export class AddWorkoutModalComponent implements OnInit {
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() workoutAdded = new EventEmitter<Omit<Workout, 'id' | 'userId'>>();

  // Two-step process
  currentStep = 1;
  maxSteps = 2;

  workoutForm: FormGroup;
  isLoading = false;
  error = '';
  videoInfo: Partial<YouTubeVideoInfo> | null = null;
  showAdvancedOptions = false;
  
  // Scheduling data
  selectedDays: DayOfWeek[] = [];
  scheduleTime = '';
  repeatWeekly = true;

  // Day options for the scheduler
  dayOptions: DayOption[] = [
    { value: DayOfWeek.MONDAY, label: 'Monday', shortLabel: 'Mon' },
    { value: DayOfWeek.TUESDAY, label: 'Tuesday', shortLabel: 'Tue' },
    { value: DayOfWeek.WEDNESDAY, label: 'Wednesday', shortLabel: 'Wed' },
    { value: DayOfWeek.THURSDAY, label: 'Thursday', shortLabel: 'Thu' },
    { value: DayOfWeek.FRIDAY, label: 'Friday', shortLabel: 'Fri' },
    { value: DayOfWeek.SATURDAY, label: 'Saturday', shortLabel: 'Sat' },
    { value: DayOfWeek.SUNDAY, label: 'Sunday', shortLabel: 'Sun' }
  ];
  
  // Default categories
  categories: WorkoutCategory[] = [
    { id: 'strength', name: 'Strength', icon: '💪', color: '#ff6b35' },
    { id: 'cardio', name: 'Cardio', icon: '❤️', color: '#4CAF50' },
    { id: 'yoga', name: 'Yoga', icon: '🧘‍♀️', color: '#9C27B0' },
    { id: 'hiit', name: 'HIIT', icon: '⚡', color: '#FF9800' },
    { id: 'pilates', name: 'Pilates', icon: '🤸‍♀️', color: '#E91E63' },
    { id: 'dance', name: 'Dance', icon: '💃', color: '#3F51B5' },
    { id: 'stretching', name: 'Stretching', icon: '🤸', color: '#00BCD4' },
    { id: 'other', name: 'Other', icon: '🏃‍♂️', color: '#607D8B' }
  ];

  difficulties = Object.values(WorkoutDifficulty);

  equipmentOptions = [
    'No Equipment', 'Dumbbells', 'Resistance Bands', 'Yoga Mat', 
    'Kettlebell', 'Barbell', 'Pull-up Bar', 'Medicine Ball', 
    'Foam Roller', 'Stability Ball'
  ];

  bodyPartOptions = [
    'Full Body', 'Upper Body', 'Lower Body', 'Core', 'Arms', 
    'Legs', 'Chest', 'Back', 'Shoulders', 'Glutes', 'Abs'
  ];

  constructor(
    private fb: FormBuilder,
    private youtubeService: YouTubeService
  ) {
    this.workoutForm = this.createForm();
  }

  ngOnInit() {
    // Reset form when modal opens
    if (this.isOpen) {
      this.resetForm();
    }
  }

  // Step navigation
  nextStep() {
    if (this.currentStep === 1 && this.isStep1Valid()) {
      this.currentStep = 2;
    }
  }

  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  isStep1Valid(): boolean {
    const requiredFields = ['youtubeUrl', 'category'];
    return requiredFields.every(field => {
      const control = this.workoutForm.get(field);
      return control && control.valid && control.value;
    }) && this.videoInfo !== null;
  }

  // Day selection for scheduling
  toggleDay(day: DayOfWeek) {
    const index = this.selectedDays.indexOf(day);
    if (index > -1) {
      this.selectedDays.splice(index, 1);
    } else {
      this.selectedDays.push(day);
    }
  }

  isDaySelected(day: DayOfWeek): boolean {
    return this.selectedDays.includes(day);
  }

  getDayLabel(day: DayOfWeek): string {
    const dayOption = this.dayOptions.find(d => d.value === day);
    return dayOption ? dayOption.shortLabel : '';
  }

  getSelectedDaysLabels(): string {
    return this.selectedDays
      .map(day => this.getDayLabel(day))
      .join(', ');
  }

  toggleAdvancedOptions() {
    this.showAdvancedOptions = !this.showAdvancedOptions;
  }

  createForm(): FormGroup {
    return this.fb.group({
      youtubeUrl: ['', [Validators.required, this.youtubeUrlValidator.bind(this)]],
      customTitle: [''],
      category: ['', Validators.required],
      difficulty: [''],
      duration: [0, [Validators.min(1)]],
      equipment: [[]],
      bodyParts: [[]],
      notes: ['']
    });
  }

  youtubeUrlValidator(control: any) {
    if (!control.value) return null;
    const isValid = this.youtubeService.isValidYouTubeUrl(control.value);
    return isValid ? null : { invalidYouTubeUrl: true };
  }

  async onYouTubeUrlChange() {
    const url = this.workoutForm.get('youtubeUrl')?.value;
    if (!url || !this.youtubeService.isValidYouTubeUrl(url)) {
      this.videoInfo = null;
      return;
    }

    this.isLoading = true;
    this.error = '';

    try {
      const videoId = this.youtubeService.extractVideoId(url);
      if (videoId) {
        const videoInfoResult = await this.youtubeService.getVideoInfoBasic(videoId).toPromise();
        this.videoInfo = videoInfoResult || null;
        
        // Auto-fill form fields with video info
        if (this.videoInfo) {
          if (!this.workoutForm.get('customTitle')?.value) {
            this.workoutForm.patchValue({
              customTitle: this.videoInfo.title
            });
          }
        }
      }
    } catch (error: any) {
      this.error = error.message || 'Failed to fetch video information';
      this.videoInfo = null;
    } finally {
      this.isLoading = false;
    }
  }

  onEquipmentChange(equipment: string, event: any) {
    const currentEquipment = this.workoutForm.get('equipment')?.value || [];
    if (event.target.checked) {
      this.workoutForm.patchValue({
        equipment: [...currentEquipment, equipment]
      });
    } else {
      this.workoutForm.patchValue({
        equipment: currentEquipment.filter((e: string) => e !== equipment)
      });
    }
  }

  onBodyPartChange(bodyPart: string, event: any) {
    const currentBodyParts = this.workoutForm.get('bodyParts')?.value || [];
    if (event.target.checked) {
      this.workoutForm.patchValue({
        bodyParts: [...currentBodyParts, bodyPart]
      });
    } else {
      this.workoutForm.patchValue({
        bodyParts: currentBodyParts.filter((bp: string) => bp !== bodyPart)
      });
    }
  }

  formatDurationInput(minutes: number): string {
    if (minutes <= 0) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

  onSubmit() {
    if (!this.workoutForm.valid) {
      this.markFormGroupTouched();
      return;
    }

    const formData = this.workoutForm.value as WorkoutFormData;
    const videoId = this.youtubeService.extractVideoId(formData.youtubeUrl);
    
    if (!videoId || !this.videoInfo) {
      this.error = 'Invalid YouTube URL or video information not available';
      return;
    }

    const selectedCategory = this.categories.find(c => c.id === formData.category);
    if (!selectedCategory) {
      this.error = 'Please select a valid category';
      return;
    }

    // Create schedule if days are selected
    let schedule: WorkoutSchedule | undefined;
    if (this.selectedDays.length > 0) {
      schedule = {
        daysOfWeek: [...this.selectedDays],
        time: this.scheduleTime || undefined,
        repeatWeekly: this.repeatWeekly,
        isActive: true
      };
    }

    const workout: Omit<Workout, 'id' | 'userId'> = {
      title: formData.customTitle || this.videoInfo.title || 'Untitled Workout',
      description: this.videoInfo.description || '',
      youtubeUrl: formData.youtubeUrl,
      youtubeId: videoId,
      thumbnailUrl: this.videoInfo.thumbnailUrl || this.youtubeService.getThumbnailUrl(videoId),
      duration: formData.duration ? formData.duration * 60 : 0, // Convert minutes to seconds
      trainer: this.videoInfo.channelTitle || 'Unknown Trainer',
      category: selectedCategory,
      difficulty: formData.difficulty,
      equipment: formData.equipment || [],
      bodyParts: formData.bodyParts || [],
      dateAdded: new Date(),
      completedCount: 0,
      isFavorite: false,
      notes: formData.notes,
      schedule
    };

    this.workoutAdded.emit(workout);
    this.close();
  }

  private markFormGroupTouched() {
    Object.keys(this.workoutForm.controls).forEach(key => {
      const control = this.workoutForm.get(key);
      control?.markAsTouched();
    });
  }



  resetForm() {
    this.workoutForm.reset();
    this.videoInfo = null;
    this.error = '';
    this.isLoading = false;
    this.showAdvancedOptions = false;
    
    // Reset step and scheduling data
    this.currentStep = 1;
    this.selectedDays = [];
    this.scheduleTime = '';
    this.repeatWeekly = true;
  }

  close() {
    this.resetForm();
    this.closeModal.emit();
  }

  // Helper methods for template
  isFieldInvalid(fieldName: string): boolean {
    const field = this.workoutForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.workoutForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['invalidYouTubeUrl']) return 'Please enter a valid YouTube URL';
      if (field.errors['min']) return `${fieldName} must be greater than 0`;
    }
    return '';
  }

  isEquipmentSelected(equipment: string): boolean {
    const selectedEquipment = this.workoutForm.get('equipment')?.value || [];
    return selectedEquipment.includes(equipment);
  }

  isBodyPartSelected(bodyPart: string): boolean {
    const selectedBodyParts = this.workoutForm.get('bodyParts')?.value || [];
    return selectedBodyParts.includes(bodyPart);
  }
} 