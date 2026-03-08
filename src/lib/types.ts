export type ProductStatus = "Available" | "Out of Stock";
export type OrderStatus =
  | "Pending"
  | "Approved"
  | "Ready"
  | "Cancelled"
  | "In Progress"
  | "Delivered";
export type StatusPillType =
  | "Pending"
  | "Approved"
  | "In Progress"
  | "Ready"
  | "Delivered"
  | "Cancelled"
  | "Out of Stock"
  | "Available";

export type Variant = {
  id: string;
  size: "6 inch" | "8 inch" | "10 inch";
  flavor: "Vanilla" | "Chocolate" | "Red Velvet";
  price: number;
  sortOrder: number;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  stock: number;
  reorderAt: number;
  status: ProductStatus;
  lowStockAlert: boolean;
  variants: Variant[];
};

export type Order = {
  id: string;
  customer: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  type: "Pickup" | "Delivery";
  image: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Manager" | "Staff";
  avatar: string;
};

export type Metric = {
  title: "Total Orders" | "Pending Orders" | "Total Revenue" | "Low Stock Items";
  value: string;
  points: number[];
};
