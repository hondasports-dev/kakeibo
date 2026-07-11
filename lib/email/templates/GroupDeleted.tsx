import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "react-email";
import { type GroupDeletedPayload } from "../model";
import { buildEmailUrl } from "../url";
import { EmailFooter } from "./Footer";

export function GroupDeleted({ groupName }: GroupDeletedPayload) {
  return (
    <Html lang="ja">
      <Head />
      <Preview>「{groupName}」が削除されました</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f6f6f6" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px" }}>
          <Heading as="h1">「{groupName}」が削除されました</Heading>
          <Section>
            <Text>「{groupName}」が削除されました。</Text>
            <Text>このグループに登録されていた家計データも削除され、アクセスできません。</Text>
            <Text>
              Suzumemoのアカウント自体は削除されていません。ほかのグループに所属している場合、そのグループには影響ありません。
            </Text>
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
