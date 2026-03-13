export function getGigSocialSignal(seed: string) {
  const options = [
    { avatars: ["guitar", "vinyl", "mic"], count: 9 },
    { avatars: ["drums", "guitar"], count: 5 },
    { avatars: ["piano", "vinyl"], count: 3 },
  ];

  const hash = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return options[hash % options.length];
}