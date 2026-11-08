// Shapes returned by the FastAPI backend (see backend/app/routes).

export type User = {
  _id: string;
  username: string;
  email: string;
  farm_name?: string;
  farm_location?: string;
  farm_display_name?: string;
  farm_state?: string;
  farm_state_name?: string;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type Workflow = {
  _id: string;
  title: string;
  prompt: string;
  service?: string;
  created?: string;
  chat?: ChatMessage[];
};

export type Company = {
  _id: string;
  name: string;
  address?: string;
  state?: string;
  services?: string[];
  category?: string;
  rating?: number;
  review_count?: number;
  trust_score?: number;
  verified?: boolean;
  review_summary?: string;
  distance_miles?: number;
  phone?: string;
  website?: string;
  maps_url?: string;
  email?: string;
};

export type Email = {
  _id: string;
  company_id: string;
  company_name: string;
  to: string;
  subject: string;
  body: string;
  status: string; // "draft" | "sent" | "sent (simulated)"
  reply?: string;
};

export type WorkflowDetail = {
  workflow: Workflow;
  companies: Company[];
  emails: Email[];
};
