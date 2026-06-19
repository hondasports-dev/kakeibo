import { Typography } from "@mui/material";
import { LegalDocumentLayout, LegalSection } from "../../../components/LegalDocumentLayout";

const EFFECTIVE_DATE = "2026年6月18日";
const CONTACT_EMAIL = "support@suzumemo.jp";

export function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout effectiveDate={EFFECTIVE_DATE} title="プライバシーポリシー">
      <Typography color="text.secondary" variant="body2">
        Suzumemo（以下「本サービス」）は、ユーザーの個人情報を適切に取り扱うため、本プライバシーポリシーを定めます。
      </Typography>

      <LegalSection title="取得する情報">
        <Typography variant="body2">
          本サービスでは、以下の情報を取得する場合があります。
        </Typography>
        <Typography component="ul" sx={{ m: 0, pl: 2.5 }} variant="body2">
          <li>Googleログインにより取得されるメールアドレス、氏名、プロフィール画像等</li>
          <li>ユーザーが入力したメモ、カテゴリ、金額、日付等</li>
          <li>IPアドレス、ブラウザ情報、アクセス日時等の技術情報</li>
        </Typography>
      </LegalSection>

      <LegalSection title="利用目的">
        <Typography component="ul" sx={{ m: 0, pl: 2.5 }} variant="body2">
          <li>認証、アカウント管理</li>
          <li>サービス提供、入力情報の保存・表示・編集・削除</li>
          <li>不具合対応、セキュリティ確保、サービス改善</li>
        </Typography>
      </LegalSection>

      <LegalSection title="Googleログインについて">
        <Typography variant="body2">
          Googleログインは認証目的でのみ利用します。Gmail / Google Drive / Google Calendar
          等の内容は取得しません。
        </Typography>
      </LegalSection>

      <LegalSection title="外部サービスの利用">
        <Typography variant="body2">
          本サービスでは、サービス提供のため以下の外部サービスを利用する場合があります。
        </Typography>
        <Typography component="ul" sx={{ m: 0, pl: 2.5 }} variant="body2">
          <li>Clerk（認証）</li>
          <li>Google（OAuth認証）</li>
          <li>Vercel（ホスティング）</li>
          <li>Convex 等（データベース・バックエンド）</li>
          <li>ログ管理・監視等のサービス（必要に応じて）</li>
        </Typography>
      </LegalSection>

      <LegalSection title="第三者提供">
        <Typography variant="body2">
          法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供しません。
        </Typography>
      </LegalSection>

      <LegalSection title="Cookie等の利用">
        <Typography variant="body2">
          本サービスでは、認証状態の維持やサービス改善のため、Cookie
          および類似技術を利用する場合があります。
        </Typography>
      </LegalSection>

      <LegalSection title="情報の確認・変更・削除">
        <Typography variant="body2">
          ユーザーは、本サービス上の設定画面またはお問い合わせ先より、自己の情報の確認・変更・削除を求めることができます。
        </Typography>
      </LegalSection>

      <LegalSection title="お問い合わせ先">
        <Typography variant="body2">
          本ポリシーに関するお問い合わせは、以下までご連絡ください。
        </Typography>
        <Typography variant="body2">{CONTACT_EMAIL}</Typography>
      </LegalSection>

      <LegalSection title="改定">
        <Typography variant="body2">
          本ポリシーは、必要に応じて改定することがあります。重要な変更がある場合は、本サービス上で告知します。
        </Typography>
      </LegalSection>
    </LegalDocumentLayout>
  );
}
