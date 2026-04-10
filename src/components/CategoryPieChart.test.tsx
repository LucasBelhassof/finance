import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CategoryPieChart from "@/components/CategoryPieChart";

const items = [
  {
    id: "alimentacao",
    label: "Alimentacao",
    color: "#e76f51",
    total: 450,
    formattedTotal: "R$ 450,00",
    percentage: 60,
    count: 3,
  },
  {
    id: "transporte",
    label: "Transporte",
    color: "bg-info",
    total: 300,
    formattedTotal: "R$ 300,00",
    percentage: 40,
    count: 2,
  },
];

describe("CategoryPieChart", () => {
  it("renders the pie legend with totals and percentages", () => {
    render(<CategoryPieChart items={items} emptyMessage="Sem dados" />);

    expect(screen.getByText("Alimentacao")).toBeInTheDocument();
    expect(screen.getByText("R$ 450,00")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
  });

  it("calls onSelectItem and marks the selected category", () => {
    const onSelectItem = vi.fn();

    render(
      <CategoryPieChart
        items={items}
        emptyMessage="Sem dados"
        selectedItemId="alimentacao"
        onSelectItem={onSelectItem}
      />,
    );

    const button = screen.getAllByRole("button", { name: /Filtrar por categoria Transporte/i })[0];
    fireEvent.click(button);

    expect(onSelectItem).toHaveBeenCalledWith("transporte");
    expect(screen.getAllByRole("button", { name: /Filtrar por categoria Alimentacao/i })[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the empty state when there is no category data", () => {
    render(<CategoryPieChart items={[]} emptyMessage="Sem categorias para exibir" />);

    expect(screen.getByText("Sem categorias para exibir")).toBeInTheDocument();
  });
});
