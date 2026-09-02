"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import {
  createChart,
  createTextWatermark,
  ColorType,
  CrosshairMode,
  LineStyle,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type ITextWatermarkPluginApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
  type LogicalRange,
} from "lightweight-charts";
import { useForexStore } from "@/lib/store";
import { TIMEFRAMES, type Candle, type CandleInterval, type InstrumentView } from "@/lib/types";
import { fmtPrice } from "@/lib/format";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import {
  computeSMASeries,
  computeEMASeries,
  computeBollinger,
  computeRSISeries,
  computeMACD,
  ema,
  rsi,
  sma,
} from "@/lib/indicators";

interface Props {
  instrument: InstrumentView;
  onOpenAssets?: () => void;
}

type ChartType = "candles" | "line";
type DisplayOhlc = Candle & { up: boolean };

const TIMEFRAME_STORAGE_KEY = "blckforest:chart-timeframe";
const CHART_TYPE_STORAGE_KEY = "blckforest:chart-type";
const MA_STORAGE_KEY = "blckforest:chart-ma";
const EMA_STORAGE_KEY = "blckforest:chart-ema";
const BB_STORAGE_KEY = "blckforest:chart-bollinger";
const RSI_STORAGE_KEY = "blckforest:chart-rsi";
const MACD_STORAGE_KEY = "blckforest:chart-macd";

function isInterval(value: string | null): value is CandleInterval {
  return value != null && (TIMEFRAMES as readonly string[]).includes(value);
}

/** Theme-dependent chart/series options shared by creation and live restyle.
 *  Theme switches restyle the chart in place via applyOptions — the chart is
 *  never disposed on theme change (disposing mid-paint races lightweight-
 *  charts' render loop and throws "Object is disposed"). */
function chartThemeOptions(dim: boolean) {
  return {
    layout: {
      background: { type: ColorType.Solid, color: dim ? "#0e1116" : "#ffffff" },
      textColor: dim ? "#9aa7b4" : "#6b7280",
    },
    grid: {
      vertLines: { color: dim ? "rgba(42,50,61,0.5)" : "rgba(222,226,230,0.55)" },
      horzLines: { color: dim ? "rgba(42,50,61,0.5)" : "rgba(222,226,230,0.55)" },
    },
    crosshair: {
      vertLine: { color: dim ? "rgba(154,167,180,0.5)" : "rgba(134,142,150,0.65)", labelBackgroundColor: dim ? "#1c232c" : "#343a40" },
      horzLine: { color: dim ? "rgba(154,167,180,0.5)" : "rgba(134,142,150,0.65)", labelBackgroundColor: dim ? "#1c232c" : "#343a40" },
    },
    rightPriceScale: { borderColor: dim ? "#2a323d" : "#dee2e6" },
    timeScale: { borderColor: dim ? "#2a323d" : "#dee2e6" },
  } as const;
}

function candleColors(dim: boolean) {
  const up = dim ? "#4cba6a" : "#2b8a3e";
  const down = dim ? "#f15b5b" : "#e03131";
  return { upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down };
}

function volumeColors(dim: boolean) {
  return {
    up: dim ? "rgba(76,186,106,0.32)" : "rgba(43,138,62,0.32)",
    down: dim ? "rgba(241,91,91,0.30)" : "rgba(224,49,49,0.30)",
  };
}

/** Professional responsive chart with persistent timeframe and trading controls. */
export function ChartPanel({ instrument, onOpenAssets }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const isDim = theme === "dim";
  const panelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const macdLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const watermarkRef = useRef<ITextWatermarkPluginApi<Time> | null>(null);
  const prevCandleCount = useRef(0);
  const candlesRef = useRef<Candle[]>([]);
  const barSpacingRef = useRef(8);
  const userZoomedRef = useRef(false);

  const interval = useForexStore((state) => state.interval);
  const setInterval = useForexStore((state) => state.setInterval);
  const candles = useForexStore((state) => state.candles);
  const quote = useForexStore((state) => state.quote);

  const [chartType, setChartType] = useState<ChartType>("candles");
  const [showMA, setShowMA] = useState(false);
  const [showEMA, setShowEMA] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);
  const [maPeriod] = useState(20);
  const [emaPeriod] = useState(20);
  const [bollingerPeriod] = useState(20);
  const [bollingerStdDev] = useState(2);
  const [rsiPeriod] = useState(14);
  const [showIndicators, setShowIndicators] = useState(false);
  const [indicatorPos, setIndicatorPos] = useState({ top: 0, right: 0 });
  const [hoveredOhlc, setHoveredOhlc] = useState<DisplayOhlc | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  /** Toggle indicators menu — uses the clicked button's rect for positioning
   * so it works correctly on both mobile and desktop strips. */
  const toggleIndicators = (e: React.MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    if (!showIndicators && target) {
      const rect = target.getBoundingClientRect();
      setIndicatorPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setShowIndicators((v) => !v);
  };

  candlesRef.current = candles;

  const syncKey = useMemo(
    () => `${instrument.symbol}-${interval}-${chartType}`,
    [instrument.symbol, interval, chartType],
  );

  useEffect(() => {
    const queryInterval = searchParams.get("tf");
    const storedInterval = window.localStorage.getItem(TIMEFRAME_STORAGE_KEY);
    const preferred = isInterval(queryInterval)
      ? queryInterval
      : isInterval(storedInterval)
        ? storedInterval
        : null;
    if (preferred && preferred !== useForexStore.getState().interval) setInterval(preferred);

    const storedType = window.localStorage.getItem(CHART_TYPE_STORAGE_KEY);
    if (storedType === "candles" || storedType === "line") setChartType(storedType);
    // First visit defaults: EMA 20 + RSI on (TradingView-style starting view).
    // An explicitly stored choice — including "false" — always wins.
    const storedFlag = (key: string, fallback: boolean) => {
      const stored = window.localStorage.getItem(key);
      return stored === null ? fallback : stored === "true";
    };
    setShowMA(storedFlag(MA_STORAGE_KEY, false));
    setShowEMA(storedFlag(EMA_STORAGE_KEY, true));
    setShowBollinger(storedFlag(BB_STORAGE_KEY, false));
    setShowRSI(storedFlag(RSI_STORAGE_KEY, true));
    setShowMACD(storedFlag(MACD_STORAGE_KEY, false));
  }, [searchParams, setInterval]);

  useEffect(() => {
    prevCandleCount.current = 0;
    setHoveredOhlc(null);
  }, [syncKey]);

  useEffect(() => {
    const handleFullscreen = () => setFullscreen(document.fullscreenElement === panelRef.current);
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => document.removeEventListener("fullscreenchange", handleFullscreen);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Theme-dependent pieces are applied via chartThemeOptions/isDim below and
    // kept in sync by the live-restyle effect; isDim is intentionally not a
    // dependency — the chart is only disposed when the chart TYPE changes.
    const dim = isDim;
    const theme = chartThemeOptions(dim);
    const chart = createChart(container, {
      autoSize: true,
      ...theme,
      layout: { ...theme.layout, fontFamily: "inherit", attributionLogo: true },
      crosshair: { ...theme.crosshair, mode: CrosshairMode.Normal },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      kineticScroll: { mouse: true, touch: true },
      rightPriceScale: {
        ...theme.rightPriceScale,
        scaleMargins: { top: 0.08, bottom: 0.24 },
        minimumWidth: 74,
      },
      timeScale: {
        ...theme.timeScale,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 10,
        barSpacing: 8,
        minBarSpacing: 2,
        lockVisibleTimeRangeOnResize: true,
      },
    });

    let priceSeries: ISeriesApi<"Candlestick"> | ISeriesApi<"Line">;
    // Instrument-correct precision: without an explicit priceFormat the chart
    // defaults to 2 decimals, which collapses the right-hand price scale of
    // high-precision instruments (5-digit FX pairs) into identical labels.
    const priceFormat = {
      type: "price" as const,
      precision: instrument.digits,
      minMove: Math.pow(10, -instrument.digits),
    };
    if (chartType === "candles") {
      const series = chart.addSeries(CandlestickSeries, {
        ...candleColors(dim),
        priceLineVisible: true,
        lastValueVisible: true,
        priceFormat,
      });
      seriesRef.current = series;
      lineSeriesRef.current = null;
      priceSeries = series;
    } else {
      const series = chart.addSeries(LineSeries, {
        color: "#f97316",
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
        priceFormat,
      });
      lineSeriesRef.current = series;
      seriesRef.current = null;
      priceSeries = series;
    }

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      priceLineVisible: false,
      lastValueVisible: false,
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    const crosshairHandler = (param: MouseEventParams) => {
      const point = param.seriesData.get(priceSeries);
      if (!point) {
        setHoveredOhlc(null);
        return;
      }
      const time = Number(param.time ?? 0);
      const candle = candlesRef.current.find((item) => item.time === time);
      if (!candle) {
        setHoveredOhlc(null);
        return;
      }
      setHoveredOhlc({ ...candle, up: candle.close >= candle.open });
    };
    chart.subscribeCrosshairMove(crosshairHandler);
    chartRef.current = chart;

    return () => {
      chart.unsubscribeCrosshairMove(crosshairHandler);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      lineSeriesRef.current = null;
      maSeriesRef.current = null;
      volumeSeriesRef.current = null;
      // All indicator series belonged to the removed chart — drop their refs
      // so nothing can touch a stale series before the indicator effects
      // re-attach (they re-run on chartType changes for exactly this reason).
      emaSeriesRef.current = null;
      bbUpperRef.current = null;
      bbMiddleRef.current = null;
      bbLowerRef.current = null;
      rsiSeriesRef.current = null;
      macdHistRef.current = null;
      macdLineRef.current = null;
      macdSignalRef.current = null;
    };
    // isDim intentionally excluded: theme switches restyle via applyOptions
    // (effect below) instead of disposing the chart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType]);

  // ── Live theme restyle: applyOptions keeps the chart (and the user's zoom
  //     position) intact — no dispose/recreate, no paint race. ─────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const theme = chartThemeOptions(isDim);
    chart.applyOptions({ ...theme, crosshair: { ...theme.crosshair, mode: CrosshairMode.Normal } });
    seriesRef.current?.applyOptions(candleColors(isDim));
    const colors = volumeColors(isDim);
    volumeSeriesRef.current?.setData(
      candlesRef.current.map((candle) => ({
        time: candle.time as UTCTimestamp,
        value: candle.volume,
        color: candle.close >= candle.open ? colors.up : colors.down,
      })),
    );
  }, [isDim]);

  // ── Instrument precision: the price series persists across symbol swaps,
  // so the scale's priceFormat must follow the active instrument's digits
  // (see the creation site for why the default 2 decimals break 5-digit FX).
  useEffect(() => {
    const priceFormat = {
      type: "price" as const,
      precision: instrument.digits,
      minMove: Math.pow(10, -instrument.digits),
    };
    seriesRef.current?.applyOptions({ priceFormat });
    lineSeriesRef.current?.applyOptions({ priceFormat });
  }, [instrument.digits]);

  // ── TradingView-style watermark: faded symbol behind the price action ────
  useEffect(() => {
    const pane = chartRef.current?.panes()[0];
    if (!pane) return;
    // detach() throws "Object is disposed" if the owning chart was already
    // removed (the chart-creation effect's cleanup runs first on theme/chart
    // switches) — the chart teardown destroys the watermark either way.
    const safeDetach = () => {
      try {
        watermarkRef.current?.detach();
      } catch {
        /* chart already disposed — nothing to detach */
      }
      watermarkRef.current = null;
    };
    safeDetach();
    watermarkRef.current = createTextWatermark(pane, {
      horzAlign: "center",
      vertAlign: "center",
      lines: [
        {
          text: instrument.symbol,
          color: isDim ? "rgba(154,167,180,0.09)" : "rgba(107,114,128,0.10)",
          fontSize: 44,
          fontStyle: "700",
        },
        {
          text: `${instrument.name} · ${interval}`,
          color: isDim ? "rgba(154,167,180,0.07)" : "rgba(107,114,128,0.08)",
          fontSize: 15,
        },
      ],
    });
    return safeDetach;
  }, [instrument.symbol, instrument.name, interval, isDim, chartType]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (!showMA) {
      if (maSeriesRef.current) chart.removeSeries(maSeriesRef.current);
      maSeriesRef.current = null;
      return;
    }

    const movingAverage = chart.addSeries(LineSeries, {
      color: "#2563eb",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    maSeriesRef.current = movingAverage;
    const currentCandles = useForexStore.getState().candles;
    if (currentCandles.length >= maPeriod) movingAverage.setData(computeSMA(currentCandles, maPeriod));

    return () => {
      if (maSeriesRef.current === movingAverage && chartRef.current === chart) {
        chart.removeSeries(movingAverage);
        maSeriesRef.current = null;
      }
    };
  }, [showMA, chartType, maPeriod]);

  // ── EMA overlay (pane 0) ────────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (!showEMA) {
      if (emaSeriesRef.current) chart.removeSeries(emaSeriesRef.current);
      emaSeriesRef.current = null;
      return;
    }
    const s = chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
    emaSeriesRef.current = s;
    const c = useForexStore.getState().candles as Candle[];
    if (c.length >= emaPeriod) s.setData(computeEMASeries(c, emaPeriod).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    return () => { if (emaSeriesRef.current === s && chartRef.current === chart) { chart.removeSeries(s); emaSeriesRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEMA, chartType, emaPeriod]);

  // ── Bollinger Bands overlay (pane 0) ────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (!showBollinger) {
      [bbUpperRef, bbMiddleRef, bbLowerRef].forEach((r) => { if (r.current) chart.removeSeries(r.current); r.current = null; });
      return;
    }
    const mk = (color: string, width: 1 | 2) => chart.addSeries(LineSeries, { color, lineWidth: width, priceLineVisible: false, lastValueVisible: false });
    const upper = mk("rgba(100,116,139,0.6)", 1); bbUpperRef.current = upper;
    const middle = mk("#6366f1", 2); bbMiddleRef.current = middle;
    const lower = mk("rgba(100,116,139,0.6)", 1); bbLowerRef.current = lower;
    const c = useForexStore.getState().candles as Candle[];
    if (c.length >= bollingerPeriod) {
      const bb = computeBollinger(c, bollingerPeriod, bollingerStdDev);
      upper.setData(bb.map((p) => ({ time: p.time as UTCTimestamp, value: p.upper })));
      middle.setData(bb.map((p) => ({ time: p.time as UTCTimestamp, value: p.middle })));
      lower.setData(bb.map((p) => ({ time: p.time as UTCTimestamp, value: p.lower })));
    }
    return () => {
      [upper, middle, lower].forEach((s) => { try { chart.removeSeries(s); } catch { /* already removed */ } });
      if (bbUpperRef.current === upper) bbUpperRef.current = null;
      if (bbMiddleRef.current === middle) bbMiddleRef.current = null;
      if (bbLowerRef.current === lower) bbLowerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBollinger, chartType, bollingerPeriod, bollingerStdDev]);

  // ── RSI oscillator (pane 1) ─────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (!showRSI) {
      if (rsiSeriesRef.current) chart.removeSeries(rsiSeriesRef.current);
      rsiSeriesRef.current = null;
      return;
    }
    const s = chart.addSeries(LineSeries, { color: "#7c3aed", lineWidth: 2, priceLineVisible: false, lastValueVisible: true }, 1);
    rsiSeriesRef.current = s;
    s.createPriceLine({ price: 70, color: "rgba(220,38,38,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "70" });
    s.createPriceLine({ price: 30, color: "rgba(22,128,59,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "30" });
    const c = useForexStore.getState().candles as Candle[];
    if (c.length > rsiPeriod) s.setData(computeRSISeries(c, rsiPeriod).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    return () => { if (rsiSeriesRef.current === s && chartRef.current === chart) { chart.removeSeries(s); rsiSeriesRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRSI, chartType, rsiPeriod]);

  // ── MACD oscillator (pane 2) ────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (!showMACD) {
      [macdHistRef, macdLineRef, macdSignalRef].forEach((r) => { if (r.current) chart.removeSeries(r.current); r.current = null; });
      return;
    }
    const paneIndex = showRSI ? 2 : 1;
    const hist = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, paneIndex);
    const line = chart.addSeries(LineSeries, { color: "#2563eb", lineWidth: 2, priceLineVisible: false, lastValueVisible: true }, paneIndex);
    const signal = chart.addSeries(LineSeries, { color: "#dc2626", lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, paneIndex);
    macdHistRef.current = hist; macdLineRef.current = line; macdSignalRef.current = signal;
    const c = useForexStore.getState().candles as Candle[];
    if (c.length >= 35) {
      const macd = computeMACD(c);
      hist.setData(macd.map((p) => ({ time: p.time as UTCTimestamp, value: p.histogram, color: p.histogram >= 0 ? "rgba(22,128,59,0.5)" : "rgba(220,38,38,0.5)" })));
      line.setData(macd.map((p) => ({ time: p.time as UTCTimestamp, value: p.macd })));
      signal.setData(macd.map((p) => ({ time: p.time as UTCTimestamp, value: p.signal })));
    }
    return () => {
      [hist, line, signal].forEach((s) => { try { chart.removeSeries(s); } catch { /* already removed */ } });
      if (macdHistRef.current === hist) macdHistRef.current = null;
      if (macdLineRef.current === line) macdLineRef.current = null;
      if (macdSignalRef.current === signal) macdSignalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMACD, showRSI, chartType]);

  const candleCount = candles.length;
  useEffect(() => {
    const series = chartType === "candles" ? seriesRef.current : lineSeriesRef.current;
    if (!series || candleCount === 0) return;
    prevCandleCount.current = candleCount;

    // Save the user's visible range before setData() — setData() resets the
    // scroll/zoom position. We restore it after if the user has manually zoomed.
    let savedRange: LogicalRange | null = null;
    if (userZoomedRef.current) {
      savedRange = chartRef.current?.timeScale().getVisibleLogicalRange() ?? null;
    }

    const upColor = isDim ? "rgba(76,186,106,0.32)" : "rgba(43,138,62,0.32)";
    const downColor = isDim ? "rgba(241,91,91,0.30)" : "rgba(224,49,49,0.30)";

    if (chartType === "candles") {
      seriesRef.current?.setData(
        candles.map((candle) => ({
          time: candle.time as UTCTimestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        })),
      );
    } else {
      lineSeriesRef.current?.setData(
        candles.map((candle) => ({ time: candle.time as UTCTimestamp, value: candle.close })),
      );
    }

    volumeSeriesRef.current?.setData(
      candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        value: candle.volume,
        color: candle.close >= candle.open ? upColor : downColor,
      })),
    );
    if (maSeriesRef.current && candleCount >= maPeriod) {
      maSeriesRef.current.setData(computeSMASeries(candles, maPeriod).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    }
    if (emaSeriesRef.current && candleCount >= emaPeriod) {
      emaSeriesRef.current.setData(computeEMASeries(candles, emaPeriod).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    }
    if (bbUpperRef.current && bbMiddleRef.current && bbLowerRef.current && candleCount >= bollingerPeriod) {
      const bb = computeBollinger(candles, bollingerPeriod, bollingerStdDev);
      bbUpperRef.current.setData(bb.map((p) => ({ time: p.time as UTCTimestamp, value: p.upper })));
      bbMiddleRef.current.setData(bb.map((p) => ({ time: p.time as UTCTimestamp, value: p.middle })));
      bbLowerRef.current.setData(bb.map((p) => ({ time: p.time as UTCTimestamp, value: p.lower })));
    }
    if (rsiSeriesRef.current && candleCount > rsiPeriod) {
      rsiSeriesRef.current.setData(computeRSISeries(candles, rsiPeriod).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    }
    if (macdHistRef.current && macdLineRef.current && macdSignalRef.current && candleCount >= 35) {
      const macd = computeMACD(candles);
      macdHistRef.current.setData(macd.map((p) => ({ time: p.time as UTCTimestamp, value: p.histogram, color: p.histogram >= 0 ? upColor : downColor })));
      macdLineRef.current.setData(macd.map((p) => ({ time: p.time as UTCTimestamp, value: p.macd })));
      macdSignalRef.current.setData(macd.map((p) => ({ time: p.time as UTCTimestamp, value: p.signal })));
    }
    // Only auto-fit when the user hasn't manually zoomed. If they have zoomed,
    // restore their saved visible range (setData resets it).
    if (!userZoomedRef.current) {
      chartRef.current?.timeScale().fitContent();
    } else if (savedRange) {
      chartRef.current?.timeScale().setVisibleLogicalRange(savedRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey, candleCount, candles, chartType, maPeriod]);

  useEffect(() => {
    if (candles.length === 0) return;
    const last = candles[candles.length - 1];
    if (chartType === "candles") {
      seriesRef.current?.update({
        time: last.time as UTCTimestamp,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      });
    } else {
      lineSeriesRef.current?.update({ time: last.time as UTCTimestamp, value: last.close });
    }
    volumeSeriesRef.current?.update({
      time: last.time as UTCTimestamp,
      value: last.volume,
      color: last.close >= last.open ? "rgba(22,128,59,0.32)" : "rgba(220,38,38,0.30)",
    });
    if (maSeriesRef.current && candles.length >= maPeriod) {
      const window = candles.slice(-maPeriod);
      const value = window.reduce((sum, candle) => sum + candle.close, 0) / maPeriod;
      maSeriesRef.current.update({ time: last.time as UTCTimestamp, value });
    }
    // Live update for EMA
    if (emaSeriesRef.current && candles.length >= emaPeriod) {
      const emaData = computeEMASeries(candles, emaPeriod);
      const lastEMA = emaData[emaData.length - 1];
      if (lastEMA) emaSeriesRef.current.update({ time: lastEMA.time as UTCTimestamp, value: lastEMA.value });
    }
    // Live update for Bollinger
    if (bbUpperRef.current && bbMiddleRef.current && bbLowerRef.current && candles.length >= bollingerPeriod) {
      const bb = computeBollinger(candles, bollingerPeriod, bollingerStdDev);
      const lastBB = bb[bb.length - 1];
      if (lastBB) {
        bbUpperRef.current.update({ time: lastBB.time as UTCTimestamp, value: lastBB.upper });
        bbMiddleRef.current.update({ time: lastBB.time as UTCTimestamp, value: lastBB.middle });
        bbLowerRef.current.update({ time: lastBB.time as UTCTimestamp, value: lastBB.lower });
      }
    }
    // Live update for RSI
    if (rsiSeriesRef.current && candles.length > rsiPeriod) {
      const rsiData = computeRSISeries(candles, rsiPeriod);
      const lastRSI = rsiData[rsiData.length - 1];
      if (lastRSI) rsiSeriesRef.current.update({ time: lastRSI.time as UTCTimestamp, value: lastRSI.value });
    }
    // Live update for MACD
    if (macdLineRef.current && macdHistRef.current && macdSignalRef.current && candles.length >= 35) {
      const macdData = computeMACD(candles);
      const lastMACD = macdData[macdData.length - 1];
      if (lastMACD) {
        macdHistRef.current.update({ time: lastMACD.time as UTCTimestamp, value: lastMACD.histogram, color: lastMACD.histogram >= 0 ? "rgba(22,128,59,0.5)" : "rgba(220,38,38,0.5)" });
        macdLineRef.current.update({ time: lastMACD.time as UTCTimestamp, value: lastMACD.macd });
        macdSignalRef.current.update({ time: lastMACD.time as UTCTimestamp, value: lastMACD.signal });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, chartType, maPeriod]);

  const latestOhlc = useMemo<DisplayOhlc | null>(() => {
    const last = candles[candles.length - 1];
    if (!last) return null;
    const live = quote?.mid ?? last.close;
    return { ...last, close: live, up: live >= last.open };
  }, [candles, quote]);
  const ohlc = hoveredOhlc ?? latestOhlc;

  const selectTimeframe = useCallback(
    (next: CandleInterval) => {
      if (next === interval) return;
      window.localStorage.setItem(TIMEFRAME_STORAGE_KEY, next);
      setInterval(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tf", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [interval, pathname, router, searchParams, setInterval],
  );

  const selectChartType = (next: ChartType) => {
    setChartType(next);
    window.localStorage.setItem(CHART_TYPE_STORAGE_KEY, next);
  };

  const toggleMA = () => { setShowMA((v) => { const n = !v; window.localStorage.setItem(MA_STORAGE_KEY, String(n)); return n; }); setShowIndicators(false); };
  const toggleEMA = () => { setShowEMA((v) => { const n = !v; window.localStorage.setItem(EMA_STORAGE_KEY, String(n)); return n; }); setShowIndicators(false); };
  const toggleBollinger = () => { setShowBollinger((v) => { const n = !v; window.localStorage.setItem(BB_STORAGE_KEY, String(n)); return n; }); setShowIndicators(false); };
  const toggleRSI = () => { setShowRSI((v) => { const n = !v; window.localStorage.setItem(RSI_STORAGE_KEY, String(n)); return n; }); setShowIndicators(false); };
  const toggleMACD = () => { setShowMACD((v) => { const n = !v; window.localStorage.setItem(MACD_STORAGE_KEY, String(n)); return n; }); setShowIndicators(false); };

  const zoom = (direction: "in" | "out") => {
    const scale = chartRef.current?.timeScale();
    if (!scale) return;
    userZoomedRef.current = true;
    const multiplier = direction === "in" ? 1.25 : 0.8;
    barSpacingRef.current = Math.min(40, Math.max(2, barSpacingRef.current * multiplier));
    scale.applyOptions({ barSpacing: barSpacingRef.current });
  };

  const fitChart = () => {
    userZoomedRef.current = false;
    barSpacingRef.current = 8;
    chartRef.current?.timeScale().fitContent();
  };

  const toggleFullscreen = async () => {
    const panel = panelRef.current;
    if (!panel) return;
    if (document.fullscreenElement === panel) await document.exitFullscreen();
    else await panel.requestFullscreen();
  };

  // Active-indicator legend (TradingView-style): live value + remove handle.
  const legendChips: Array<{ color: string; label: string; value: string | null; onRemove: () => void }> = [];
  if (showMA) {
    const value = sma(candles, maPeriod);
    legendChips.push({ color: "#2563eb", label: `SMA ${maPeriod}`, value: value != null ? fmtPrice(value, instrument.digits) : null, onRemove: toggleMA });
  }
  if (showEMA) {
    const value = ema(candles, emaPeriod);
    legendChips.push({ color: "#f97316", label: `EMA ${emaPeriod}`, value: value != null ? fmtPrice(value, instrument.digits) : null, onRemove: toggleEMA });
  }
  if (showBollinger) {
    const bands = computeBollinger(candles, bollingerPeriod, bollingerStdDev);
    const last = bands[bands.length - 1];
    legendChips.push({ color: "#6366f1", label: `BB (${bollingerPeriod}, ${bollingerStdDev}σ)`, value: last ? fmtPrice(last.middle, instrument.digits) : null, onRemove: toggleBollinger });
  }
  if (showRSI) {
    const value = rsi(candles, rsiPeriod);
    legendChips.push({ color: "#7c3aed", label: `RSI ${rsiPeriod}`, value: value != null ? value.toFixed(1) : null, onRemove: toggleRSI });
  }
  if (showMACD) {
    const macd = computeMACD(candles);
    const last = macd[macd.length - 1];
    legendChips.push({ color: "#2563eb", label: "MACD (12, 26, 9)", value: last ? last.macd.toFixed(instrument.digits) : null, onRemove: toggleMACD });
  }

  return (
    <div
      ref={panelRef}
      data-testid="professional-chart-panel"
      className={`flex h-full min-h-112 flex-col overflow-hidden border border-border bg-canvas shadow-panel lg:min-h-0 ${fullscreen ? "rounded-none" : "rounded-md"}`}
    >
      <div className="flex shrink-0 flex-col border-b border-border bg-panel-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-2 px-3 py-2 sm:py-0">
          <InstrumentIcon symbol={instrument.symbol} size={20} />
          <span className="text-sm font-bold tracking-tight">{instrument.symbol}</span>
          <span className="text-[10px] font-medium text-text-faint">{instrument.name}</span>
          <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[9px] font-medium uppercase text-brand">
            {instrument.category}
          </span>
          {/* Live price + session change — the TradingView-style anchor the eye
              goes to first. Color follows the live tick direction. */}
          {latestOhlc && (
            <span className="flex items-baseline gap-1.5">
              <span className={`text-base font-bold tnum leading-none ${latestOhlc.up ? "text-up" : "text-down"}`}>
                {fmtPrice(latestOhlc.close, instrument.digits)}
              </span>
              {instrument.changePct !== 0 && (
                <span className={`text-[10px] font-semibold tnum leading-none ${instrument.changePct > 0 ? "text-up" : "text-down"}`}>
                  {instrument.changePct > 0 ? "▲" : "▼"} {Math.abs(instrument.changePct).toFixed(2)}%
                </span>
              )}
            </span>
          )}
          {onOpenAssets ? (
            <button
              type="button"
              onClick={onOpenAssets}
              className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px] text-text-muted transition-colors hover:bg-panel-3 hover:text-text"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg> 
              <span className="text-[10px] font-semibold">Asset</span>
            </button>
          ) : null}
          {ohlc ? (
            <div className="hidden min-w-0 items-center gap-2 text-[10px] tnum md:flex">
              <OhlcField label="O" value={ohlc.open} up={ohlc.up} digits={instrument.digits} />
              <OhlcField label="H" value={ohlc.high} up={ohlc.up} digits={instrument.digits} />
              <OhlcField label="L" value={ohlc.low} up={ohlc.up} digits={instrument.digits} />
              <OhlcField label="C" value={ohlc.close} up={ohlc.up} digits={instrument.digits} />
              <span className="text-text-faint">Vol {Math.round(ohlc.volume).toLocaleString("en-US")}</span>
            </div>
          ) : null}
        </div>

        {/* Mobile: timeframes get priority row; desktop: all controls inline */}
        <div className="flex items-center gap-1 overflow-x-auto border-t border-border px-2 py-1.5 sm:hidden [scrollbar:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {TIMEFRAMES.map((timeframe) => (
            <button
              key={timeframe}
              type="button"
              aria-pressed={interval === timeframe}
              aria-label={`Use ${timeframe} timeframe`}
              onClick={() => selectTimeframe(timeframe)}
              className={`shrink-0 rounded px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                interval === timeframe ? "bg-brand text-white" : "text-text-muted hover:bg-panel-3 hover:text-text"
              }`}
            >
              {timeframe}
            </button>
          ))}
          <div className="mx-1 h-4 w-px shrink-0 bg-border" />
          <ChartButton label="Candlestick chart" active={chartType === "candles"} onClick={() => selectChartType("candles")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M7 4v3M7 17v3M7 7v10" strokeLinecap="round" />
              <rect x="5" y="7" width="4" height="10" rx="1" fill="currentColor" stroke="none" />
              <path d="M17 6v2M17 19v2M17 8v11" strokeLinecap="round" />
              <rect x="15" y="8" width="4" height="11" rx="1" />
            </svg>
          </ChartButton>
          <ChartButton label="Line chart" active={chartType === "line"} onClick={() => selectChartType("line")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 17l5-6 4 3 7-9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ChartButton>
          <ChartButton
            label="Chart indicators"
            active={showMA || showEMA || showBollinger || showRSI || showMACD}
            onClick={toggleIndicators}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 16c3 0 4-8 7-8s4 8 7 8 2-4 2-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ChartButton>
          <ChartButton label="Zoom in" onClick={() => zoom("in")}>＋</ChartButton>
          <ChartButton label="Zoom out" onClick={() => zoom("out")}>−</ChartButton>
          <ChartButton label="Fit all candles" onClick={() => fitChart()}>Fit</ChartButton>
          <ChartButton label={fullscreen ? "Exit full screen" : "Full screen"} active={fullscreen} onClick={() => void toggleFullscreen()}>
            {fullscreen ? "Exit" : "Full"}
          </ChartButton>
        </div>

        {/* Desktop: all controls inline (chart-type, indicators, zoom, fit, fullscreen, timeframes) */}
        <div className="hidden min-w-0 items-center gap-1 overflow-x-auto border-t border-border px-2 py-1.5 sm:ml-auto sm:flex sm:border-l sm:border-t-0">
          <ChartButton label="Candlestick chart" active={chartType === "candles"} onClick={() => selectChartType("candles")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M7 4v3M7 17v3M7 7v10" strokeLinecap="round" />
              <rect x="5" y="7" width="4" height="10" rx="1" fill="currentColor" stroke="none" />
              <path d="M17 6v2M17 19v2M17 8v11" strokeLinecap="round" />
              <rect x="15" y="8" width="4" height="11" rx="1" />
            </svg>
          </ChartButton>
          <ChartButton label="Line chart" active={chartType === "line"} onClick={() => selectChartType("line")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 17l5-6 4 3 7-9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ChartButton>
          <ChartButton
            label="Chart indicators"
            active={showMA || showEMA || showBollinger || showRSI || showMACD}
            onClick={toggleIndicators}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 16c3 0 4-8 7-8s4 8 7 8 2-4 2-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ChartButton>
          <ChartButton label="Zoom in" onClick={() => zoom("in")}>＋</ChartButton>
          <ChartButton label="Zoom out" onClick={() => zoom("out")}>−</ChartButton>
          <ChartButton label="Fit all candles" onClick={() => fitChart()}>Fit</ChartButton>
          <ChartButton label={fullscreen ? "Exit full screen" : "Full screen"} active={fullscreen} onClick={() => void toggleFullscreen()}>
            {fullscreen ? "Exit" : "Full"}
          </ChartButton>
          <div className="mx-1 h-4 w-px shrink-0 bg-border" />
          {TIMEFRAMES.map((timeframe) => (
            <button
              key={timeframe}
              type="button"
              aria-pressed={interval === timeframe}
              aria-label={`Use ${timeframe} timeframe`}
              onClick={() => selectTimeframe(timeframe)}
              className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold transition-colors ${
                interval === timeframe ? "bg-brand text-white" : "text-text-muted hover:bg-panel-3 hover:text-text"
              }`}
            >
              {timeframe}
            </button>
          ))}
        </div>
      </div>

      {ohlc ? (
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border-soft px-3 py-1 text-[10px] tnum md:hidden">
          <OhlcField label="O" value={ohlc.open} up={ohlc.up} digits={instrument.digits} />
          <OhlcField label="H" value={ohlc.high} up={ohlc.up} digits={instrument.digits} />
          <OhlcField label="L" value={ohlc.low} up={ohlc.up} digits={instrument.digits} />
          <OhlcField label="C" value={ohlc.close} up={ohlc.up} digits={instrument.digits} />
        </div>
      ) : null}

      <div className="relative min-h-112 flex-1 lg:min-h-0">
        <div ref={containerRef} data-testid="professional-chart-canvas" className="h-full w-full touch-none" />
        {/* Empty-canvas state: while the subscription/history loads (or the
            feed is down — the status banner names that cause) the panel would
            otherwise render blank toolbars over nothing. */}
        {candles.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" role="status" aria-live="polite">
            <div className="flex items-center gap-2 rounded border border-border bg-canvas/90 px-3 py-2 text-xs text-text-muted shadow-card">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
              Loading price history…
            </div>
          </div>
        )}
        {legendChips.length > 0 && (
          <div className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap gap-1">
            {legendChips.map((chip) => (
              <LegendChip key={chip.label} color={chip.color} label={chip.label} value={chip.value} onRemove={chip.onRemove} />
            ))}
          </div>
        )}
      </div>

      {/* Indicators portal — standalone (not nested in either control strip).
          Position is set by toggleIndicators() from whichever button was clicked. */}
      {showIndicators && typeof document !== "undefined" && createPortal(
        <>
          <button type="button" className="fixed inset-0 z-9998 cursor-default" aria-label="Close indicators menu" onClick={() => setShowIndicators(false)} />
          <div className="fixed z-9999 min-w-48 rounded border border-border bg-canvas py-1 shadow-xl" style={{ top: indicatorPos.top, right: indicatorPos.right }}>
            <div className="px-3 pb-1 pt-1.5 text-[9px] font-semibold uppercase tracking-wide text-text-faint">Overlays</div>
            <button type="button" role="menuitemcheckbox" aria-checked={showMA} onClick={toggleMA} className="flex w-full items-center justify-between px-3 py-2 text-[11px] hover:bg-panel-2">
              <span>SMA ({maPeriod})</span>
              <span className={`h-3 w-3 rounded border ${showMA ? "border-brand bg-brand" : "border-border"}`} />
            </button>
            <button type="button" role="menuitemcheckbox" aria-checked={showEMA} onClick={toggleEMA} className="flex w-full items-center justify-between px-3 py-2 text-[11px] hover:bg-panel-2">
              <span>EMA ({emaPeriod})</span>
              <span className={`h-3 w-3 rounded border ${showEMA ? "border-brand bg-brand" : "border-border"}`} />
            </button>
            <button type="button" role="menuitemcheckbox" aria-checked={showBollinger} onClick={toggleBollinger} className="flex w-full items-center justify-between px-3 py-2 text-[11px] hover:bg-panel-2">
              <span>Bollinger ({bollingerPeriod}, {bollingerStdDev}σ)</span>
              <span className={`h-3 w-3 rounded border ${showBollinger ? "border-brand bg-brand" : "border-border"}`} />
            </button>
            <div className="mx-3 my-1 border-t border-border-soft" />
            <div className="px-3 pb-1 pt-1.5 text-[9px] font-semibold uppercase tracking-wide text-text-faint">Oscillators</div>
            <button type="button" role="menuitemcheckbox" aria-checked={showRSI} onClick={toggleRSI} className="flex w-full items-center justify-between px-3 py-2 text-[11px] hover:bg-panel-2">
              <span>RSI ({rsiPeriod})</span>
              <span className={`h-3 w-3 rounded border ${showRSI ? "border-brand bg-brand" : "border-border"}`} />
            </button>
            <button type="button" role="menuitemcheckbox" aria-checked={showMACD} onClick={toggleMACD} className="flex w-full items-center justify-between px-3 py-2 text-[11px] hover:bg-panel-2">
              <span>MACD (12, 26, 9)</span>
              <span className={`h-3 w-3 rounded border ${showMACD ? "border-brand bg-brand" : "border-border"}`} />
            </button>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

function ChartButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      onClick={onClick}
      className={`shrink-0 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
        active ? "bg-brand-soft text-brand" : "text-text-muted hover:bg-panel-3 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

/** TradingView-style active-indicator chip: series color dot, live value,
 *  and a remove (✕) handle that detaches the indicator from the chart. */
function LegendChip({ color, label, value, onRemove }: { color: string; label: string; value: string | null; onRemove: () => void }) {
  return (
    <span className="pointer-events-auto flex items-center gap-1.5 rounded border border-border-soft bg-canvas/85 px-1.5 py-0.5 text-[10px] tnum shadow-sm backdrop-blur-sm">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-medium text-text-muted">{label}</span>
      {value != null && <span className="text-text">{value}</span>}
      <button
        type="button"
        aria-label={`Remove ${label} indicator`}
        onClick={onRemove}
        className="rounded p-1 text-[9px] leading-none text-text-faint transition-colors hover:bg-down/10 hover:text-down"
      >
        {xIcon()}
      </button>
    </span>
  );
}

function OhlcField({ label, value, up, digits }: { label: string; value: number; up: boolean; digits: number }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-text-faint">{label} </span>
      <span className={up ? "text-up" : "text-down"}>{fmtPrice(value, digits)}</span>
    </span>
  );
}

/** O(n) rolling simple moving average over N candles. */
function computeSMA(candles: Candle[], period: number): { time: UTCTimestamp; value: number }[] {
  if (!Number.isInteger(period) || period <= 0 || candles.length < period) return [];
  const result: { time: UTCTimestamp; value: number }[] = [];
  let sum = 0;
  for (let index = 0; index < candles.length; index += 1) {
    sum += candles[index].close;
    if (index >= period) sum -= candles[index - period].close;
    if (index >= period - 1) {
      result.push({ time: candles[index].time as UTCTimestamp, value: sum / period });
    }
  }
  return result;
}

function xIcon (){
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}