import { describe, it, expect } from "vitest";
import { IntlMessageFormat } from "intl-messageformat";
import en from "../../../messages/en.json";
import th from "../../../messages/th.json";
import { locales, negotiateLocale } from "../helper";

const catalogs = { en, th } as const;

/** Flattens `{ A: { b: "x" } }` into `{ "A.b": "x" }`. */
function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
    return Object.entries(obj).reduce<Record<string, string>>((acc, [key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "string") acc[path] = value;
        else Object.assign(acc, flatten(value as Record<string, unknown>, path));
        return acc;
    }, {});
}

/** Argument names and rich-text tags a message depends on: the contract the code calls it with. */
function placeholders(message: string): string[] {
    const names = new Set<string>();
    const walk = (elements: ReturnType<typeof IntlMessageFormat.prototype.getAst>) => {
        for (const el of elements) {
            // type 0 literal | 1 argument | 2 number | 3 date | 4 time | 5 select | 6 plural | 7 pound | 8 tag
            if (el.type === 0 || el.type === 7) continue;
            if (el.type === 8) names.add(`<${el.value}>`);
            else names.add(el.value);
            if ("options" in el) Object.values(el.options).forEach(o => walk(o.value));
            if (el.type === 8) walk(el.children);
        }
    };
    walk(new IntlMessageFormat(message, "en").getAst());
    return [...names].sort();
}

const flat = { en: flatten(en), th: flatten(th) };

describe("message catalogs", () => {
    it("has one catalog per supported locale", () => {
        expect(Object.keys(catalogs).sort()).toEqual([...locales].sort());
    });

    it("th has exactly the same keys as en (nothing missing, nothing stale)", () => {
        expect(Object.keys(flat.th).sort()).toEqual(Object.keys(flat.en).sort());
    });

    it("every message is a non-empty, parseable ICU message", () => {
        for (const locale of locales) {
            for (const [key, message] of Object.entries(flat[locale])) {
                expect(message.trim(), `${locale}:${key} is empty`).not.toBe("");
                expect(() => new IntlMessageFormat(message, locale), `${locale}:${key} is invalid ICU`).not.toThrow();
            }
        }
    });

    it("th uses the same placeholders and tags as en for every key", () => {
        for (const key of Object.keys(flat.en)) {
            expect(placeholders(flat.th[key]), `placeholder mismatch in "${key}"`).toEqual(placeholders(flat.en[key]));
        }
    });
});

describe("negotiateLocale", () => {
    it("honours the highest-weighted supported language", () => {
        expect(negotiateLocale("th-TH,th;q=0.9,en;q=0.8")).toBe("th");
        expect(negotiateLocale("en-US,en;q=0.9,th;q=0.8")).toBe("en");
        expect(negotiateLocale("fr-FR,th;q=0.5")).toBe("th");
    });

    it("falls back to the default for unsupported, empty or malformed headers", () => {
        expect(negotiateLocale("fr-FR,de;q=0.8")).toBe("en");
        expect(negotiateLocale("")).toBe("en");
        expect(negotiateLocale(null)).toBe("en");
        expect(negotiateLocale("th;q=0")).toBe("en");
        expect(negotiateLocale(";;;,,q=x")).toBe("en");
    });
});
