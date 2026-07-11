import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "react-email";
import { type GroupMembershipRemovedPayload } from "../model";
import { buildEmailUrl } from "../url";
import { EmailFooter } from "./Footer";

export function GroupMembershipRemoved({ groupName }: GroupMembershipRemovedPayload) {
  return (
    <Html lang="ja">
      <Head />
      <Preview>「{groupName}」から外れました</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f6f6f6" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px" }}>
          <Heading as="h1">「{groupName}」から外れました</Heading>
          <Section>
            <Text>「{groupName}」のメンバーではなくなりました。</Text>
            <Text>このグループに登録されている家計データにはアクセスできなくなります。</Text>
            <Text>
              Suzumemoのアカウント自体は削除されていません。ほかのグループに所属している場合、そのグループには引き続きアクセスできます。
            </Text>
            <Text>この変更に心当たりがない場合は、グループのオーナーへご確認ください。</Text>
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
