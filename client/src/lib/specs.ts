import type { Product } from "./types";

export interface SpecCell {
  label: string;
  value: string;
}

export function specCells(product: Product): SpecCell[] {
  const specs = product.specs;
  if (product.category === "laptops") {
    return [
      { label: "RAM", value: `${specs.ram_gb ?? "—"} GB` },
      { label: "Storage", value: `${specs.storage_gb ?? "—"} GB` },
      { label: "Battery", value: `${specs.battery_hours} h` },
      { label: "Weight", value: `${specs.weight_kg} kg` },
    ];
  }
  if (product.category === "headphones") {
    return [
      { label: "Battery", value: `${specs.battery_hours} h` },
      { label: "ANC", value: specs.anc_level ? `${specs.anc_level}/5` : "None" },
      {
        label: "Comfort",
        value: specs.comfort_rating ? `${specs.comfort_rating}/5` : "—",
      },
      { label: "Weight", value: `${specs.weight_kg} kg` },
    ];
  }
  return [
    { label: "Battery", value: `${specs.battery_hours} h` },
    { label: "Camera", value: specs.camera_mp ? `${specs.camera_mp} MP` : "—" },
    { label: "Storage", value: `${specs.storage_gb ?? "—"} GB` },
    { label: "Screen", value: specs.screen_inches ? `${specs.screen_inches}"` : "—" },
  ];
}

export function miniSpecs(product: Product): string[] {
  if (product.category === "laptops") {
    return [
      `${product.specs.ram_gb ?? "—"} GB`,
      `${product.specs.battery_hours} h`,
      `${product.specs.weight_kg} kg`,
    ];
  }
  if (product.category === "headphones") {
    return [
      `${product.specs.battery_hours} h`,
      product.specs.anc_level ? `ANC ${product.specs.anc_level}` : "No ANC",
      `${product.specs.comfort_rating ?? "—"}/5`,
    ];
  }
  return [
    `${product.specs.battery_hours} h`,
    `${product.specs.camera_mp ?? "—"} MP`,
    `${product.specs.storage_gb ?? "—"} GB`,
  ];
}
