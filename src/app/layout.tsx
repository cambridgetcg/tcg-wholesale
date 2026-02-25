import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { getVolumeDiscount } from "@/lib/get-volume-discount";

export const metadata: Metadata = {
  title: "TCG Wholesale",
  description: "Wholesale TCG card ordering platform",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const volumeDiscountPct = await getVolumeDiscount();

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0a0f] text-gray-100 antialiased">
        <Providers volumeDiscountPct={volumeDiscountPct}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
