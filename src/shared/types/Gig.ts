export type Gig = {
  id: string;
  artist: string;
  venue: string;
  city: string;
  date: string; // YYYY-MM-DD
  rating?: number;
  notes?: string;

  externalSource?: string;
  externalId?: string;
  artistMbid?: string;
};

export type GigsResponse = {
  count: number;
  gigs: Gig[];
};

// ✅ Added: input type for creating (and also useful for edit forms)
export type CreateGigInput = {
  artist: string;
  venue: string;
  city: string;
  date: string; // YYYY-MM-DD
  rating?: number;
  notes?: string;

  externalSource?: string;
  externalId?: string;
  ticketUrl?: string;
  artistMbid?: string;
};
