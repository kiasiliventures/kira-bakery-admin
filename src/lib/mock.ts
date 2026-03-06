import type { Metric, Order, OrderStatus, Product, ProductStatus, User } from "@/lib/types";

export const currentUser: User = {
  id: "user-admin-1",
  name: "Aisha N.",
  email: "aisha@kirabakery.com",
  role: "Admin",
  avatar:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80",
};

export const products: Product[] = [
  {
    id: "prod-1",
    name: "Signature Vanilla Cake",
    description: "Soft vanilla sponge layered with fresh cream.",
    image:
      "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=500&q=80",
    price: 120000,
    stock: 22,
    reorderAt: 10,
    status: "Available",
    lowStockAlert: false,
    variants: [
      { id: "v-1", size: "6 inch", flavor: "Vanilla", price: 60000, sortOrder: 1 },
      { id: "v-2", size: "8 inch", flavor: "Chocolate", price: 85000, sortOrder: 2 },
    ],
  },
  {
    id: "prod-2",
    name: "Butter Croissant",
    description: "Flaky butter croissant baked at sunrise.",
    image:
      "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=500&q=80",
    price: 8500,
    stock: 48,
    reorderAt: 20,
    status: "Available",
    lowStockAlert: false,
    variants: [{ id: "v-3", size: "6 inch", flavor: "Vanilla", price: 8500, sortOrder: 1 }],
  },
  {
    id: "prod-3",
    name: "Chocolate Fudge Cake",
    description: "Dark cocoa cake with smooth ganache finish.",
    image:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=500&q=80",
    price: 135000,
    stock: 8,
    reorderAt: 10,
    status: "Out of Stock",
    lowStockAlert: true,
    variants: [{ id: "v-4", size: "8 inch", flavor: "Chocolate", price: 95000, sortOrder: 1 }],
  },
  {
    id: "prod-4",
    name: "Sourdough Loaf",
    description: "Long-fermented loaf with crisp crust.",
    image:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=500&q=80",
    price: 18000,
    stock: 30,
    reorderAt: 12,
    status: "Available",
    lowStockAlert: false,
    variants: [{ id: "v-5", size: "10 inch", flavor: "Vanilla", price: 18000, sortOrder: 1 }],
  },
  {
    id: "prod-5",
    name: "Fruit Danish",
    description: "Custard pastry topped with seasonal fruit.",
    image:
      "https://images.unsplash.com/photo-1509365465985-25d11c17e812?auto=format&fit=crop&w=500&q=80",
    price: 12000,
    stock: 11,
    reorderAt: 12,
    status: "Available",
    lowStockAlert: true,
    variants: [{ id: "v-6", size: "6 inch", flavor: "Vanilla", price: 12000, sortOrder: 1 }],
  },
  {
    id: "prod-6",
    name: "Red Velvet Slice",
    description: "Classic red velvet with cream cheese frosting.",
    image:
      "https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?auto=format&fit=crop&w=500&q=80",
    price: 14000,
    stock: 7,
    reorderAt: 10,
    status: "Out of Stock",
    lowStockAlert: true,
    variants: [{ id: "v-7", size: "6 inch", flavor: "Red Velvet", price: 14000, sortOrder: 1 }],
  },
  {
    id: "prod-7",
    name: "Greek Yoghurt Cup",
    description: "Fresh yoghurt cup with fruit puree swirl.",
    image:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=500&q=80",
    price: 9000,
    stock: 25,
    reorderAt: 12,
    status: "Available",
    lowStockAlert: false,
    variants: [{ id: "v-8", size: "6 inch", flavor: "Vanilla", price: 9000, sortOrder: 1 }],
  },
  {
    id: "prod-8",
    name: "Pepperoni Pizza",
    description: "Stone-baked crust with premium toppings.",
    image:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=500&q=80",
    price: 48000,
    stock: 14,
    reorderAt: 8,
    status: "Available",
    lowStockAlert: false,
    variants: [{ id: "v-9", size: "10 inch", flavor: "Chocolate", price: 48000, sortOrder: 1 }],
  },
];

export const orders: Order[] = [
  {
    id: "KB-1001",
    customer: "Anita K.",
    status: "Pending",
    total: 98000,
    createdAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    type: "Delivery",
    image: products[0].image,
  },
  {
    id: "KB-1002",
    customer: "Joel M.",
    status: "In Progress",
    total: 42000,
    createdAt: new Date(Date.now() - 1000 * 60 * 37).toISOString(),
    type: "Pickup",
    image: products[1].image,
  },
  {
    id: "KB-1003",
    customer: "Sarah N.",
    status: "Ready",
    total: 121000,
    createdAt: new Date(Date.now() - 1000 * 60 * 70).toISOString(),
    type: "Pickup",
    image: products[2].image,
  },
  {
    id: "KB-1004",
    customer: "Michael P.",
    status: "Delivered",
    total: 56000,
    createdAt: new Date(Date.now() - 1000 * 60 * 128).toISOString(),
    type: "Delivery",
    image: products[3].image,
  },
  {
    id: "KB-1005",
    customer: "Amina R.",
    status: "Pending",
    total: 72000,
    createdAt: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
    type: "Delivery",
    image: products[4].image,
  },
  {
    id: "KB-1006",
    customer: "David O.",
    status: "In Progress",
    total: 26000,
    createdAt: new Date(Date.now() - 1000 * 60 * 52).toISOString(),
    type: "Pickup",
    image: products[5].image,
  },
  {
    id: "KB-1007",
    customer: "Grace T.",
    status: "Pending",
    total: 87000,
    createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    type: "Pickup",
    image: products[6].image,
  },
  {
    id: "KB-1008",
    customer: "Liam J.",
    status: "Ready",
    total: 64000,
    createdAt: new Date(Date.now() - 1000 * 60 * 84).toISOString(),
    type: "Delivery",
    image: products[7].image,
  },
];

export const dashboardMetrics: Metric[] = [
  { title: "Total Orders", value: "248", points: [12, 16, 14, 19, 18, 22, 24] },
  { title: "Pending Orders", value: "18", points: [10, 8, 9, 7, 6, 8, 5] },
  { title: "Total Revenue", value: "UGX 12.4M", points: [4, 6, 7, 8, 7, 10, 12] },
  { title: "Low Stock Items", value: "6", points: [9, 8, 8, 7, 6, 6, 5] },
];

export function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(value);
}

export function getOrdersByStatus(status: OrderStatus): Order[] {
  return orders.filter((order) => order.status === status);
}

export function getProductById(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}

export function getLowStockProducts(): Product[] {
  return products.filter((product) => product.lowStockAlert || product.stock <= product.reorderAt).slice(0, 4);
}

export function statusFromStock(stock: number, reorderAt: number): ProductStatus {
  return stock <= 0 ? "Out of Stock" : stock <= reorderAt ? "Out of Stock" : "Available";
}
