import Link from "next/link";
import { NewsletterForm } from "@/components/NewsletterForm";
import { CoffeeMenu } from "@/components/CoffeeMenu";
import { Wordmark } from "@/components/brand/Wordmark";
import { BotanicalField, Branch } from "@/components/brand/Botanical";
import { FlavorScale, TastingCard } from "@/components/brand/TastingCard";
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

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function HomePage() {
  const [products, settings] = await Promise.all([listStoreProducts(), getSettings()]);
  const featured = pickFeatured(products);
  const coldBrew = products.find((p) => p.kind === "cold_brew");
  const notes = splitNotes(featured?.flavorNotes).slice(0, 4);
  const featuredPrice = featured ? priceRange(featured.variants)?.min : undefined;
  const featuredSizes = featured ? [...new Set(featured.variants.map((v) => v.size).filter(Boolean))].join(" / ") : "";
  const coldBrewPrice = coldBrew?.variants[0]?.priceCents;

  return (
    <>
      <section className="cover">
        <BotanicalField variant="hero" />
        <div className="wrap cover-inner">
          <p className="eyebrow">Specialty coffee &amp; roastery · Lyndhurst, NJ</p>
          <Wordmark size="xl" as="h1" priority />
          <p className="cover-lede">
            Light roasts that taste like the fruit coffee comes from. Small lots, roasted to order, picked up or delivered close to home.
          </p>
          <div className="buy-row">
            <Link className="btn" href="/shop">
              Shop coffee
            </Link>
            <Link className="btn btn-ghost" href="/#subscribe">
              Subscribe &amp; save {settings.subscriptionDiscountPercent}%
            </Link>
          </div>
        </div>
      </section>

      {featured ? (
        <section className="section feature" aria-labelledby="feature-title">
          <div className="wrap feature-grid">
            <div className="feature-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {featured.images[0] ? <img className="hero-image" src={featured.images[0]} alt={featured.title} /> : null}
            </div>
            <div>
              <p className="eyebrow">On the roaster now</p>
              <h2 id="feature-title" className="feature-title">
                {featured.title}
              </h2>
              {notes.length ? (
                <p className="tasting-line" aria-label={notes.join(", ")}>
                  {notes.map((n) => (
                    <span key={n} aria-hidden="true">
                      {cap(n)}.
                    </span>
                  ))}
                </p>
              ) : null}
              <TastingCard
                notes={featured.flavorNotes}
                origin={featured.origin}
                process={featured.process}
                footer={featuredSizes ? `Whole bean or ground · ${featuredSizes}` : "Whole bean or ground"}
                score={featured.cuppingScore}
              />
              <FlavorScale process={featured.process} title={featured.title} />
              <div className="buy-row">
                <Link className="btn" href={`/products/${featured.handle}`}>
                  Try it{featuredPrice ? `, from ${formatCents(featuredPrice)}` : ""}
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section why" aria-labelledby="why-title">
        <BotanicalField variant="soft" />
        <div className="wrap narrow why-inner">
          <span className="why-x" aria-hidden="true">
            x
          </span>
          <h2 id="why-title" className="why-title">
            Why <span className="wm-inline">E<span className="wm-x">x</span>perience</span> coffee?
          </h2>
          <p>
            We believe every cup of coffee should be nothing less than an experience. There is a world of flavor hidden inside the coffee
            cherry, and our mission is to bring out the distinct flavors and notes that come from each region, altitude, and harvesting
            process.
          </p>
          <p>
            Since coffee is a fruit similar to a cherry, we believe in celebrating its natural sweetness. Our lighter roast profiles ensure
            that the bean&apos;s unique, vibrant character is boldly evident as it is brewed.
          </p>
          <p className="why-sign">Welcome to the world of specialty coffee.</p>
        </div>
      </section>

      <section className="section bags" aria-label="Our bags">
        <div className="wrap">
          <div className="bag-grid">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/brand/bag-x.webp" alt="Experience Coffee bag with the X monogram" width={1400} height={1315} loading="lazy" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/brand/bag-wordmark.webp" alt="Experience Coffee bag with the wordmark" width={1400} height={1315} loading="lazy" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/brand/bag-noir.webp" alt="Experience Coffee bag with the black and gold side panel" width={1400} height={1315} loading="lazy" />
          </div>
          <p className="bag-caption">Roasted to order and packed by hand in Lyndhurst, New Jersey.</p>
        </div>
      </section>

      <section className="section" aria-labelledby="menu-title">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">The menu</p>
            <h2 id="menu-title" className="section-title">
              What we&apos;re roasting
            </h2>
          </div>
          <CoffeeMenu products={products} />
        </div>
      </section>

      {coldBrew ? (
        <section className="section noir">
          <Branch name="a" gold className="noir-branch" />
          <div className="wrap split">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {coldBrew.images[0] ? <img src={coldBrew.images[0]} alt={coldBrew.title} loading="lazy" /> : <div />}
            <div>
              <p className="eyebrow">Cold brew</p>
              <h2 className="section-title">On tap, in your fridge</h2>
              <div className="prose" dangerouslySetInnerHTML={{ __html: coldBrew.descriptionHtml }} />
              <p>
                A 67oz box with a spout.{" "}
                {coldBrewPrice
                  ? `${formatCents(coldBrewPrice)}, or ${formatCents(subscriptionUnitPrice(coldBrewPrice, settings.subscriptionDiscountPercent))} on a subscription.`
                  : ""}
              </p>
              <Link className="btn btn-gold" href={`/products/${coldBrew.handle}`}>
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
              <p className="eyebrow">Subscriptions</p>
              <p className="big">Save {settings.subscriptionDiscountPercent}% on every bag.</p>
            </div>
            <div>
              <p>
                Subscribe to any coffee or the cold brew box and choose every week, every two weeks, or every month. Pickup or free local
                delivery. Skip, pause, or cancel from your account whenever you like.
              </p>
              <Link className="btn btn-cream" href="/shop">
                Pick a coffee to subscribe
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap split split-top">
          <div>
            <p className="eyebrow">The roastery</p>
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
            <p className="eyebrow">The people</p>
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
          <blockquote>&ldquo;I didn&apos;t know coffee could be so smooth.&rdquo;</blockquote>
          <blockquote>&ldquo;Having delicious cold brew on tap in my fridge changed my life, and it doesn&apos;t even need milk.&rdquo;</blockquote>
          <blockquote>&ldquo;I normally have one cup in the morning, but I find myself drinking two or three since it&apos;s so good.&rdquo;</blockquote>
          <blockquote>&ldquo;The option to grind for K-Cup changed my morning.&rdquo;</blockquote>
        </div>
      </section>

      <section className="section">
        <div className="wrap narrow center">
          <p className="eyebrow">Newsletter</p>
          <h2 className="section-title">Hear about new lots first</h2>
          <p>Specialty lots are small. Subscribers to our email hear about them before they&apos;re gone.</p>
          <NewsletterForm source="home" />
        </div>
      </section>
    </>
  );
}
