// @vitest-environment jsdom
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import { Lookup } from "@/components/scanner/lookup";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
afterEach(cleanup);
it("rejects invalid addresses without navigation and accepts a valid mint", () => {
  render(<Lookup />);
  fireEvent.change(screen.getByLabelText("Solana token mint address"), {
    target: { value: "bad-address" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Scan token" }));
  expect(screen.getByRole("alert").textContent).toContain("valid Solana");
  expect(push).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Solana token mint address"), {
    target: { value: "So11111111111111111111111111111111111111112" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Scan token" }));
  expect(push).toHaveBeenCalledWith(
    "/token/So11111111111111111111111111111111111111112",
  );
});
