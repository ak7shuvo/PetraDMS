export type Inquiry = {
  projectType: string;
  services: string[];
  requirements: string;
  budget: string;
  timeline: string;
  call: { date: string; slot: string } | null;
  name: string;
  company: string;
  email: string;
  phone: string;
  website?: string; // honeypot
};

export type InquiryResponse = { ok: boolean; ref?: string; delivered?: boolean; error?: string };
