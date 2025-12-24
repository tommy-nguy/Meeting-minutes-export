import type { ReactNode } from "react";

export const metadata = {
  title: "Meeting Minutes Export",
  description: "Upload audio and preview transcripts",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Arial, sans-serif", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
