import { describe, expect, it } from "vitest";
import { trialExternal8Fixture } from "../../convex/receiptImageExtraction/fixtures/taxFixtures";
import { mapExtractionToDraftArgs } from "./extractionMapping";
import type { ReceiptRawObservationLine } from "../receipt/observations";
import { prepareReceiptItemEvidence } from "./receiptItemEvidence";

const categories = ["食費", "衣服", "その他", "医療"].map((name) => ({ _id: name, name }));
const item = (itemName: string, amount: number) => ({
  ...trialExternal8Fixture.items![0],
  itemName,
  amountYen: amount,
  printedAmountYen: amount,
  amountBasis: "unknown" as const,
  taxRatePercent: null,
  markers: [],
  taxMarker: "",
  categoryName: "食費",
  lineType: "unknown" as const,
});
type Row = [string, number | null, string?, ("item" | "tax" | "subtotal" | "unknown")?];
function observations(rows: Row[]): ReceiptRawObservationLine[] {
  return rows.map(([rawText, amountYen, amountText, role], sourceLineIndex) => ({
    rawText,
    amountYen,
    amountText: amountText ?? null,
    lineRoleCandidates: [role ?? "item"],
    roleConfidence: 0.99,
    explicitlyPrinted: true,
    sourceLineIndex,
  }));
}
function map(items: ReturnType<typeof item>[], rows: Row[], total: number) {
  return mapExtractionToDraftArgs(
    {
      ...trialExternal8Fixture,
      items,
      taxSummaries: [],
      amountYen: total,
      rawObservations: observations(rows),
    },
    categories,
  );
}
function check(result: ReturnType<typeof map>, count: number, total: number) {
  expect(result.items).toHaveLength(count);
  expect(result.items!.reduce((sum, i) => sum + i.amountYen, 0)).toBe(total);
  expect(result.reviewReasons ?? []).not.toContain("amount_mismatch");
  expect(result.amountYen).toBe(total);
  expect(result.items!.every((i) => i.taxResolutionStatus === "resolved")).toBe(true);
}
describe("725 production receipt regressions", () => {
  it.each(["軽 ¥300", "軽※ ¥300", "飲料 軽* ¥300", "軽井沢ビール ¥300"])(
    "recognizes standalone light-tax markers only: %s",
    (rawText) => {
      const result = mapExtractionToDraftArgs(
        {
          ...trialExternal8Fixture,
          amountYen: 300,
          items: [item(rawText.replace(" ¥300", ""), 300)],
          markerDefinitions: [{ marker: "軽", description: "軽は軽減税率8%適用商品" }],
          rawObservations: observations([[rawText, 300, "¥300"]]),
          taxSummaries: [],
        },
        categories,
      );
      expect(result.items![0].markers?.includes("軽")).toBe(!rawText.startsWith("軽井沢"));
    },
  );
  it("recovers a missing tax rate without duplicating or overwriting supplied tax summaries", () => {
    const rawObservations = observations([
      ["食品 ¥100", 100, "¥100"],
      ["用品 ¥220", 220, "¥220"],
      ["8%外税 対象 ¥100", 100, "¥100", "tax"],
      ["8%外税 ¥8", 8, "¥8", "tax"],
      ["10%内税 対象 ¥220", 220, "¥220", "tax"],
      ["10%内税 ¥20", 20, "¥20", "tax"],
    ]);
    const source = {
      ...trialExternal8Fixture,
      amountYen: 328,
      items: [item("食品", 100), item("用品", 220)],
      rawObservations,
      taxSummaries: [],
    };
    const full = mapExtractionToDraftArgs(source, categories);
    const supplied = full.taxSummaries!.filter((s) => s.taxRatePercent === 10);
    const partial = mapExtractionToDraftArgs({ ...source, taxSummaries: supplied }, categories);
    expect(partial.taxSummaries).toHaveLength(2);
    expect(partial.items!.reduce((sum, i) => sum + i.amountYen, 0)).toBe(328);
    expect(partial.taxSummaries!.find((s) => s.taxRatePercent === 8)?.taxYen).toBe(8);
    const conflict = mapExtractionToDraftArgs(
      { ...source, taxSummaries: supplied.map((s) => ({ ...s, taxYen: 99 })) },
      categories,
    );
    expect(conflict.taxSummaries!.filter((s) => s.taxRatePercent === 10)).toHaveLength(1);
    expect(conflict.taxSummaries!.find((s) => s.taxRatePercent === 10)?.taxYen).toBe(99);
  });
  it("uses corroborated unknown product rows to separate merged names, without promoting footer labels", () => {
    const raw = observations([
      ["コーラ ¥88", 88, "¥88", "unknown"],
      ["キャメル ¥1060", 1060, "¥1060", "unknown"],
      ["合計 ¥1148", 1148, "¥1148", "unknown"],
      ["不明 ¥999", 999, "¥999", "unknown"],
    ]);
    const result = prepareReceiptItemEvidence([item("コーラキャメル", 1060)], raw);
    expect(result.items[0].itemName).toBe("キャメル");
    expect(result.lines.slice(0, 2).every((line) => line.lineRoleCandidates.includes("item"))).toBe(
      true,
    );
    expect(result.lines.slice(2).every((line) => line.lineRoleCandidates.includes("unknown"))).toBe(
      true,
    );
    expect(raw.every((line) => line.lineRoleCandidates.includes("unknown"))).toBe(true);
  });
  it("does not fill missing mixed receipt categories from the shop category", () => {
    const result = mapExtractionToDraftArgs(
      {
        ...trialExternal8Fixture,
        categoryName: "医療",
        items: [
          { ...item("カルピスソーダ", 85), categoryName: "" },
          { ...item("キャメル", 1060), categoryName: "その他" },
        ],
      },
      categories,
    );
    expect(result.items!.map((i) => i.categoryId)).toEqual([undefined, "その他"]);
  });
  it("does not recover point balances mentioned inside an AI merged name as products", () => {
    const result = map(
      [item("牛乳ポイント残高", 200)],
      [
        ["牛乳 ¥200", 200, "¥200", "unknown"],
        ["ポイント残高 100", 100, "100", "unknown"],
      ],
      200,
    );
    expect(result.items).toHaveLength(1);
    expect(result.items![0].amountYen).toBe(200);
    expect(result.rawObservationLines![1].lineRoleCandidates).toEqual(["unknown"]);
  });
  it("715 keeps six products, not a merged seventh candidate", () => {
    const names = [
      "コカ・コーラゼロカフェ",
      "内ヒキャメル・メンソール・2コ×単530",
      "世界のキッチンからソル",
      "GREENDAKARAやさしい麦",
      "マンハッタン",
      "柿の種&ピーナッツ",
    ];
    const amounts = [88, 1060, 88, 78, 108, 398];
    const result = map(
      [item(names[0] + names[1], 1060), ...names.slice(2).map((n, i) => item(n, amounts[i + 2]))],
      [
        ...names.map((n, i): Row => [n + ` ¥${amounts[i]}`, amounts[i], `¥${amounts[i]}`]),
        ["8%外税 対象 ¥760", 760, "¥760", "tax"],
        ["8%外税 ¥60", 60, "¥60", "tax"],
        ["10%内税 対象 ¥1060", 1060, "¥1060", "tax"],
        ["10%内税 ¥96", 96, "¥96", "tax"],
      ],
      1880,
    );
    check(result, 6, 1880);
  });
  it("717 binds quantity row to the tobacco product", () => {
    check(
      map(
        [
          item("キリン 世界のKソルテ 軽", 106),
          item("カルピスソーダ", 85),
          item("キャメル・メンソール・コ", 1060),
        ],
        [
          ["キリン 世界のKソルテ 軽 ¥106", 106, "¥106"],
          ["カルピスソーダ ¥85", 85, "¥85"],
          ["キャメル・メンソール・コ", null],
          ["530@x 2個 ¥1060", 1060, "¥1060"],
          ["(内)税対象額 8% ¥191", 191, "¥191", "tax"],
          ["(内)税額 8% ¥14", 14, "¥14", "tax"],
          ["(内)税対象額 10% ¥1060", 1060, "¥1060", "tax"],
          ["(内)税額 10% ¥96", 96, "¥96", "tax"],
        ],
        1251,
      ),
      3,
      1251,
    );
  });
  it("718 matches markers, widths and quantity suffixes without doubling bread", () => {
    check(
      map(
        [
          item("焼き立てパン１８０", 180),
          item("焼き立てパン１９０", 380),
          item("焼き立てパン２１０", 840),
        ],
        [
          ["◎焼き立てパン１８０ ¥180込", 180, "¥180"],
          ["◎焼き立てパン１９０ ¥380込", 380, "¥380"],
          ["190 @＊2", null],
          ["◎焼き立てパン２１０ ¥840込", 840, "¥840"],
          ["210 @＊4", null],
          ["8%対象額(込) ¥1400", 1400, "¥1400", "tax"],
          ["内税額 8% ¥104", 104, "¥104", "tax"],
        ],
        1400,
      ),
      3,
      1400,
    );
  });
  it("719 binds code/amount rows to named products", () => {
    const result = map(
      [item("ファンウェアベスト GY L1", 4780), item("接触冷感コンプレッシ NF30", 998)].map((i) => ({
        ...i,
        categoryName: "衣服",
      })),
      [
        ["20 ファンウェアベスト GY L1", null],
        ["24151788 4,780", 4780, "4,780"],
        ["20 接触冷感コンプレッシ NF30", null],
        ["20144678 998", 998, "998"],
        ["10%対象 ¥5778", 5778, "¥5778", "tax"],
        ["10%対象消費税 ¥525", 525, "¥525", "tax"],
      ],
      5778,
    );
    check(result, 2, 5778);
    expect(result.items!.map((i) => i.categoryId)).toEqual(["衣服", "衣服"]);
  });
  it("720 preserves repeated meat and missing products without duplicate recovery", () => {
    const amounts = [
      158, 196, 198, 88, 88, 762, 462, 467, 98, 98, 196, 158, 198, 158, 228, 828, 238, 108, 109, 78,
      88, 108, 118, 228, 148, 98, 516, 298, 248, 258, 256, 779,
    ];
    const names = [
      "キャベツ",
      "にら",
      "ブロッコリー",
      "えのき",
      "ぶなしめじ",
      "骨取り銀鮭切身(解凍",
      "豚小間切落し",
      "豚小間切落し",
      "濃くておいしいもめ",
      "濃くておいしいきぬ",
      "もっちりうまい濃厚",
      "しいたけ昆布",
      "コロコロチキンコン",
      "新鮮!使い切りロース",
      "ヤクルト糖質・カロリ",
      "別海の特選牛乳",
      "ネオソフト",
      "サンミー",
      "ゆごね",
      "チョコフランス",
      "熟ふわロールつぶあんマ",
      "やわらか北海道ミルク",
      "ファボールサンドコー",
      "ネオレーズンバターロ",
      "コッペパン(ジャム&",
      "バゲット",
      "極み鮮卵",
      "コンソメ顆粒",
      "カロリーハーフマヨネ",
      "ひとくちさん",
      "日清ソース焼そばカ",
      "料理のための清酒",
    ];
    const result = map(
      names.map((n, i) => item(n, amounts[i])),
      [
        ...names.map((n, i): Row => [
          `${i === 31 ? "" : "※ "}${n} ¥${amounts[i]}`,
          amounts[i],
          `¥${amounts[i]}`,
        ]),
        ["外税 8% ¥582", 582, "¥582", "tax"],
        ["外税 10% ¥77", 77, "¥77", "tax"],
        ["税率8%対象額 ¥7860", 7860, "¥7860", "tax"],
        ["(内)消費税等8% ¥582", 582, "¥582", "tax"],
        ["税率10%対象額 ¥856", 856, "¥856", "tax"],
        ["(内)消費税等10% ¥77", 77, "¥77", "tax"],
        ["※は軽減税率(8%)適用商品です", null, undefined, "unknown"],
      ],
      8716,
    );
    check(result, 32, 8716);
    expect(
      result.items!.filter((i) => i.itemName === "豚小間切落し").map((i) => i.printedAmountYen),
    ).toEqual([462, 467]);
    expect(
      result.items!.filter((i) => i.taxRatePercent === 10).map((i) => i.printedAmountYen),
    ).toEqual([779]);
    expect(result.items!.reduce((sum, i) => sum + (i.allocatedTaxYen ?? 0), 0)).toBe(659);
  });
  it("721 keeps discounts and normalizes the single external subtotal", () => {
    const amounts = [
      128, 256, 158, 98, 98, 38, 426, -43, 196, 196, 88, 228, 828, 128, 78, 78, 208, 198, 98, 98,
      98, 98, 516, 499, 148, 318, 128, 128, 389, 98, 88, 199, 216, 174, -16, 258, -10,
    ];
    const names = [
      "はくさい",
      "こまつな",
      "洋にんじん(大袋)",
      "えのき",
      "ぶなしめじ",
      "シャキシャキっとしたも",
      "トリプルミンチ(牛・",
      "割引10%",
      "濃くておいしいきぬ",
      "もっちりうまい濃厚",
      "竹輪",
      "ヤクルト糖質・カロリ",
      "別海の特選牛乳",
      "サンミー",
      "ミルクフランス",
      "チョコフランス",
      "超熟ロールレーズン",
      "プチケーキ",
      "生めろんぱん クラ",
      "生めろんぱん",
      "牛乳仕込みのミルク",
      "バゲット",
      "ミックス玉子",
      "ウルラ EXVオリ",
      "ひとくちさん",
      "麻婆豆腐の素甘口",
      "どん兵衛きつねうどん",
      "どん兵衛肉うどんミニ",
      "サッポロ一番みそラー",
      "旨みの一杯味噌らーめん",
      "ショッパーズ生姜香る醤",
      "お椀で食べるカップ",
      "あっさりカップヌー",
      "たまねぎ(バラ)",
      "M002玉ねぎ3玉",
      "マルちゃん焼き",
      "M001東洋水産よりどり",
    ];
    const result = map(
      names.map((n, i) => item(n, amounts[i])),
      [
        ...names.map((n, i): Row => [`※ ${n} ¥${amounts[i]}`, amounts[i], `¥${amounts[i]}`]),
        ["小計 ¥6910", 6910, "¥6910", "subtotal"],
        ["外税8% ¥552", 552, "¥552", "tax"],
      ],
      7462,
    );
    check(result, 37, 7462);
    expect(
      result.items!.filter((i) => i.printedAmountYen! < 0).map((i) => i.printedAmountYen),
    ).toEqual([-43, -16, -10]);
    expect(result.reviewReasons).toContain("user_confirmation_required");
  });
  it("716 remains two included items", () => {
    const result = map(
      [{ ...item("inタブレット塩分+", 204), categoryName: "医療" }, item("ルヴァン黒糖", 193)],
      [
        ["inタブレット塩分+ ¥204", 204, "¥204"],
        ["ルヴァン黒糖 ¥193", 193, "¥193"],
        ["内税8%対象 ¥397", 397, "¥397", "tax"],
        ["内税8% ¥29", 29, "¥29", "tax"],
      ],
      397,
    );
    check(result, 2, 397);
    expect(result.items!.map((i) => i.categoryId)).toEqual(["医療", "食費"]);
  });
  it("preserves two genuinely repeated identical products and their categories", () => {
    const result = map(
      [item("パン", 100), item("パン", 100)],
      [
        ["※パン ¥100", 100, "¥100"],
        ["※パン ¥100", 100, "¥100"],
        ["内税8%対象 ¥200", 200, "¥200", "tax"],
        ["内税8% ¥14", 14, "¥14", "tax"],
      ],
      200,
    );
    check(result, 2, 200);
    expect(result.items!.map((i) => i.categoryId)).toEqual(["食費", "食費"]);
  });
  it("does not discard numeric products without supporting raw evidence", () => {
    expect(prepareReceiptItemEvidence([item("12345678", 100)], []).items).toHaveLength(1);
  });
  it("removes a merged candidate when the separate priced product already exists", () => {
    const result = prepareReceiptItemEvidence(
      [item("コーラ", 88), item("キャメル", 1060), item("コーラキャメル", 1060)],
      observations([
        ["コーラ ¥88", 88, "¥88"],
        ["キャメル ¥1060", 1060, "¥1060"],
      ]),
    );
    expect(result.items.map((i) => i.itemName)).toEqual(["コーラ", "キャメル"]);
  });
  it("does not merge conflicting adjacent amounts or mutate original observations", () => {
    const raw = observations([
      ["商品 ¥100", 100, "¥100"],
      ["12345678 ¥200", 200, "¥200"],
    ]);
    const original = structuredClone(raw);
    expect(prepareReceiptItemEvidence([], raw).lines).toHaveLength(2);
    expect(raw).toEqual(original);
  });
});
