import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

export type StudioTab = 'plan' | 'video' | 'adapt';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  activeTab: StudioTab = 'plan';

  tabs: { id: StudioTab; label: string }[] = [
    { id: 'plan', label: 'The plan' },
    { id: 'video', label: 'The video' },
    { id: 'adapt', label: 'The week' }
  ];

  setTab(tab: StudioTab) {
    this.activeTab = tab;
  }
}
