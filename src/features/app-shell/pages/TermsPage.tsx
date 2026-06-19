import { Typography } from "@mui/material";
import { LegalDocumentLayout, LegalSection } from "../../../components/LegalDocumentLayout";

const EFFECTIVE_DATE = "2026年6月18日";

export function TermsPage() {
  return (
    <LegalDocumentLayout effectiveDate={EFFECTIVE_DATE} title="利用規約">
      <Typography color="text.secondary" variant="body2">
        本利用規約（以下「本規約」）は、Suzumemo（以下「本サービス」）の利用条件を定めるものです。
        ユーザーは本規約に同意のうえ、本サービスを利用してください。
      </Typography>

      <LegalSection title="適用範囲">
        <Typography variant="body2">
          本規約は、本サービスの利用に関わる一切の関係に適用されます。
        </Typography>
      </LegalSection>

      <LegalSection title="アカウント登録と管理">
        <Typography variant="body2">
          ユーザーは Google アカウント等を用いて本サービスに登録できます。
          アカウント情報の管理責任はユーザー自身にあり、第三者による不正利用を防ぐため、
          適切に管理してください。
        </Typography>
      </LegalSection>

      <LegalSection title="禁止事項">
        <Typography variant="body2">ユーザーは、以下の行為をしてはなりません。</Typography>
        <Typography component="ul" sx={{ m: 0, pl: 2.5 }} variant="body2">
          <li>法令または公序良俗に反する行為</li>
          <li>不正アクセス、権限のない操作、脆弱性の探索</li>
          <li>過度なアクセスや自動化による負荷の発生</li>
          <li>本サービスの運営を妨害する行為</li>
          <li>不正・不適切な利用、その他運営者が不適切と判断する行為</li>
        </Typography>
      </LegalSection>

      <LegalSection title="ユーザー入力情報の扱い">
        <Typography variant="body2">
          メモ、金額、カテゴリ、日付等の入力情報は、ユーザー自身が管理するものとします。
          入力内容の正確性、保存、削除についてはユーザーの責任において行ってください。
        </Typography>
      </LegalSection>

      <LegalSection title="AI解析・自動分類機能">
        <Typography variant="body2">
          本サービスに AI 解析・自動分類機能がある場合、その結果は参考情報であり、
          その正確性を保証しません。最終的な記録内容はユーザー自身が確認してください。
        </Typography>
      </LegalSection>

      <LegalSection title="サービス変更・停止・終了">
        <Typography variant="body2">
          運営者は、ユーザーへの事前通知の有無を問わず、本サービスの内容変更、
          一時停止、または終了を行う場合があります。
        </Typography>
      </LegalSection>

      <LegalSection title="免責事項">
        <Typography variant="body2">
          運営者は、本サービス上の家計管理・支出記録の正確性を保証しません。
          入力内容、分類結果、表示内容の正確性、完全性、有用性についても保証しません。
          本サービスの利用により生じた損害について、運営者に故意または重過失がない限り
          責任を負いません。
        </Typography>
      </LegalSection>

      <LegalSection title="知的財産権">
        <Typography variant="body2">
          本サービスに関する著作権、商標権その他の知的財産権は、運営者または正当な権利者に帰属します。
        </Typography>
      </LegalSection>

      <LegalSection title="退会・アカウント削除">
        <Typography variant="body2">
          ユーザーは、設定画面またはお問い合わせ先より、退会およびアカウント削除を求めることができます。
        </Typography>
      </LegalSection>

      <LegalSection title="規約変更">
        <Typography variant="body2">
          運営者は、必要に応じて本規約を変更できます。変更後の規約は、本サービス上での掲示をもって効力を生じます。
        </Typography>
      </LegalSection>

      <LegalSection title="準拠法・管轄">
        <Typography variant="body2">
          本規約は日本法に準拠します。本サービスに関して紛争が生じた場合、
          運営者の所在地を管轄する裁判所を第一審の専属的合意管轄とします。
        </Typography>
      </LegalSection>
    </LegalDocumentLayout>
  );
}
