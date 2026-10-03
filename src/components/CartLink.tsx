"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "./CartProvider";

export function CartLink() {
  const { count, ready } = useCart();
  return (
    <Link href="/cart" className="cart-link" aria-label={`Cart, ${ready ? count : 0} items`}>
      Cart {ready && count > 0 ? <span className="cart-count">{count}</span> : null}
    </Link>
  );
}

/** Empties the cart once it has loaded. Rendered on the checkout success page. */
export function ClearCart() {
  const { clear, ready } = useCart();
  useEffect(() => {
    if (ready) clear();
  }, [ready, clear]);
  return null;
}
