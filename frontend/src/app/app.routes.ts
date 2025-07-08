import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { SignupsComponent } from './signups/signups.component';
import { SigninComponent } from './signin/signin.component';
import { DashboardComponent } from './dashboard/dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'signup', component: SignupsComponent },
  { path: 'signin', component: SigninComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: '**', redirectTo: '/home' } // Wildcard route for 404s
];
