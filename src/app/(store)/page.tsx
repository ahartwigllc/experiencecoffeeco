import Link from "next/link";
import { NewsletterForm } from "@/components/NewsletterForm";
import { CoffeeMenu } from "@/components/CoffeeMenu";
import { listStoreProducts, type CatalogProduct } from "@/lib/catalog";
import { priceRange, splitNotes } from "@/lib/catalog-utils";
import { formatCents } from "@/lib/money";
import { subscriptionUnitPrice } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";

function pickFeatured(products: CatalogProduct[]) {
  return (
    products.find((p) => p.featured && p.flavorNotes) ??
    products.find((p) => p.kind === "beans" && p.flavorNotes) ??
    products[0]
  );
}

export default async function HomePage() {
  const [products, settings] = await Promise.all([listStoreProducts(), getSettings()]);
  const featured = pickFeatured(products);
  const coldBrew = products.find((p) => p.kind === "cold_brew");
  const notes = splitNotes(featured?.flavorNotes).slice(0, 4);
  const featuredPrice = featured ? priceRange(featured.variants)?.min : undefined;
  const coldBrewPrice = coldBrew?.variants[0]?.priceCents;

  return (
    <>
      {featured ? (
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <h1 className="tasting-line" aria-label={`${featured.title}: ${notes.join(", ")}`}>
                {(notes.length ? notes : [featured.title]).map((n) => (
                  <span key={n} aria-hidden="true">
                    {n.charAt(0).toUpperCase() + n.slice(1)}.
                  </span>
                ))}
              </h1>
            </div>
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {featured.images[0] ? <img className="hero-image" src={featured.images[0]} alt={featured.title} /> : null}
              <p className="hero-caption" style={{ marginTop: "1.25rem" }}>
                That's what's in the cup. <strong>{featured.title}</strong>
                {featured.process ? `, ${featured.process.toLowerCase()} process` : ""}
                {featured.cuppingScore ? `, ${featured.cuppingScore} points` : ""}.
              </p>
              <div className="buy-row">
                <Link className="btn btn-cherry" href={`/products/${featured.handle}`}>
                  Try it{featuredPrice ? `, ${formatCents(featuredPrice)}` : ""}
                </Link>
                <Link className="btn btn-ghost" href="/shop">
                  All coffee
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="hero">
          <div className="wrap">
            <h1 className="tasting-line">
              <span>Coffee,</span>
              <span>experienced.</span>
            </h1>
          </div>
        </section>
      )}

      <section className="section">
        <div className="wrap">
          <p className="mission">
            We believe coffee shouldn't be something you drink out of habit. It should be experienced. There's a world of coffee most
            people never taste, and we want to share it with you.
          </p>
        </div>
      </section>

      <section className="section" aria-labelledby="menu-title">
        <div className="wrap">
          <h2 id="menu-title" className="section-title">
            On the roaster now
          </h2>
          <CoffeeMenu products={products} />
        </div>
      </section>

      {coldBrew ? (
        <section className="section">
          <div className="wrap split">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {coldBrew.images[0] ? <img src={coldBrew.images[0]} alt={coldBrew.title} loading="lazy" /> : <div />}
            <div>
              <h2 className="section-title">Cold brew on tap, in your fridge</h2>
              <div className="prose" dangerouslySetInnerHTML={{ __html: coldBrew.descriptionHtml }} />
              <p>
                A 67oz box with a spout.{" "}
                {coldBrewPrice
                  ? `${formatCents(coldBrewPrice)}, or ${formatCents(subscriptionUnitPrice(coldBrewPrice, settings.subscriptionDiscountPercent))} on a subscription.`
                  : ""}
              </p>
              <Link className="btn" href={`/products/${coldBrew.handle}`}>
                Get the cold brew box
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section" id="subscribe">
        <div className="wrap">
          <div className="subscribe-band">
            <div>
              <p className="big">Save {settings.subscriptionDiscountPercent}% on every bag.</p>
            </div>
            <div>
              <p>
                Subscribe to any coffee or the cold brew box and choose every week, every two weeks, or every month. Pickup or free local
                delivery. Skip, pause, or cancel from your account whenever you like.
              </p>
              <Link className="btn btn-cherry" href="/shop">
                Pick a coffee to subscribe
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <div>
            <h2 className="section-title">Roasted in house, batch by batch</h2>
            <div className="prose">
              <p>
                Roasting is the craft of managing heat and momentum. We buy dense, high-grown coffee, which asks for a more careful hand.
                By controlling airflow and temperature closely, we take each batch through its own roast curve. That draws out the deep
                sugars and keeps the floral and fruit notes that make a coffee worth tasting.
              </p>
            </div>
          </div>
          <div>
            <h2 className="section-title">Andrew and G</h2>
            <div className="prose">
              <p>
                We love coffee, and we love sharing unusual coffee with people even more. We think the best relationships are built on
                shared experiences. Some day we want to open an Experience Coffee shop you can walk into. Until then, this is how we
                share it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-label="What customers say">
        <div className="wrap quotes">
          <blockquote>"I didn't know coffee could be so smooth."</blockquote>
          <blockquote>"Having delicious cold brew on tap in my fridge changed my life, and it doesn't even need milk."</blockquote>
          <blockquote>"I normally have one cup in the morning, but I find myself drinking two or three since it's so good."</blockquote>
          <blockquote>"The option to grind for K-Cup changed my morning."</blockquote>
        </div>
      </section>

      <section className="section">
        <div className="wrap narrow">
          <h2 className="section-title">Hear about new lots first</h2>
          <p>Specialty lots are small. Subscribers to our email hear about them before they're gone.</p>
          <NewsletterForm source="home" />
        </div>
      </section>
    </>
  );
}
