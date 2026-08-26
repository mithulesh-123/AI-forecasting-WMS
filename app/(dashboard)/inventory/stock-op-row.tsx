"use client";

import { StockOperationDialog, type PickerProduct, type PickerWarehouse } from "./stock-op-dialog";
import { Button } from "@/components/ui/button";

export function StockOperationRowButton({
  products,
  warehouses,
  productId,
  warehouseId,
}: {
  products: PickerProduct[];
  warehouses: PickerWarehouse[];
  productId: string;
  warehouseId: string;
}) {
  return (
    <StockOperationDialog
      products={products}
      warehouses={warehouses}
      defaultProductId={productId}
      defaultWarehouseId={warehouseId}
      lockProduct
      trigger={
        <Button variant="outline" size="icon" aria-label="Record stock operation">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </Button>
      }
    />
  );
}
