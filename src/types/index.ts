export type JobStatus = 'queued' | 'started' | 'scraping' | 'planning' | 'picking assets' | 'switching_model' | 'done' | 'error';

export interface Source {
  url: string;
  title: string;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content?: string;
  type?: 'chat' | 'video';
  sources?: Source[];
  render_spec?: RenderSpec;
  attachments?: { url: string; type: string; name: string }[];
  userFeedback?: 'up' | 'down';
  variants?: any[];
}

export interface ProductJson {
  chat_reply?: string;
  sources?: Source[];
  [key: string]: unknown; // Allow flexibility for other fields while removing 'any'
}

export interface DbMessage {
  id: string;
  job_id: string;
  user_id?: string;
  role: 'user' | 'assistant';
  content?: string;
  type?: 'chat' | 'video';
  variants?: any[];
  attachments?: { url: string; type: string; name: string }[];
  user_feedback?: 'up' | 'down';
  created_at: string;
}

export interface ScrapedDataJson {
  title?: string;
  meta?: Record<string, string>;
  h1?: string;
  p?: string;
  [key: string]: unknown;
}

export interface RenderSpec {
  durationSec: number;
  aspectRatio: "9:16";
  backgroundMode?: 'video' | 'color';
  backgroundColor?: string;
  background: {
    type: "image" | "video";
    url: string;
    prompt?: string;
  };
  background_image?: {
    type: "image";
    url: string;
    prompt?: string;
  };
  background_video?: {
    type: "video";
    url: string;
    prompt?: string;
  } | null;
  activeBgType?: 'image' | 'video';
  overlayText: {
    top: string;
    bottom?: string;
    style?: {
      fontFamily?: string;
      topFontFamily?: string;
      bottomFontFamily?: string;
      linkFonts?: boolean;
      topTextColor?: string;
      bottomTextColor?: string;
      topTextOpacity?: number;
      bottomTextOpacity?: number;
      showTopBackground?: boolean;
      showBottomBackground?: boolean;
      topY?: number;
      bottomY?: number;
      backgroundColor?: string;
    };
    showTextLayer?: boolean;
    showTopText?: boolean;
    showBottomText?: boolean;
  };
  gifOverlay: {
    url: string;
    options?: string[];
    showGifLayer?: boolean;
    style?: {
      x?: number;
      y?: number;
      scale?: number;
    };
  };
  audio: {
    url: string;
    mood: string;
  };
}

export interface Job {
  id: string;
  user_id?: string;
  message: string;
  product_json?: ProductJson;
  scraped_data_json?: ScrapedDataJson;
  render_spec_json?: RenderSpec;
  status: JobStatus;
  error?: string;
  output_url?: string;
  created_at: string;
  messages?: DbMessage[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  jobId?: string;
  job?: Job;
}
