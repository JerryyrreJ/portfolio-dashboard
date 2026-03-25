type FolioIconArtProps = {
  size: number;
  borderRadius?: number;
};

export function FolioIconArt({
  size,
  borderRadius = Math.round(size * 0.22),
}: FolioIconArtProps) {
  return (
    <div
      style={{
        alignItems: "center",
        background: "#000000",
        borderRadius,
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polyline
          points="22 7 13.5 15.5 8.5 10.5 2 17"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="16 7 22 7 22 13"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
