export function getFakeSocialSignal(artist: string) {
  const signals = [
    {
      avatars: ["guitar", "mic", "vinyl"],
      text: "Popular with guitar fans",
    },
    {
      avatars: ["drums", "guitar"],
      text: "High-energy crowd pick",
    },
    {
      avatars: ["vinyl", "piano"],
      text: "Scene discovery favourite",
    },
  ];

  return signals[Math.floor(Math.random() * signals.length)];
}