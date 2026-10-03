import { CheckoutError, checkoutSchema, createCheckoutSession } from "@/lib/checkout";
import { isSameOrigin, json } from "@/lib/http";
import { isStripeConfigured } from "@/lib/stripe";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ error: "Invalid request origin." }, 403);
  if (!isStripeConfigured()) return json({ error: "Checkout isn't set up yet. Please contact us to order." }, 503);
  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Your cart couldn't be read. Refresh the page and try again." }, 400);
  try {
    const url = await createCheckoutSession(parsed.data);
    return json({ url });
  } catch (err) {
    if (err instanceof CheckoutError) return json({ error: err.message }, 400);
    console.error("checkout failed", err);
    return json({ error: "Checkout couldn't start. Try again in a moment." }, 500);
  }
}
