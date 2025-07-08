import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Workout } from '../../models/workout.model';

@Component({
  selector: 'app-workout-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workout-player.component.html',
  styleUrl: './workout-player.component.scss'
})
export class WorkoutPlayerComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isOpen = false;
  @Input() workout: Workout | null = null;
  @Output() closePlayer = new EventEmitter<void>();
  @Output() workoutCompleted = new EventEmitter<Workout>();

  embedUrl: SafeResourceUrl | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit() {
    if (this.workout) {
      this.setupVideo();
    }
  }

  ngOnChanges() {
    if (this.workout && this.isOpen) {
      this.setupVideo();
    }
  }

  ngOnDestroy() {
    // Clean up if needed
  }

  private setupVideo() {
    if (this.workout) {
      // Create YouTube embed URL with proper parameters
      const embedUrl = `https://www.youtube.com/embed/${this.workout.youtubeId}?autoplay=0&rel=0&modestbranding=1&controls=1&showinfo=0`;
      this.embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
      console.log('Setting up video with URL:', embedUrl);
    }
  }

  close() {
    this.embedUrl = null;
    this.closePlayer.emit();
  }

  finishWorkout() {
    if (this.workout) {
      this.workoutCompleted.emit(this.workout);
    }
  }

  getDifficultyColor(difficulty?: string): string {
    switch (difficulty?.toLowerCase()) {
      case 'beginner':
        return '#4CAF50';
      case 'intermediate':
        return '#FF9800';
      case 'advanced':
        return '#F44336';
      default:
        return '#8892b0';
    }
  }
} 