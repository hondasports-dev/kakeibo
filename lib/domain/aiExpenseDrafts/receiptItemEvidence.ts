import type { ExtractReceiptFieldsResult } from "../../convex/receiptImageExtraction/types";
import type { ReceiptRawObservationLine } from "../receipt/observations";

type Item = NonNullable<ExtractReceiptFieldsResult["items"]>[number];

export function receiptItemMatchName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/^[\s※*◎○]+/, "")
    .replace(/(?:軽[※*]?|込|特|期)\s*$/g, "")
    .replace(/\(?\s*\d+\s*(?:個|コ)\s*[×xX].*$/, "")
    .replace(/\d+\s*@\s*[＊*×xX]\s*\d+.*$/, "")
    .replace(/[\s,:：・￥¥円()（）]/g, "")
    .toLowerCase();
}

export function withoutReceiptAmount(line: ReceiptRawObservationLine): string {
  const text = line.rawText.normalize("NFKC");
  const amount = line.amountText?.normalize("NFKC");
  const at = amount ? text.lastIndexOf(amount) : -1;
  return (at >= 0 ? text.slice(0, at) + text.slice(at + amount!.length) : text).trim();
}

function auxiliary(value: string): boolean {
  const text = value.normalize("NFKC").replace(/\s/g, "");
  return (
    /^\d{6,14}$/.test(text) ||
    /^\(?\d+(?:個|コ)?[×xX]@?(?:単)?\d+\)?$/.test(text) ||
    /^\(?\d+@?[＊*×xX]\d+(?:個|コ)?\)?$/.test(text) ||
    /^\(?\d+(?:個|コ)[×xX]@\d+\)?$/.test(text)
  );
}

/** Join only adjacent printed support rows; retain original observations separately for review. */
export function prepareReceiptItemEvidence(items: Item[], raw: ReceiptRawObservationLine[]) {
  const lines = [...raw]
    .sort((a, b) => a.sourceLineIndex - b.sourceLineIndex)
    .map((line) => ({ ...line }));
  const supportIndexes = new Set<number>();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const previous = lines[i - 1];
    if (
      !auxiliary(withoutReceiptAmount(line)) ||
      !previous.lineRoleCandidates.includes("item") ||
      auxiliary(withoutReceiptAmount(previous)) ||
      !line.explicitlyPrinted ||
      !previous.explicitlyPrinted ||
      line.sourceLineIndex !== previous.sourceLineIndex + 1
    )
      continue;
    if (
      previous.amountYen !== null &&
      line.amountYen !== null &&
      previous.amountYen !== line.amountYen
    )
      continue;
    if (previous.amountYen === null && line.amountYen !== null) {
      previous.amountYen = line.amountYen;
      previous.amountText = line.amountText;
    }
    supportIndexes.add(line.sourceLineIndex);
  }
  const productLines = lines.filter((line) => !supportIndexes.has(line.sourceLineIndex));
  const preparedItems = items
    .filter(
      (item) =>
        !lines.some(
          (line) =>
            supportIndexes.has(line.sourceLineIndex) &&
            receiptItemMatchName(withoutReceiptAmount(line)) ===
              receiptItemMatchName(item.itemName) &&
            line.amountYen === (item.printedAmountYen ?? item.amountYen),
        ),
    )
    .flatMap((item) => {
      const name = receiptItemMatchName(item.itemName);
      const contained = productLines.filter((line) => {
        const rawName = receiptItemMatchName(withoutReceiptAmount(line));
        return (
          line.lineRoleCandidates.includes("item") && rawName.length >= 2 && name.includes(rawName)
        );
      });
      // A merged AI name spanning multiple printed products belongs only to its priced row.
      const priced = contained.filter(
        (line) => line.amountYen === (item.printedAmountYen ?? item.amountYen),
      );
      if (
        new Set(contained.map((line) => receiptItemMatchName(withoutReceiptAmount(line)))).size >
          1 &&
        priced.length === 1 &&
        contained.some((line) => line.amountYen !== priced[0].amountYen)
      ) {
        if (
          items.some(
            (other) =>
              other !== item &&
              receiptItemMatchName(other.itemName) ===
                receiptItemMatchName(withoutReceiptAmount(priced[0])) &&
              (other.printedAmountYen ?? other.amountYen) === priced[0].amountYen,
          )
        )
          return [];
        return { ...item, itemName: withoutReceiptAmount(priced[0]) };
      }
      return item;
    });
  return { items: preparedItems, lines: productLines };
}
