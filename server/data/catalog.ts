import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Product, ProductCategory } from "../types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(here, "catalog.json");

const raw = fs.readFileSync(catalogPath, "utf8");
export const catalog: Product[] = JSON.parse(raw) as Product[];

export const catalogById = new Map(catalog.map((product) => [product.id, product]));

export const categoryLabels: Record<ProductCategory, string> = {
  laptops: "Laptop",
  headphones: "Headphones",
  smartphones: "Smartphone",
};

export function getProduct(id: string): Product | undefined {
  return catalogById.get(id);
}

export function getByCategory(category: ProductCategory): Product[] {
  return catalog.filter((product) => product.category === category && product.in_stock);
}

export function catalogStats() {
  return {
    products: catalog.length,
    categories: (Object.keys(categoryLabels) as ProductCategory[]).map((category) => ({
      id: category,
      label: categoryLabels[category],
      count: catalog.filter((product) => product.category === category).length,
    })),
  };
}
