import { Gig } from "../shared/types/Gig";

export function getProfileStatus(gigs: Gig[]) {
  if (gigs.length >= 10) {
    return { label: "Scene Member", colour: "#8A5BFF" };
  }

  const cities = new Set(gigs.map(g => g.city));
  if (cities.size >= 3) {
    return { label: "Explorer", colour: "#C0C4CC" };
  }

  const rated = gigs.filter(g => g.rating);
  if (rated.length >= 5) {
    return { label: "Reviewer", colour: "#2EE59D" };
  }

  if (gigs.length >= 5) {
    return { label: "Regular", colour: "#2F8CFF" };
  }

  return { label: "New Fan", colour: "#6B7280" };
}