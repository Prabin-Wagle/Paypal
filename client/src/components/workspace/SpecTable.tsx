import { Check, Plus } from "lucide-react";
import { money } from "../../lib/format";
import type { Match } from "../../lib/types";

interface Row {
  key: string;
  label: string;
  better?: "lower" | "higher";
  read: (product: Match) => number | string | null;
  format: (value: number | string) => string;
}

const numeric = (value: number | string | null): number | null => {
  if (value === null) return null;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

interface SpecTableProps {
  products: Match[];
  selected: Record<string, Match>;
  onToggle: (product: Match) => void;
}

export function SpecTable({ products, selected, onToggle }: SpecTableProps) {
  const shown = products.slice(0, 3);
  if (shown.length === 0) return null;

  const has = (read: (product: Match) => unknown) =>
    shown.some((product) => read(product) !== null && read(product) !== undefined);

  const rows: Row[] = [
    {
      key: "price",
      label: "Price",
      better: "lower",
      read: (product) => product.price_usd,
      format: (value) => money(value),
    },
    {
      key: "battery",
      label: "Battery",
      better: "higher",
      read: (product) => product.specs.battery_hours,
      format: (value) => `${value} h`,
    },
  ];

  if (has((product) => product.specs.ram_gb)) {
    rows.push({
      key: "ram",
      label: "Memory",
      better: "higher",
      read: (product) => product.specs.ram_gb ?? null,
      format: (value) => `${value} GB`,
    });
  }
  if (has((product) => product.specs.storage_gb)) {
    rows.push({
      key: "storage",
      label: "Storage",
      better: "higher",
      read: (product) => product.specs.storage_gb ?? null,
      format: (value) => `${value} GB`,
    });
  }
  if (has((product) => product.specs.camera_mp)) {
    rows.push({
      key: "camera",
      label: "Camera",
      better: "higher",
      read: (product) => product.specs.camera_mp ?? null,
      format: (value) => `${value} MP`,
    });
  }
  if (has((product) => product.specs.anc_level)) {
    rows.push({
      key: "anc",
      label: "ANC",
      better: "higher",
      read: (product) => product.specs.anc_level ?? null,
      format: (value) => `${value}/5`,
    });
  }
  if (has((product) => product.specs.comfort_rating)) {
    rows.push({
      key: "comfort",
      label: "Comfort",
      better: "higher",
      read: (product) => product.specs.comfort_rating ?? null,
      format: (value) => `${value}/5`,
    });
  }
  rows.push({
    key: "weight",
    label: "Weight",
    better: "lower",
    read: (product) => product.specs.weight_kg,
    format: (value) => `${value} kg`,
  });
  rows.push({
    key: "display",
    label: "Display",
    read: (product) => product.specs.display,
    format: (value) => String(value),
  });

  const winnerFor = (row: Row): string | null => {
    if (!row.better) return null;
    const values = shown
      .map((product) => ({ id: product.id, value: numeric(row.read(product)) }))
      .filter((entry): entry is { id: string; value: number } => entry.value !== null);
    if (values.length < 2) return null;
    const target =
      row.better === "lower"
        ? Math.min(...values.map((entry) => entry.value))
        : Math.max(...values.map((entry) => entry.value));
    const winners = values.filter((entry) => entry.value === target);
    return winners.length === 1 ? winners[0].id : null;
  };

  return (
    <div className="spec-table-wrap">
      <table className="spec-table">
        <thead>
          <tr>
            <th scope="col">Spec diff</th>
            {shown.map((product) => (
              <th scope="col" key={product.id}>
                <img src={product.image_url} alt="" loading="lazy" />
                <span className="th-name">{product.name}</span>
                <span className="th-price">{money(product.price_usd)}</span>
                {product.is_stretch_option ? (
                  <span className="stretch-tag">Stretch +{money(product.over_budget_by)}</span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const winner = winnerFor(row);
            return (
              <tr key={row.key}>
                <td>{row.label}</td>
                {shown.map((product) => {
                  const value = row.read(product);
                  return (
                    <td
                      key={product.id}
                      className={winner === product.id ? "winner" : undefined}
                      data-row={row.key}
                    >
                      {value === null || value === undefined ? "—" : row.format(value)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>Action</td>
            {shown.map((product) => {
              const isSelected = Boolean(selected[product.id]);
              return (
                <td key={product.id}>
                  <button
                    type="button"
                    className="product-add"
                    data-selected={isSelected}
                    onClick={() => onToggle(product)}
                  >
                    {isSelected ? (
                      <>
                        <Check size={9} strokeWidth={2.4} /> In cart
                      </>
                    ) : (
                      <>
                        <Plus size={9} strokeWidth={2.4} /> Add
                      </>
                    )}
                  </button>
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
