import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "react-email";
import { type GroupOwnershipTransferredPayload } from "../model";
import { buildEmailUrl } from "../url";
import { EmailFooter } from "./Footer";

export function GroupOwnershipTransferred({ groupName, newOwnerDisplayName }: GroupOwnershipTransferredPayload) {
  return (
    <Html lang="ja">
      <Head />
      <Preview>「{groupName}」のオーナー権限を譲渡しました</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f6f6f6" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px" }}>
          <Heading as="h1">「{groupName}」のオーナー権限を譲渡しました</Heading>
          <Section>
            <Text>
              「{groupName}」のオーナー権限を、{newOwnerDisplayName}さんへ譲渡しました。
            </Text>
            <Text>あなたの権限はメンバーへ変更されています。</Text>
            <Text>グループへの所属と家計データの利用は引き続き可能です。</Text>
          </Section>
          <Section>
            <Button href={buildEmailUrl("/settings")} style={{ padding: "12px 24px", backgroundColor: "#111827", color: "#ffffff" }}>
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
