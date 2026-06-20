import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { GroupMemberList } from "./GroupMemberList";
import type { GroupMemberListItem } from "../utils/groupMemberDisplay";

const members: GroupMemberListItem[] = [
  {
    userId: "https://issuer.example|owner-clerk-id",
    role: "owner",
    displayName: "オーナー",
    email: "owner@example.com",
    createdAt: 1000,
  },
  {
    userId: "user-member",
    role: "member",
    displayName: "メンバー",
    email: "member@example.com",
    createdAt: 2000,
  },
];

describe("GroupMemberList", () => {
  it("メンバー一覧を表示し、自分自身とロールを判別できる", () => {
    renderWithProviders(
      <GroupMemberList
        currentUserDisplayName="ログイン 太郎"
        currentUserId="owner-clerk-id"
        isOwner
        members={members}
        onRequestRemove={vi.fn()}
        ownerCount={1}
        savingTarget={null}
      />,
    );

    expect(screen.getByTestId("group-member-list")).toBeInTheDocument();
    expect(screen.getByText("ログイン 太郎")).toBeInTheDocument();
    expect(screen.getByText("あなた")).toBeInTheDocument();
    expect(screen.getAllByText("オーナー").length).toBeGreaterThan(0);
    expect(screen.getAllByText("メンバー").length).toBeGreaterThan(0);
    expect(screen.getByText("member@example.com")).toBeInTheDocument();
  });

  it("メンバーがいないときは空状態を表示する", () => {
    renderWithProviders(
      <GroupMemberList
        currentUserDisplayName={null}
        currentUserId="owner-clerk-id"
        isOwner
        members={[]}
        ownerCount={0}
        savingTarget={null}
      />,
    );

    expect(screen.getByTestId("group-member-list-empty")).toHaveTextContent(
      "まだメンバーがいません。",
    );
  });

  it("member には解除ボタンを表示しない", () => {
    renderWithProviders(
      <GroupMemberList
        currentUserDisplayName={null}
        currentUserId="user-member"
        isOwner={false}
        members={members}
        ownerCount={1}
        savingTarget={null}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "メンバーをグループから外す" }),
    ).not.toBeInTheDocument();
  });

  it("owner は member の解除ボタンを押せる", async () => {
    const user = userEvent.setup();
    const onRequestRemove = vi.fn();

    renderWithProviders(
      <GroupMemberList
        currentUserDisplayName="ログイン 太郎"
        currentUserId="owner-clerk-id"
        isOwner
        members={members}
        onRequestRemove={onRequestRemove}
        ownerCount={1}
        savingTarget={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: "メンバーをグループから外す" }));
    expect(onRequestRemove).toHaveBeenCalledWith(members[1], "メンバー");
  });

  it("owner 自身の解除ボタンは無効で押せない", () => {
    renderWithProviders(
      <GroupMemberList
        currentUserDisplayName="ログイン 太郎"
        currentUserId="owner-clerk-id"
        isOwner
        members={members}
        onRequestRemove={vi.fn()}
        ownerCount={1}
        savingTarget={null}
      />,
    );

    expect(screen.getByRole("button", { name: "ログイン 太郎をグループから外す" })).toBeDisabled();
  });

  it("owner は他メンバーのロール変更を要求できる", async () => {
    const user = userEvent.setup();
    const onRequestRoleChange = vi.fn();

    renderWithProviders(
      <GroupMemberList
        currentUserDisplayName="ログイン 太郎"
        currentUserId="owner-clerk-id"
        isOwner
        members={members}
        onRequestRoleChange={onRequestRoleChange}
        ownerCount={1}
        savingTarget={null}
      />,
    );

    await user.click(
      within(screen.getByTestId("group-member-role-select-user-member")).getByRole("combobox"),
    );
    await user.click(await screen.findByRole("option", { name: "オーナー" }));
    expect(onRequestRoleChange).toHaveBeenCalledWith(members[1], "owner", "メンバー");
  });

  it("member にはロール変更 UI を表示しない", () => {
    renderWithProviders(
      <GroupMemberList
        currentUserDisplayName={null}
        currentUserId="user-member"
        isOwner={false}
        members={members}
        ownerCount={1}
        savingTarget={null}
      />,
    );

    expect(screen.queryByLabelText(/のロール$/)).not.toBeInTheDocument();
  });
});
