export type CakeOption = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CakeTierOption = CakeOption & {
  tierCount: number;
};

export type CakeConfigOptionDto = Pick<CakeOption, "id" | "code" | "name" | "sortOrder">;

export type CakeTierOptionDto = CakeConfigOptionDto & {
  tierCount: number;
};

export type CakeConfigDto = {
  flavours: CakeConfigOptionDto[];
  shapes: CakeConfigOptionDto[];
  sizes: CakeConfigOptionDto[];
  toppings: CakeConfigOptionDto[];
  tierOptions: CakeTierOptionDto[];
};

export type CakePriceRow = {
  id: string;
  flavourId: string;
  shapeId: string;
  sizeId: string;
  tierOptionId: string;
  toppingId: string;
  weightKg: number;
  priceUgx: number;
  sourceNote: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CakePriceDto = CakePriceRow & {
  flavourCode: string;
  flavourName: string;
  shapeCode: string;
  shapeName: string;
  sizeCode: string;
  sizeName: string;
  tierOptionCode: string;
  tierOptionName: string;
  tierCount: number;
  toppingCode: string;
  toppingName: string;
};

export type CakeAdminData = {
  flavours: CakeOption[];
  shapes: CakeOption[];
  sizes: CakeOption[];
  toppings: CakeOption[];
  tierOptions: CakeTierOption[];
  prices: CakePriceDto[];
};

export type CakeCustomRequestRecord = {
  id: string;
  customerName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  requestPayload: Record<string, unknown>;
  status: "pending" | "reviewed" | "quoted" | "closed";
  sourceNote: string | null;
  createdAt: string;
  updatedAt: string;
};
