import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feedback.component.html',
  styleUrl: './feedback.component.scss'
})
export class FeedbackComponent {

  openEmailClient(): void {
    // Create mailto link with pre-filled recipient and subject
    const emailAddress = 'trainlink.info@gmail.com';
    const subject = 'TrainLink Feedback';
    const body = 'Hi TrainLink Team,\n\nI have some feedback to share:\n\n[Please share your thoughts, suggestions, or report any issues here]\n\nThanks!';
    
    // Encode the subject and body for URL
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    
    // Create the mailto URL
    const mailtoUrl = `mailto:${emailAddress}?subject=${encodedSubject}&body=${encodedBody}`;
    
    // Open the email client
    window.location.href = mailtoUrl;
  }
}
