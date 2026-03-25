import { ImageResponse } from "next/og";
import { FolioIconArt } from "../icon-art";

export function GET() {
  return new ImageResponse(<FolioIconArt size={120} />, {
    width: 192,
    height: 192,
  });
}
