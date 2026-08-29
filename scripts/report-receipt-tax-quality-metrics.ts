import { execFileSync } from "node:child_process";
import { receiptTaxGoldenCaseLedger } from "../lib/domain/receipt/tax/fixtures/receiptTaxGoldenCaseLedger";
import {
  buildReceiptTaxQualityMetrics,
  formatReceiptTaxQualityMetrics,
} from "../lib/domain/receipt/tax/receiptTaxQualityMetrics";

function currentRevision(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

console.log(
  formatReceiptTaxQualityMetrics(
    buildReceiptTaxQualityMetrics(receiptTaxGoldenCaseLedger),
    currentRevision(),
  ),
);
