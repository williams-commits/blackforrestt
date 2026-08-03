"use client";

import { useState } from "react";
import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";

interface Instrument {
  symbol: string;
  name: string;
  digits: number;
  pipSize: number;
  pipValue: number;
  marginPerLot: number;
  contractSize: number;
}

// Mirrors the seeded instruments (kept here so the page is static-friendly).
const INSTRUMENTS: Instrument[] = [
  { symbol: "AUDCAD", name: "Australian Dollar / Canadian Dollar", digits: 5, pipSize: 0.0001, pipValue: 7.4, marginPerLot: 1000, contractSize: 100000 },
  { symbol: "EURUSD", name: "Euro / US Dollar", digits: 5, pipSize: 0.0001, pipValue: 10, marginPerLot: 1000, contractSize: 100000 },
  { symbol: "GBPUSD", name: "British Pound / US Dollar", digits: 5, pipSize: 0.0001, pipValue: 10, marginPerLot: 1000, contractSize: 100000 },
  { symbol: "USDJPY", name: "US Dollar / Japanese Yen", digits: 3, pipSize: 0.01, pipValue: 9.1, marginPerLot: 1000, contractSize: 100000 },
  { symbol: "AUDUSD", name: "Australian Dollar / US Dollar", digits: 5, pipSize: 0.0001, pipValue: 10, marginPerLot: 1000, contractSize: 100000 },
  { symbol: "USDCAD", name: "US Dollar / Canadian Dollar", digits: 5, pipSize: 0.0001, pipValue: 7.4, marginPerLot: 1000, contractSize: 100000 },
  { symbol: "NZDUSD", name: "New Zealand Dollar / US Dollar", digits: 5, pipSize: 0.0001, pipValue: 10, marginPerLot: 1000, contractSize: 100000 },
  { symbol: "EURGBP", name: "Euro / British Pound", digits: 5, pipSize: 0.0001, pipValue: 12.7, marginPerLot: 1000, contractSize: 100000 },
];

type Calc = "pip" | "margin" | "profit";

export default function CalculatorsPage() {
  const [calc, setCalc] = useState<Calc>("pip");
  const [symbol, setSymbol] = useState("EURUSD");
  const [volume, setVolume] = useState("0.10");
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");

  const inst = INSTRUMENTS.find((i) => i.symbol === symbol)!;
  const vol = Number(volume) || 0;

  const pipValue = vol * inst.pipValue;
  const margin = vol * inst.marginPerLot;

  let profit = 0;
  let pips = 0;
  if (entry && exit) {
    const e = Number(entry);
    const x = Number(exit);
    if (e > 0 && x > 0) {
      pips = (x - e) / inst.pipSize;
      profit = pips * inst.pipValue * vol;
    }
  }

  return (
    <ArticleLayout
      eyebrow="Tools"
      title="Trading Calculators"
      description="Plan your trades precisely. Calculate pip value, margin requirements, and potential profit before you risk a cent."
    >
      <Section>
        <div className="grid grid-cols-3 gap-1 bg-panel-2 border border-border rounded-lg p-1 text-sm w-full max-w-md">
          {([["pip", "Pip Value"], ["margin", "Margin"], ["profit", "Profit / Loss"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setCalc(k)}
              className={`py-2 rounded-md font-medium transition ${calc === k ? "bg-brand text-white" : "text-text-muted hover:text-text"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      {/* Calculator card */}
      <div className="bg-canvas border border-border rounded-xl p-6 shadow-card max-w-2xl">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Instrument">
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full h-10 bg-canvas border border-border rounded px-2 text-sm outline-none focus:border-brand"
            >
              {INSTRUMENTS.map((i) => (
                <option key={i.symbol} value={i.symbol}>{i.symbol} — {i.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Volume (lots)">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              className="w-full h-10 bg-canvas border border-border rounded px-3 text-sm tnum outline-none focus:border-brand"
            />
          </Field>

          {calc === "profit" && (
            <>
              <Field label="Entry price">
                <input
                  type="number"
                  step={inst.pipSize}
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                  placeholder="0.00000"
                  className="w-full h-10 bg-canvas border border-border rounded px-3 text-sm tnum outline-none focus:border-brand placeholder:text-text-faint"
                />
              </Field>
              <Field label="Exit price">
                <input
                  type="number"
                  step={inst.pipSize}
                  value={exit}
                  onChange={(e) => setExit(e.target.value)}
                  placeholder="0.00000"
                  className="w-full h-10 bg-canvas border border-border rounded px-3 text-sm tnum outline-none focus:border-brand placeholder:text-text-faint"
                />
              </Field>
            </>
          )}
        </div>

        {/* Results */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {calc === "pip" && (
            <>
              <Result label="Pip Value" value={`$${pipValue.toFixed(2)}`} highlight />
              <Result label="Pip Size" value={inst.pipSize.toString()} />
              <Result label="Contract Size" value={inst.contractSize.toLocaleString()} />
              <Result label="Units" value={(vol * inst.contractSize).toLocaleString()} />
            </>
          )}
          {calc === "margin" && (
            <>
              <Result label="Required Margin" value={`$${margin.toFixed(2)}`} highlight />
              <Result label="Margin / Lot" value={`$${inst.marginPerLot}`} />
              <Result label="Volume" value={`${vol.toFixed(2)} lots`} />
              <Result label="Notional" value={`$${(vol * inst.contractSize * (Number(entry) || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
            </>
          )}
          {calc === "profit" && (
            <>
              <Result label="Profit / Loss" value={`${profit >= 0 ? "+" : ""}$${profit.toFixed(2)}`} highlight valueClass={profit >= 0 ? "text-up" : "text-down"} />
              <Result label="Pips" value={`${pips >= 0 ? "+" : ""}${pips.toFixed(1)}`} valueClass={pips >= 0 ? "text-up" : "text-down"} />
              <Result label="Pip Value" value={`$${pipValue.toFixed(2)}`} />
              <Result label="Volume" value={`${vol.toFixed(2)} lots`} />
            </>
          )}
        </div>
      </div>

      <Section title="How it works">
        <p>
          <strong>Pip value</strong> is the monetary worth of a one-pip move for your position size. It&apos;s
          calculated as: <code className="text-brand">pip value per lot × volume (lots)</code>. For EURUSD at 0.10 lots, one pip = $1.00.
        </p>
        <p>
          <strong>Margin</strong> is the collateral required to open a position. With 1:100 leverage, one standard
          lot (100,000 units) of EURUSD requires roughly $1,000 in margin.
        </p>
        <p>
          <strong>Profit / Loss</strong> is the difference between your entry and exit, expressed in pips, then
          converted to account currency using the pip value.
        </p>
      </Section>
    </ArticleLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Result({ label, value, highlight = false, valueClass = "" }: { label: string; value: string; highlight?: boolean; valueClass?: string }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-brand-soft border border-brand/30" : "bg-panel border border-border"}`}>
      <div className="text-[11px] text-text-faint uppercase">{label}</div>
      <div className={`text-lg font-bold tnum mt-1 ${valueClass || (highlight ? "text-brand" : "text-text")}`}>{value}</div>
    </div>
  );
}
