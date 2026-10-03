import { CartProvider } from "@/components/CartProvider";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <CartProvider>
      <SiteHeader settings={settings} />
      <main id="main">{children}</main>
      <SiteFooter settings={settings} />
    </CartProvider>
  );
}
