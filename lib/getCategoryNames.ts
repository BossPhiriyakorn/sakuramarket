import type { ManageProduct, ManageCategory } from "@/types/manageShop";

/** แปลง category_ids ของสินค้าเป็นชื่อหมวด (ใช้ร่วมกันใน RecommendedProducts, ProductGrid, ฯลฯ) */
export function getCategoryNames(
  product: ManageProduct,
  categories: ManageCategory[]
): string[] {
  return (product.category_ids || [])
    .map((id) => categories.find((c) => c.id === id)?.name)
    .filter(Boolean) as string[];
}
