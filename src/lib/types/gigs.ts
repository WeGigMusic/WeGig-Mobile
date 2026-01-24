export type Gig = {
  id: string;
  artist: string;
  venue: string;
  city: string;
  date: string;
  rating?: number;
  notes?: string;
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
};
