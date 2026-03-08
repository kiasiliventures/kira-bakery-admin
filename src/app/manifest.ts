import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kira Bakery Admin",
    short_name: "Kira Admin",
    description: "Installable bakery operations dashboard for orders, products, and inventory.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4eadf",
    theme_color: "#f4eadf",
    categories: ["business", "productivity", "food"],
    icons: [
      {
        src: "/icons/kira_bakery_icon.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        src: "/icons/kira_bakery_icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
      {
        src: "/icons/kira_bakery_icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Orders",
        short_name: "Orders",
        url: "/orders",
        description: "Review and update bakery orders.",
      },
      {
        name: "Products",
        short_name: "Products",
        url: "/products",
        description: "Manage live product listings.",
      },
      {
        name: "Inventory",
        short_name: "Inventory",
        url: "/inventory",
        description: "Adjust stock quantities and availability.",
      },
    ],
  };
}
