import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeAccountDeletion } from "./repository.js";

const { connectMock, queryMock, releaseMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  queryMock: vi.fn(),
  releaseMock: vi.fn(),
}));

vi.mock("../../shared/db.js", () => ({
  db: {
    connect: connectMock,
    query: vi.fn(),
  },
}));

describe("executeAccountDeletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    queryMock.mockResolvedValue({ rows: [], rowCount: 0 });
    connectMock.mockResolvedValue({
      query: queryMock,
      release: releaseMock,
    });
  });

  it("deletes plan chat summaries by user_id before deleting plans", async () => {
    await executeAccountDeletion(42);

    expect(queryMock).toHaveBeenCalledWith("BEGIN");
    expect(queryMock).toHaveBeenCalledWith(`DELETE FROM plan_chat_summaries WHERE user_id = $1`, [42]);
    expect(queryMock).not.toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM plan_chat_summaries WHERE plan_id IN"),
      expect.anything(),
    );

    const executedSql = queryMock.mock.calls.map(([sql]) => sql);
    const summaryDeleteIndex = executedSql.findIndex(
      (sql) => sql === `DELETE FROM plan_chat_summaries WHERE user_id = $1`,
    );
    const plansDeleteIndex = executedSql.findIndex((sql) => sql === `DELETE FROM plans WHERE user_id = $1`);

    expect(summaryDeleteIndex).toBeGreaterThan(-1);
    expect(plansDeleteIndex).toBeGreaterThan(summaryDeleteIndex);
    expect(queryMock).toHaveBeenLastCalledWith("COMMIT");
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });
});
