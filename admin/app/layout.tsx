import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UP Teacher Master — Admin",
  description: "UP Teacher Master administration portal"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
