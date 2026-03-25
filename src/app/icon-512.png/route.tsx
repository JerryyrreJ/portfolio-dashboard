import { ImageResponse } from "next/og";
import { FolioIconArt } from "../icon-art";

export function GET() {
  return new ImageResponse(<FolioIconArt size={320} />, {
    width: 512,
    height: 512,
  });
}
