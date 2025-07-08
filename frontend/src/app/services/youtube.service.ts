import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { YouTubeVideoInfo } from '../models/workout.model';

@Injectable({
  providedIn: 'root'
})
export class YouTubeService {

  constructor(private http: HttpClient) {}

  /**
   * Extract YouTube video ID from various YouTube URL formats
   */
  extractVideoId(url: string): string | null {
    const regexPatterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
      /youtu\.be\/([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/
    ];

    for (const pattern of regexPatterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Validate if the URL is a valid YouTube URL
   */
  isValidYouTubeUrl(url: string): boolean {
    return this.extractVideoId(url) !== null;
  }

  /**
   * Get video information using YouTube oEmbed API (no API key required)
   * This gives us basic info like title, channel, and thumbnail
   */
  getVideoInfoBasic(videoId: string): Observable<Partial<YouTubeVideoInfo>> {
    const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    
    return this.http.get<any>(oEmbedUrl).pipe(
      map(response => ({
        id: videoId,
        title: response.title,
        channelTitle: response.author_name,
        thumbnailUrl: response.thumbnail_url,
        description: '', // oEmbed doesn't provide description
        duration: 0, // oEmbed doesn't provide duration
        publishedAt: ''
      })),
      catchError(error => {
        console.error('Error fetching video info:', error);
        return throwError(() => new Error('Failed to fetch video information. Please check the YouTube URL.'));
      })
    );
  }

  /**
   * Parse duration from YouTube duration format (PT#M#S) to seconds
   */
  parseDuration(duration: string): number {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;

    const hours = match[1] ? parseInt(match[1].replace('H', '')) : 0;
    const minutes = match[2] ? parseInt(match[2].replace('M', '')) : 0;
    const seconds = match[3] ? parseInt(match[3].replace('S', '')) : 0;

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Format duration from seconds to human readable format
   */
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Get thumbnail URL for a video ID
   */
  getThumbnailUrl(videoId: string, quality: 'default' | 'medium' | 'high' | 'maxres' = 'medium'): string {
    const qualityMap = {
      'default': 'default',
      'medium': 'mqdefault',
      'high': 'hqdefault',
      'maxres': 'maxresdefault'
    };
    
    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
  }

  /**
   * Create YouTube watch URL from video ID
   */
  getWatchUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  /**
   * Create YouTube embed URL from video ID
   */
  getEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  /**
   * TODO: Future implementation with YouTube Data API v3
   * This would require a backend service to hide the API key
   * and provide more detailed information like duration, description, etc.
   */
  getVideoInfoDetailed(videoId: string): Observable<YouTubeVideoInfo> {
    // This would be implemented when we have a backend
    // For now, we'll use the basic info and manual duration input
    return throwError(() => new Error('Detailed video info requires backend implementation'));
  }
} 