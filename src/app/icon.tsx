import { ImageResponse } from "next/og";
import { FolioIconArt } from "./icon-art";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<FolioIconArt size={320} />, size);
}
