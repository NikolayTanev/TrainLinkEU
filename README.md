# TrainLink 2.0

A modern web application built with Angular frontend and Firebase backend for training management.

## Project Structure

```
trainlink2.0/
├── frontend/                 # Angular application
│   ├── src/
│   │   ├── app/
│   │   │   ├── services/     # Firebase services
│   │   │   └── ...
│   │   ├── environments/     # Environment configurations
│   │   └── ...
│   └── ...
├── backend/                  # Firebase Cloud Functions
│   ├── src/
│   │   └── index.ts         # Main functions file
│   ├── package.json
│   └── tsconfig.json
├── firebase.json            # Firebase configuration
├── firestore.rules          # Firestore security rules
├── firestore.indexes.json   # Firestore indexes
└── storage.rules            # Firebase Storage rules
```

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Firebase CLI
- Angular CLI

## Setup Instructions

### 1. Firebase Setup

1. **Login to Firebase:**
   ```bash
   firebase login
   ```

2. **Create a new Firebase project:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Authentication, Firestore, and Storage

3. **Initialize Firebase in your project:**
   ```bash
   firebase init
   ```
   - Select Functions, Firestore, Hosting, and Storage
   - Choose your Firebase project
   - Accept the default settings

4. **Update environment files:**
   - Get your Firebase config from the Firebase Console
   - Update `frontend/src/environments/environment.ts` and `environment.prod.ts`
   - Replace the placeholder values with your actual Firebase config

### 2. Backend Setup

1. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Build and test functions:**
   ```bash
   npm run build
   npm run serve  # Start local emulator
   ```

### 3. Frontend Setup

1. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install firebase @angular/fire@^17.0.0 --legacy-peer-deps
   ```

2. **Update Angular app configuration:**
   - Import Firebase modules in `app.config.ts`
   - Configure AngularFire in your app

3. **Start development server:**
   ```bash
   ng serve
   ```

### 4. Complete Integration

1. **Update Firebase services:**
   - Implement authentication in `frontend/src/app/services/auth.service.ts`
   - Implement data operations in `frontend/src/app/services/data.service.ts`

2. **Configure app.config.ts:**
   ```typescript
   import { initializeApp } from 'firebase/app';
   import { getAuth } from 'firebase/auth';
   import { getFirestore } from 'firebase/firestore';
   import { environment } from '../environments/environment';
   
   // Add to your app.config.ts providers
   ```

## Development

### Frontend Development
```bash
cd frontend
ng serve
```
Navigate to `http://localhost:4200`

### Backend Development
```bash
cd backend
npm run serve
```
Functions will be available at `http://localhost:5001`

### Full Stack Development
```bash
# Terminal 1 - Frontend
cd frontend && ng serve

# Terminal 2 - Backend
cd backend && npm run serve

# Terminal 3 - Firebase Emulator Suite
firebase emulators:start
```

## Deployment

### Deploy Functions
```bash
cd backend
npm run deploy
```

### Deploy Frontend
```bash
cd frontend
ng build --prod
firebase deploy --only hosting
```

### Deploy All
```bash
firebase deploy
```

## Firebase Configuration

### Authentication
- Email/Password authentication is configured
- Additional providers can be added in Firebase Console

### Firestore
- Basic security rules are set up (authenticated users only)
- Modify `firestore.rules` for your specific needs

### Storage
- Basic security rules are set up (authenticated users only)
- Modify `storage.rules` for your specific needs

## Available Scripts

### Frontend
- `ng serve` - Development server
- `ng build` - Build for production
- `ng test` - Run unit tests
- `ng lint` - Lint the code

### Backend
- `npm run build` - Build TypeScript
- `npm run serve` - Start local emulator
- `npm run deploy` - Deploy to Firebase
- `npm run logs` - View function logs

## Next Steps

1. **Configure Firebase project settings**
2. **Install Firebase dependencies in frontend**
3. **Implement authentication flow**
4. **Create your first components and services**
5. **Set up routing and navigation**
6. **Implement data models and services**

## Notes

- The project uses Angular 17 with standalone components
- Firebase v9+ modular SDK is recommended
- TypeScript is configured for strict mode
- SCSS is set up for styling

## Troubleshooting

- If you encounter peer dependency issues with AngularFire, use `--legacy-peer-deps` flag
- Make sure Firebase CLI is up to date: `npm install -g firebase-tools@latest`
- Check Firebase project settings if deployment fails 