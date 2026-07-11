import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "react-email";
import { type AiReviewRequiredPayload } from "../model";
import { buildEmailUrl } from "../url";
import { EmailFooter } from "./Footer";

export function AiReviewRequired({ pendingCount }: AiReviewRequiredPayload) {
  return (
    <Html lang="ja">
      <Head />
      <Preview>確認が必要なレシートが{String(pendingCount)}件あります</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f6f6f6" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px" }}>
          <Heading as="h1">確認が必要なレシートが{String(pendingCount)}件あります</Heading>
          <Section>
            <Text>レシートの読み取りで、{String(pendingCount)}件だけ確認したいところがあります。</Text>
            <Text>内容を確認すると、そのまま登録できます。</Text>
          </Section>
          <Section>
            <Button href={buildEmailUrl("/weeks/current/input")} style={{ padding: "12px 24px", backgroundColor: "#111827", color: "#ffffff" }}>
              確認する
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
