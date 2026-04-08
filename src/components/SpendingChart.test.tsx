import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SpendingChart from "@/components/SpendingChart";
import type { SpendingItem } from "@/types/api";

const spending: SpendingItem[] = [
  {
    slug: "moradia",
    label: "Moradia",
    color: "bg-primary",
    total: 1800,
    formattedTotal: "R$ 1.800,00",
    percentage: 45,
  },
  {
    slug: "alimentacao",
    label: "Alimentacao",
    color: "bg-warning",
    total: 1200,
    formattedTotal: "R$ 1.200,00",
    percentage: 30,
  },
  {
    slug: "transporte",
    label: "Transporte",
    color: "bg-info",
    total: 1000,
    formattedTotal: "R$ 1.000,00",
    percentage: 25,
  },
];

describe("SpendingChart", () => {
  it("renders the pie chart summary with legend values", () => {
    render(<SpendingChart spending={spending} />);

    expect(screen.getByText("Gastos por Categoria")).toBeInTheDocument();
    expect(screen.getByText("Moradia")).toBeInTheDocument();
    expect(screen.getByText("Alimentacao")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.800,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.200,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.000,00")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("keeps the empty state when there is no spending data", () => {
    render(<SpendingChart spending={[]} />);

    expect(screen.getByText(/Ainda nao existem gastos categorizados para exibir/i)).toBeInTheDocument();
  });
});
