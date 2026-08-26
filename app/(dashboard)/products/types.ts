export interface ProductDto {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  unit: string;
  price: number;
  reorderLevel: number;
  reorderQuantity: number;
  isActive: boolean;
  stock: number;
}
