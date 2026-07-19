import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { useActionMock, useMutationMock, useQueryMock } = vi.hoisted(() => ({
  useActionMock: vi.fn(),
  useMutationMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useAction: useActionMock,
  useMutation: useMutationMock,
  useQuery: useQueryMock,
}));

import { useSystemAdminManagement } from "./useSystemAdminManagement";

describe("useSystemAdminManagement", () => {
  const actionMock = vi.fn();
  const grantMock = vi.fn();
  const revokeMock = vi.fn();

  beforeEach(() => {
    actionMock.mockResolvedValue({
      page: [
        {
          id: "target-doc",
          userId: "target-user",
          displayName: "対象ユーザー",
          email: "target@example.test",
          activeGroupId: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      isDone: true,
      continueCursor: "",
    });
    useActionMock.mockReturnValue(actionMock);
    useMutationMock.mockReturnValue(grantMock);
    useMutationMock.mockReturnValue(revokeMock);

    let queryCallCount = 0;
    useQueryMock.mockImplementation(() => {
      queryCallCount += 1;
      if (queryCallCount === 1) {
        return { status: "active", environment: "preview", userId: "owner-doc" };
      }
      return {
        page: [
          {
            id: "admin-doc",
            targetUserId: "owner-doc",
            displayName: "管理者",
            email: "owner@example.test",
            status: "active",
            grantedAt: 1,
            createdAt: 1,
            updatedAt: 1,
            isSelf: true,
          },
        ],
        isDone: true,
        continueCursor: "",
      };
    });
  });

  it("初期状態で active フィルタと空の検索クエリを返す", () => {
    const { result } = renderHook(() => useSystemAdminManagement());

    expect(result.current.statusFilter).toBe("active");
    expect(result.current.searchQuery).toBe("");
    expect(result.current.candidates).toEqual([]);
    expect(result.current.environment).toBe("preview");
  });

  it("runSearch で候補を取得する", async () => {
    const { result } = renderHook(() => useSystemAdminManagement());

    await act(async () => {
      result.current.setSearchQuery("対象");
    });

    await act(async () => {
      await result.current.runSearch();
    });

    await waitFor(() => {
      expect(result.current.candidates).toHaveLength(1);
      expect(result.current.candidates[0].displayName).toBe("対象ユーザー");
    });
  });
});
