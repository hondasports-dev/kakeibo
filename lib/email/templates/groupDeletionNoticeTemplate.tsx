import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "react-email";
import { render, toPlainText } from "react-email";
import type { BuiltEmail, GroupDeletionFailedPayload, GroupDeletionStartedPayload } from "../model";
import { subjectRenderers } from "../templateDefinitions";
import { buildEmailUrl } from "../url";
import { EmailFooter } from "./Footer";

function GroupDeletionNotice({ groupName, failed }: { groupName: string; failed: boolean }) {
  const heading = failed
    ? `「${groupName}」の削除を完了できませんでした`
    : `「${groupName}」の削除を開始しました`;
  return (
    <Html lang="ja">
      <Head />
      <Preview>{heading}</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f6f6f6" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px" }}>
          <Heading as="h1">{heading}</Heading>
          <Section>
            <Text>
              {failed
                ? "グループは利用できない状態のままです。Suzumemoの削除状況画面から再開してください。"
                : "グループはすでに利用できません。家計データの完全削除はバックグラウンドで進みます。"}
            </Text>
            <Text>この操作は取り消し・復元できません。</Text>
            <Text>Suzumemoのアカウント自体と、ほかのグループは削除されません。</Text>
          </Section>
          <Section>
            <Button
              href={buildEmailUrl("/")}
              style={{ padding: "12px 24px", backgroundColor: "#111827", color: "#ffffff" }}
            >
              Suzumemoを開く
            </Button>
          </Section>
          <Section>
            <EmailFooter />
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

async function renderNotice(groupName: string, failed: boolean): Promise<BuiltEmail> {
  const html = await render(<GroupDeletionNotice failed={failed} groupName={groupName} />);
  return {
    subject: subjectRenderers[failed ? "group_deletion_failed" : "group_deletion_started"]({
      groupName,
    }),
    html,
    text: toPlainText(html),
  };
}

export async function renderGroupDeletionStarted(
  payload: GroupDeletionStartedPayload,
): Promise<BuiltEmail> {
  return await renderNotice(payload.groupName, false);
}

export async function renderGroupDeletionFailed(
  payload: GroupDeletionFailedPayload,
): Promise<BuiltEmail> {
  return await renderNotice(payload.groupName, true);
}
