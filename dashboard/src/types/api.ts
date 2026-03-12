/** Content status in the pipeline */
export type ContentStatus =
  | "draft"
  | "generating"
  | "review"
  | "approved"
  | "published"
  | "rejected";

/** A piece of content managed by Orion */
export interface Content {
  id: string;
  title: string;
  body: string;
  status: ContentStatus;
  thumbnail_url?: string;
  video_url?: string;
  script?: string;
  confidence_score?: number;
  trend_id?: string;
  created_at: string;
  updated_at?: string;
  published_at?: string;
}

/** A detected content trend */
export interface Trend {
  id: string;
  topic: string;
  score: number;
  source?: string;
  keywords?: string[];
  detected_at: string;
}

/** A media asset (image, video, audio) */
export interface MediaAsset {
  id: string;
  content_id: string;
  type: "image" | "video" | "audio";
  url: string;
  duration?: number;
  width?: number;
  height?: number;
  file_size?: number;
  created_at: string;
}

/** An external AI/content provider */
export interface Provider {
  id: string;
  name: string;
  type: string;
  config: Record<string, string>;
}

/** Script segment with timestamp for video overlay */
export interface ScriptSegment {
  id: string;
  content_id: string;
  text: string;
  start_time: number;
  end_time: number;
  order: number;
}

/** User session info */
export interface User {
  id: string;
  username: string;
  email: string;
  role: "admin" | "editor" | "viewer";
}

/** Auth response from login */
export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

/** Content action feedback (for reject) */
export interface ContentFeedback {
  reason: string;
  regenerate: boolean;
}

/** A record of content published to a social platform */
export interface PublishRecord {
  id: string;
  content_id: string;
  platform: string;
  platform_post_id: string | null;
  status: "pending" | "published" | "failed";
  error_message: string | null;
  published_at: string | null;
  created_at: string;
}

/** Request to publish content */
export interface PublishRequest {
  content_id: string;
  platforms: string[];
}

/** Response from publishing */
export interface PublishResponse {
  content_id: string;
  results: Array<{
    platform: string;
    status: string;
    platform_post_id: string | null;
    error: string | null;
  }>;
  published_at: string | null;
}

/** A connected social media account */
export interface SocialAccount {
  id: string;
  platform: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
}
