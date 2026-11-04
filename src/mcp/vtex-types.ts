// The fields this server reads from the VTEX APIs, as those APIs return them. OMS
// values are in cents and Catalog prices are in reais: mapping them is the server's job.

/** GET /api/catalog_system/pub/products/search */
export interface VtexProduct {
  productId: string;
  productName: string;
  brand: string;
  categories: string[];
  linkText: string;
  description: string;
  items: {
    itemId: string;
    name: string;
    images: { imageUrl: string }[];
    sellers: {
      sellerId: string;
      sellerDefault: boolean;
      commertialOffer: { Price: number; ListPrice: number; AvailableQuantity: number; IsAvailable: boolean };
    }[];
  }[];
}

/** GET /api/logistics/pvt/inventory/skus/{skuId} */
export interface VtexInventory {
  skuId: string;
  balance: {
    warehouseId: string;
    warehouseName: string;
    totalQuantity: number;
    reservedQuantity: number;
    hasUnlimitedQuantity: boolean;
  }[];
}

/** GET /api/oms/pvt/orders/{orderId} */
export interface VtexOrder {
  orderId: string;
  sequence: string;
  status: string;
  statusDescription: string;
  creationDate: string;
  value: number;
  items: { id: string; productId: string; name: string; quantity: number; price: number; sellingPrice: number }[];
  clientProfileData: { email: string; firstName: string; lastName: string; phone: string; document: string };
  shippingData: {
    address: { receiverName: string; street: string; number: string; postalCode: string; city: string; state: string };
    logisticsInfo: { selectedSla: string; shippingEstimateDate: string }[];
  };
  packageAttachment: { packages: { invoiceNumber: string; courier: string; trackingNumber: string; trackingUrl: string }[] };
  openTextField: { value: string } | null;
}

/** What the tools need from a store. A client for a real VTEX account would implement the same interface. */
export interface VtexClient {
  searchProducts(params: { query?: string; maxPrice?: number; inStockOnly?: boolean; limit: number }): Promise<VtexProduct[]>;
  getProduct(productId: string): Promise<VtexProduct | null>;
  getInventory(skuId: string): Promise<VtexInventory | null>;
  getOrder(orderId: string): Promise<VtexOrder | null>;
  listOrders(params: { email?: string; status?: string; limit: number }): Promise<VtexOrder[]>;
}
