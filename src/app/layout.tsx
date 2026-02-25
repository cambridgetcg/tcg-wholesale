import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "TCG Wholesale",
  description: "Wholesale TCG card ordering platform",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let volumeDiscountPct = 0;

  const session = await auth();
  if (session?.user?.id) {
    const [client] = await db
      .select({ volumeDiscountPct: clients.volumeDiscountPct })
      .from(clients)
      .where(eq(clients.id, Number(session.user.id)))
      .limit(1);
    if (client) volumeDiscountPct = client.volumeDiscountPct;
  }

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
