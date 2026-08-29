import { execFileSync } from "node:child_process";
import { receiptTaxGoldenCaseLedger } from "../lib/domain/receipt/tax/fixtures/receiptTaxGoldenCaseLedger";
import {
  buildReceiptTaxQualityMetrics,
  formatReceiptTaxQualityMetrics,
  hasReceiptTaxQualityFailure,
} from "../lib/domain/receipt/tax/receiptTaxQualityMetrics";

function currentRevision(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

const metrics = buildReceiptTaxQualityMetrics(receiptTaxGoldenCaseLedger);
console.log(formatReceiptTaxQualityMetrics(metrics, currentRevision()));
if (hasReceiptTaxQualityFailure(metrics)) {
  process.exitCode = 1;
}
