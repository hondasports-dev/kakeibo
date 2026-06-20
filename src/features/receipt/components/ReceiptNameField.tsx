import { TextField } from "@mui/material";
import type { RefObject } from "react";

export function ReceiptNameField({
  bankName,
  bankNameError,
  bankNameRef,
  shopName,
  shopNameError,
  shopNameRef,
  type,
  onFieldChange,
}: {
  bankName: string;
  bankNameError?: string;
  bankNameRef: RefObject<HTMLInputElement | null>;
  shopName: string;
  shopNameError?: string;
  shopNameRef: RefObject<HTMLInputElement | null>;
  type: "expense" | "income";
  onFieldChange: (field: "shopName" | "bankName", value: string) => void;
}) {
  if (type === "expense") {
    return (
      <TextField
        autoComplete="organization"
        data-testid="shop-name-field"
        error={!!shopNameError}
        fullWidth
        helperText={shopNameError}
        id="receipt-shop-name"
        inputRef={shopNameRef}
        label="店舗名"
        name="shopName"
        onChange={(event) => onFieldChange("shopName", event.target.value)}
        placeholder="例: スーパー北浜"
        value={shopName}
      />
    );
  }

  return (
    <TextField
      error={!!bankNameError}
      fullWidth
      helperText={bankNameError}
      id="receipt-bank-name"
      inputRef={bankNameRef}
      label="銀行名"
      name="bankName"
      onChange={(event) => onFieldChange("bankName", event.target.value)}
      placeholder="例: 三菱UFJ銀行"
      value={bankName}
    />
  );
}
