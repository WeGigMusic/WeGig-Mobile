export type Gig = {
  id: string;
  artist: string;
  venue: string;
  city: string;
  date: string; // YYYY-MM-DD
  rating?: number;
  notes?: string;

  // optional enrichment / imports
  externalSource?: string;
  externalId?: string;
  artistMbid?: string;
  ticketUrl?: string;
};

export type GigsResponse = {
  count: number;
  gigs: Gig[];
};

export type CreateGigInput = {
  artist: string;
  venue: string;
  city: string;
  date: string;
  rating?: number;
  notes?: string;

  externalSource?: string;
  externalId?: string;
  artistMbid?: string;
  ticketUrl?: string;
};
