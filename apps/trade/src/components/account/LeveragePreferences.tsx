"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gauge, RotateCcw, Save } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/NativeSelect";

interface ClassSetting {
  category: string;
  enabled: boolean;
  default: number | null;
  maximum: number | null;
  preference: number | null;
  selected: number | null;
}

interface AssetSetting {
  symbol: string;
  name: string;
  category: string;
  enabled: boolean;
  default: number | null;
  maximum: number | null;
  preference: number | null;
  selected: number | null;
}

interface SettingsResponse {
  categories: ClassSetting[];
  assets: AssetSetting[];
}

type Notice = { tone: "ok" | "err" | "info"; text: string } | null;

async function responseJson(response: Response): Promise<{ error?: string; categories?: ClassSetting[]; assets?: AssetSetting[] }> {
  try {
    return await response.json() as { error?: string; categories?: ClassSetting[]; assets?: AssetSetting[] };
  } catch {
    return {};
  }
}

export function LeveragePreferences() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [classValues, setClassValues] = useState<Record<string, string>>({});
  const [assetSymbol, setAssetSymbol] = useState("");
  const [assetValue, setAssetValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const enabledAssets = useMemo(
    () => settings?.assets.filter((asset) => asset.enabled) ?? [],
    [settings],
  );
  const selectedAsset = enabledAssets.find((asset) => asset.symbol === assetSymbol) ?? enabledAssets[0];

  const loadSettings = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await fetch("/api/leverage", { cache: "no-store" });
      const data = await responseJson(response);
      if (!response.ok || !data.categories || !data.assets) {
        throw new Error(data.error ?? "Unable to load leverage preferences.");
      }
      setSettings({ categories: data.categories, assets: data.assets });
      setClassValues(Object.fromEntries(data.categories.map((item) => [
        item.category,
        item.preference == null ? "" : String(item.preference),
      ])));
      const firstAsset = data.assets.find((asset) => asset.enabled);
      setAssetSymbol((current) => data.assets?.some((asset) => asset.symbol === current && asset.enabled)
        ? current
        : firstAsset?.symbol ?? "");
      setNotice(null);
      return true;
    } catch (error) {
      setNotice({ tone: "err", text: error instanceof Error ? error.message : "Unable to load leverage preferences." });
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    setAssetValue(selectedAsset?.preference == null ? "" : String(selectedAsset.preference));
  }, [selectedAsset?.symbol, selectedAsset?.preference]);

  async function save(scopeKey: string, value: string, maximum: number | null) {
    setNotice(null);
    const leverage = value.trim() === "" ? null : Number(value);
    if (leverage !== null && (!Number.isFinite(leverage) || leverage < 1 || maximum == null || leverage > maximum)) {
      setNotice({ tone: "err", text: `Enter a leverage between 1x and the configured ${maximum ?? "—"}x maximum.` });
      return;
    }
    setSavingKey(scopeKey);
    try {
      const response = await fetch("/api/leverage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopeKey, leverage }),
      });
      const data = await responseJson(response);
      if (!response.ok) throw new Error(data.error ?? "Unable to save leverage preference.");
      if (await loadSettings()) {
        setNotice({ tone: "ok", text: "Leverage preference saved. It applies to new positions only." });
      }
    } catch (error) {
      setNotice({ tone: "err", text: error instanceof Error ? error.message : "Unable to save leverage preference." });
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge size={16} aria-hidden className="text-muted-foreground" />
          Leverage preferences
        </CardTitle>
        <CardDescription>
          Choose a ratio up to the administrator&apos;s limit for new CFD positions. Unset preferences inherit the configured default; changes never reprice open positions.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        {loading && <p className="text-sm text-muted-foreground">Loading leverage settings…</p>}
        {!loading && settings && (
          <>
            <section className="flex flex-col gap-3" aria-label="Leverage by asset class">
              <h3 className="text-sm font-semibold">Asset-class preferences</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {settings.categories.map((item) => (
                  <div key={item.category} className="flex flex-col gap-3 rounded-xl bg-muted/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{item.category}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.enabled
                            ? `Default ${item.default}x · Maximum ${item.maximum}x · Current ${item.selected}x`
                            : "Leverage policy is not configured."}
                        </p>
                      </div>
                      {item.preference == null && item.enabled && (
                        <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">Inherited</span>
                      )}
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <Label htmlFor={`class-leverage-${item.category}`} className="text-xs text-muted-foreground">
                          Preferred ratio (blank inherits)
                        </Label>
                        <Input
                          id={`class-leverage-${item.category}`}
                          type="number"
                          inputMode="decimal"
                          min={1}
                          max={item.maximum ?? undefined}
                          step="0.01"
                          value={classValues[item.category] ?? ""}
                          onChange={(event) => setClassValues((current) => ({ ...current, [item.category]: event.target.value }))}
                          placeholder={item.default == null ? "Not configured" : String(item.default)}
                          disabled={!item.enabled || savingKey === `class:${item.category}`}
                          startIcon={<Gauge size={13} strokeWidth={2} aria-hidden />}
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!item.enabled || savingKey === `class:${item.category}`}
                        loading={savingKey === `class:${item.category}`}
                        loadingLabel="Saving"
                        onClick={() => void save(`class:${item.category}`, classValues[item.category] ?? "", item.maximum)}
                      >
                        <Save data-icon="inline-start" aria-hidden /> Save
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-3" aria-label="Per-instrument leverage preference">
              <div>
                <h3 className="text-sm font-semibold">Per-instrument override</h3>
                <p className="text-xs text-muted-foreground">Overrides the class preference for one leverage-enabled instrument.</p>
              </div>
              {selectedAsset ? (
                <div className="grid gap-3 rounded-xl bg-muted/30 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                  <div>
                    <Label htmlFor="leverage-asset" className="text-xs text-muted-foreground">Instrument</Label>
                    <NativeSelect
                      id="leverage-asset"
                      value={selectedAsset.symbol}
                      onChange={(event) => setAssetSymbol(event.target.value)}
                      className="mt-1"
                    >
                      {enabledAssets.map((asset) => (
                        <option key={asset.symbol} value={asset.symbol}>{asset.symbol} · {asset.category}</option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div>
                    <Label htmlFor="asset-leverage-value" className="text-xs text-muted-foreground">
                      Preferred ratio (max {selectedAsset.maximum}x)
                    </Label>
                    <Input
                      id="asset-leverage-value"
                      type="number"
                      inputMode="decimal"
                      min={1}
                      max={selectedAsset.maximum ?? undefined}
                      step="0.01"
                      value={assetValue}
                      onChange={(event) => setAssetValue(event.target.value)}
                      placeholder={selectedAsset.default == null ? "" : String(selectedAsset.default)}
                      startIcon={<Gauge size={13} strokeWidth={2} aria-hidden />}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={savingKey === `asset:${selectedAsset.symbol}`}
                      loading={savingKey === `asset:${selectedAsset.symbol}`}
                      loadingLabel="Saving"
                      onClick={() => void save(`asset:${selectedAsset.symbol}`, assetValue, selectedAsset.maximum)}
                    >
                      <Save data-icon="inline-start" aria-hidden /> Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={selectedAsset.preference == null || savingKey === `asset:${selectedAsset.symbol}`}
                      onClick={() => {
                        setAssetValue("");
                        void save(`asset:${selectedAsset.symbol}`, "", selectedAsset.maximum);
                      }}
                      aria-label="Reset instrument preference to class"
                    >
                      <RotateCcw data-icon="inline-start" aria-hidden /> Reset
                    </Button>
                  </div>
                </div>
              ) : (
                <Alert tone="info">
                  No active instruments currently have leverage enabled. Contact an administrator for access.
                </Alert>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
