import { usePublicMetadata } from "./usePublicMetadata";

export function HomePageMetadata() {
  usePublicMetadata(
    "TexOS – The Operating System for Modern Restaurants",
    "Manage restaurant menus, orders, kitchen operations, loyalty, and billing with TexOS.",
    "/",
  );
  return null;
}

export function SubscriptionPageMetadata() {
  usePublicMetadata(
    "Plans | TexOS",
    "Explore TexOS restaurant subscription plans and available features.",
    "/plans",
  );
  return null;
}
