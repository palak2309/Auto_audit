import React, { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  ArrowUpDown,
  Edit2,
  Trash2,
  History,
  Tag,
  Download,
  CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listProducts,
  saveProduct,
  deleteProduct,
  listCategories,
  saveCategory,
  recordStockAdjustment,
  listStockAdjustments,
} from "@/lib/billing/products.functions";
import { STANDARD_GST_RATES } from "@/lib/gst/calculator";
import { currencyIn } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/_shell/products")({
  head: () => ({
    meta: [
      { title: "Products & Inventory — Auto Audit" },
      {
        name: "description",
        content: "Manage product catalog, prices, GST tax rates and real-time stock levels.",
      },
    ],
  }),
  component: ProductsPage,
});

const COMMON_UNITS = ["PCS", "KGS", "MTR", "BOX", "LTR", "PKT", "NOS", "SET", "BAG", "DOZ"];

function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Selected item for edit or adjustment
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<any | null>(null);

  // Server functions
  const fetchProductsFn = useServerFn(listProducts);
  const saveProductFn = useServerFn(saveProduct);
  const deleteProductFn = useServerFn(deleteProduct);
  const fetchCategoriesFn = useServerFn(listCategories);
  const saveCategoryFn = useServerFn(saveCategory);
  const recordAdjustFn = useServerFn(recordStockAdjustment);
  const fetchAdjustmentsFn = useServerFn(listStockAdjustments);

  // Queries
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", search, selectedCategory, lowStockOnly],
    queryFn: () =>
      fetchProductsFn({
        data: {
          search: search || undefined,
          categoryId: selectedCategory || undefined,
          lowStockOnly,
        },
      }),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCategoriesFn(),
  });

  const { data: adjustmentHistory = [] } = useQuery({
    queryKey: ["stockAdjustments", adjustingProduct?.id],
    queryFn: () => fetchAdjustmentsFn({ data: { productId: adjustingProduct?.id } }),
    enabled: isHistoryOpen,
  });

  // Form State for Add / Edit Product
  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    itemCode: "",
    barcode: "",
    hsnCode: "",
    description: "",
    unit: "PCS",
    purchasePrice: 0,
    sellingPrice: 0,
    mrp: 0,
    minSellingPrice: 0,
    taxRate: 18,
    taxInclusive: false,
    openingStock: 0,
    lowStockThreshold: 5,
    batchNumber: "",
    expiryDate: "",
  });

  // Adjustment Form State
  const [adjustData, setAdjustData] = useState<{
    type: "add" | "reduce" | "audit_correction" | "damage" | "loss";
    quantity: number;
    reason: string;
  }>({
    type: "add",
    quantity: 1,
    reason: "",
  });

  // Category Form State
  const [newCategoryName, setNewCategoryName] = useState("");

  const handleOpenAdd = (prod?: any) => {
    if (prod) {
      setEditingProduct(prod);
      setFormData({
        name: prod.name || "",
        categoryId: prod.category_id || "",
        itemCode: prod.item_code || "",
        barcode: prod.barcode || "",
        hsnCode: prod.hsn_code || "",
        description: prod.description || "",
        unit: prod.unit || "PCS",
        purchasePrice: Number(prod.purchase_price) || 0,
        sellingPrice: Number(prod.selling_price) || 0,
        mrp: Number(prod.mrp) || 0,
        minSellingPrice: Number(prod.min_selling_price) || 0,
        taxRate: Number(prod.tax_rate) || 18,
        taxInclusive: Boolean(prod.tax_inclusive),
        openingStock: Number(prod.opening_stock) || 0,
        lowStockThreshold: Number(prod.low_stock_threshold) || 5,
        batchNumber: prod.batch_number || "",
        expiryDate: prod.expiry_date || "",
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        categoryId: "",
        itemCode: "",
        barcode: "",
        hsnCode: "",
        description: "",
        unit: "PCS",
        purchasePrice: 0,
        sellingPrice: 0,
        mrp: 0,
        minSellingPrice: 0,
        taxRate: 18,
        taxInclusive: false,
        openingStock: 0,
        lowStockThreshold: 5,
        batchNumber: "",
        expiryDate: "",
      });
    }
    setIsAddOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      await saveProductFn({
        data: {
          id: editingProduct?.id,
          name: formData.name.trim(),
          category_id: formData.categoryId || null,
          item_code: formData.itemCode.trim() || null,
          barcode: formData.barcode.trim() || null,
          hsn_code: formData.hsnCode.trim() || null,
          description: formData.description.trim() || null,
          unit: formData.unit,
          purchase_price: Number(formData.purchasePrice) || 0,
          selling_price: Number(formData.sellingPrice) || 0,
          mrp: Number(formData.mrp) || null,
          min_selling_price: Number(formData.minSellingPrice) || null,
          tax_rate: Number(formData.taxRate) || 0,
          tax_inclusive: formData.taxInclusive,
          opening_stock: Number(formData.openingStock) || 0,
          low_stock_threshold: Number(formData.lowStockThreshold) || 5,
          batch_number: formData.batchNumber.trim() || null,
          expiry_date: formData.expiryDate || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsAddOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to save product");
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove product "${name}"?`)) return;
    try {
      await deleteProductFn({ data: { id } });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      alert(err.message || "Failed to delete product");
    }
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct || adjustData.quantity <= 0) return;

    try {
      await recordAdjustFn({
        data: {
          productId: adjustingProduct.id,
          adjustmentType: adjustData.type,
          quantity: adjustData.quantity,
          reason: adjustData.reason.trim() || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsAdjustOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to adjust stock");
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await saveCategoryFn({ data: { name: newCategoryName.trim() } });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNewCategoryName("");
      setIsCategoryOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to create category");
    }
  };

  const handleExportCsv = () => {
    const rows = products.map((p) => ({
      Name: p.name,
      Category: (p.category as any)?.name || "",
      "Item Code": p.item_code || "",
      "HSN/SAC": p.hsn_code || "",
      Unit: p.unit,
      "Current Stock": p.current_stock,
      "Purchase Price": p.purchase_price,
      "Selling Price": p.selling_price,
      "GST Rate (%)": p.tax_rate,
      "Low Stock Threshold": p.low_stock_threshold,
    }));
    downloadCsv(`products-inventory-${new Date().toISOString().substring(0, 10)}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & Inventory"
        description="Track product stock, batch numbers, HSN codes, and pricing rules with automatic invoice deductions."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsCategoryOpen(true)}>
              <Tag className="w-4 h-4 mr-1.5" />
              Categories
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={products.length === 0}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export CSV
            </Button>
            <Button size="sm" onClick={() => handleOpenAdd()}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Product
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-card rounded-xl border">
        <div className="flex flex-1 items-center gap-3 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search products by name, item code, barcode or HSN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 px-3 rounded-md border text-sm bg-background"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={lowStockOnly ? "destructive" : "outline"}
            size="sm"
            onClick={() => setLowStockOnly(!lowStockOnly)}
          >
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            {lowStockOnly ? "Showing Low Stock" : "Low Stock Alert"}
          </Button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-3">Item Code / HSN</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Current Stock</th>
                <th className="py-3 px-3 text-right">Selling Price</th>
                <th className="py-3 px-3 text-right">Purchase Price</th>
                <th className="py-3 px-3 text-center">Tax Rate</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Loading inventory...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Package className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="font-medium text-base text-foreground">No products found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add your first item to start generating invoices and tracking inventory.
                    </p>
                    <Button size="sm" className="mt-4" onClick={() => handleOpenAdd()}>
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add Product Now
                    </Button>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isLow = Number(p.current_stock) <= Number(p.low_stock_threshold);
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{p.name}</div>
                        {p.batch_number && (
                          <div className="text-xs text-muted-foreground">
                            Batch: {p.batch_number}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs font-mono text-muted-foreground">
                        <div>{p.item_code || "-"}</div>
                        {p.hsn_code && <div className="text-[11px]">HSN: {p.hsn_code}</div>}
                      </td>
                      <td className="py-3 px-3">
                        {(p.category as any)?.name ? (
                          <span className="inline-block px-2 py-0.5 text-xs rounded-md bg-secondary text-secondary-foreground">
                            {(p.category as any).name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5 font-bold font-mono">
                          {p.current_stock} {p.unit}
                          {isLow && (
                            <span
                              title={`Low stock threshold: ${p.low_stock_threshold}`}
                              className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"
                            />
                          )}
                        </div>
                        {isLow && (
                          <div className="text-[10px] text-rose-500 font-medium">Low Stock</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-medium text-foreground">
                        {currencyIn(p.selling_price, "INR")}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-muted-foreground">
                        {currencyIn(p.purchase_price, "INR")}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted">
                          {p.tax_rate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Adjust Stock"
                            onClick={() => {
                              setAdjustingProduct(p);
                              setAdjustData({ type: "add", quantity: 1, reason: "" });
                              setIsAdjustOpen(true);
                            }}
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Edit Product"
                            onClick={() => handleOpenAdd(p)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete"
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveProduct} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-foreground">Product Name *</label>
                <Input
                  required
                  placeholder="e.g. Wireless Mouse, Paracetamol 500mg, Steel Pipe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Category</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Unit</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
                >
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Item Code / SKU</label>
                <Input
                  placeholder="e.g. PRD-001"
                  value={formData.itemCode}
                  onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">HSN / SAC Code</label>
                <Input
                  placeholder="e.g. 84713010"
                  value={formData.hsnCode}
                  onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Selling Price (Rs.) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.sellingPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Purchase Price (Rs.)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.purchasePrice}
                  onChange={(e) =>
                    setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">GST Tax Rate (%)</label>
                <select
                  value={formData.taxRate}
                  onChange={(e) =>
                    setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
                >
                  {STANDARD_GST_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}% GST
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="taxInclusive"
                  checked={formData.taxInclusive}
                  onChange={(e) => setFormData({ ...formData, taxInclusive: e.target.checked })}
                  className="rounded border"
                />
                <label
                  htmlFor="taxInclusive"
                  className="text-xs font-medium text-foreground cursor-pointer"
                >
                  Selling Price includes GST
                </label>
              </div>

              {!editingProduct && (
                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Opening Stock Quantity
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.openingStock}
                    onChange={(e) =>
                      setFormData({ ...formData, openingStock: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Low Stock Alert Threshold
                </label>
                <Input
                  type="number"
                  min="0"
                  value={formData.lowStockThreshold}
                  onChange={(e) =>
                    setFormData({ ...formData, lowStockThreshold: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Batch Number (Optional)
                </label>
                <Input
                  placeholder="e.g. B2409"
                  value={formData.batchNumber}
                  onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Expiry Date (Optional)
                </label>
                <Input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Product</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Stock: {adjustingProduct?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStockAdjustment} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
              <div>
                <span className="text-muted-foreground">Current Stock: </span>
                <span className="font-bold font-mono">
                  {adjustingProduct?.current_stock} {adjustingProduct?.unit}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold">Adjustment Type</label>
              <select
                value={adjustData.type}
                onChange={(e) => setAdjustData({ ...adjustData, type: e.target.value as any })}
                className="w-full h-9 px-3 rounded-md border text-sm bg-background mt-1"
              >
                <option value="add">Add Stock (Restock / Found)</option>
                <option value="reduce">Reduce Stock (Used / Internal)</option>
                <option value="damage">Damage / Expired</option>
                <option value="loss">Lost / Theft</option>
                <option value="audit_correction">Audit Correction (Set exact count)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold">Quantity</label>
              <Input
                type="number"
                min="0.01"
                step="any"
                required
                value={adjustData.quantity}
                onChange={(e) =>
                  setAdjustData({ ...adjustData, quantity: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div>
              <label className="text-xs font-semibold">Reason / Note</label>
              <Input
                placeholder="e.g. Physical inventory count correction"
                value={adjustData.reason}
                onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAdjustOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Record Stock Change</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Product Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <form onSubmit={handleCreateCategory} className="flex gap-2">
              <Input
                placeholder="New category name..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <Button type="submit">Add</Button>
            </form>

            <div className="divide-y max-h-60 overflow-y-auto border rounded-lg">
              {categories.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No categories added yet
                </div>
              ) : (
                categories.map((c) => (
                  <div key={c.id} className="p-2.5 flex justify-between items-center text-sm">
                    <span>{c.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
