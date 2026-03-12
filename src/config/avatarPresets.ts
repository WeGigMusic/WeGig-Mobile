import type { ImageSourcePropType } from "react-native";

export type AvatarPreset = {
  id: string;
  label: string;
  image: ImageSourcePropType;
};

export const avatarPresets: AvatarPreset[] = [
  {
    id: "guitar",
    label: "Guitar",
    image: require("../../assets/avatars/guitar.png"),
  },
  {
    id: "drums",
    label: "Drums",
    image: require("../../assets/avatars/drums.png"),
  },
  {
    id: "mic",
    label: "Mic",
    image: require("../../assets/avatars/mic.png"),
  },
  {
    id: "piano",
    label: "Piano",
    image: require("../../assets/avatars/piano.png"),
  },
  {
    id: "vinyl",
    label: "Vinyl",
    image: require("../../assets/avatars/vinyl.png"),
  },
];