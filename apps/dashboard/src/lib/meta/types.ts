// Meta API Types
export interface MetaAuthUrlParams {
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  response_type: 'code';
}

export interface MetaTokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in?: number;
}

export interface MetaPageInfo {
  id: string;
  name: string;
  access_token?: string;
  picture?: {
    data?: {
      height: number;
      width: number;
      is_silhouette: boolean;
      url: string;
    };
  };
  username?: string;
  instagram_business_account?: {
    id: string;
  };
}

export interface MetaPageListResponse {
  data: MetaPageInfo[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
  };
}

// Publication Types
export type PublicationStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';
export type PublicationPlatform = 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'YOUTUBE';

export interface ScheduleFormData {
  description: string;
  hashtags: string[];
  platforms: PublicationPlatform[];
  scheduledFor: string;
  metaAccountId?: string;
  tiktokAccountId?: string;
  youtubeAccountId?: string;
  method?: 'API' | 'SCRAPE';
  saveAsTemplate?: boolean;
  templateName?: string;
}

export interface PublicationDTO {
  id: string;
  videoId: string;
  description: string;
  hashtags: string[];
  platforms: PublicationPlatform[];
  scheduledFor: Date;
  status: PublicationStatus;
  metaPostId?: string;
  errorMessage?: string;
  publishedAt?: Date;
}

export interface TemplateDTO {
  id: string;
  name: string;
  description: string;
  hashtags: string[];
  platforms: PublicationPlatform[];
}

export interface MetaAccountDTO {
  id: string;
  pageName: string;
  pageUsername?: string;
  profilePictureUrl?: string;
  isActive: boolean;
  connectedAt: Date;
}

export interface TikTokAccountDTO {
  id: string;
  username: string;
  displayName?: string;
  profilePictureUrl?: string;
  isActive: boolean;
  connectedAt: Date;
}

export interface YouTubeAccountDTO {
  id: string;
  channelName: string;
  channelId?: string;
  profilePictureUrl?: string;
  isActive: boolean;
  connectedAt: Date;
}
