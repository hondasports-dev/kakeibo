import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "react-email";
import { type GroupOwnershipReceivedPayload } from "../model";
import { buildEmailUrl } from "../url";
import { EmailFooter } from "./Footer";

export function GroupOwnershipReceived({ groupName }: GroupOwnershipReceivedPayload) {
  return (
    <Html lang="ja">
      <Head />
      <Preview>「{groupName}」のオーナーになりました</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f6f6f6" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px" }}>
          <Heading as="h1">「{groupName}」のオーナーになりました</Heading>
          <Section>
            <Text>「{groupName}」のオーナー権限を受け取りました。</Text>
            <Text>これからは、メンバーや招待などのグループ管理を行えます。</Text>
          </Section>
          <Section>
            <Button
              href={buildEmailUrl("/settings")}
              style={{ padding: "12px 24px", backgroundColor: "#111827", color: "#ffffff" }}
            >
              グループ設定を確認する
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
