import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/render";
import { GroupPendingInvitationList } from "./GroupPendingInvitationList";

describe("GroupPendingInvitationList", () => {
  it("pending 招待がない場合は空状態を表示する", () => {
    renderWithProviders(<GroupPendingInvitationList invitations={[]} />);

    expect(screen.getByTestId("group-pending-invitation-list-empty")).toHaveTextContent(
      "送信済みの招待はありません。",
    );
  });

  it("招待先メール、状態、日時を一覧表示する", () => {
    renderWithProviders(
      <GroupPendingInvitationList
        invitations={[
          {
            _id: "invite-001",
            email: "pending@example.com",
            status: "pending",
            createdAt: Date.UTC(2026, 0, 15, 3, 30),
          },
        ]}
      />,
    );

    expect(screen.getByTestId("group-pending-invitation-list")).toBeInTheDocument();
    expect(screen.getByText("pending@example.com")).toBeInTheDocument();
    expect(screen.getByText("招待中")).toBeInTheDocument();
    expect(screen.getByText(/^招待日時: /)).toBeInTheDocument();
  });
});
