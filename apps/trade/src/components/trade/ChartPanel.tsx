"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Maximize2,
  Minimize2,
  MoreHorizontal,
  History,
  GripVertical,
  TrendingDown,
  TrendingUp,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import {
  createChart,
  createSeriesMarkers,
  createTextWatermark,
  ColorType,
  CrosshairMode,
  LineStyle,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesMarkersPluginApi,
  type ISeriesApi,
  type ITextWatermarkPluginApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
  type LogicalRange,
} from "lightweight-charts";
import { ChipGroup } from "@/components/ui/ChipGroup";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/Button";
import { useForexStore } from "@/lib/store";
import { TIMEFRAMES, type Candle, type CandleInterval, type InstrumentView } from "@/lib/types";
import { fmtPrice } from "@/lib/format";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import {
  computeATRSeries,
  computeSMASeries,
  computeEMASeries,
  computeBollinger,
  computeRSISeries,
  computeMACD,
  computeStochasticSeries,
  computeVWAPSeries,
  ema,
  rsi,
  sma,
} from "@/lib/indicators";
import { isExecutableQuote } from "@/lib/marketFreshness";
import {
  CHART_HISTORY_DAYS,
  CHART_HISTORY_WINDOW_SECONDS,
  MAX_CHART_HISTORY_CANDLES,
} from "@/lib/chartHistory";

interface Props {
  instrument: InstrumentView;
  marketDataConnected: boolean;
  /** Opens the instrument switcher slide-out (the identity button). */
  onSwitchInstrument?: () => void;
  /** Selects desktop order entry or opens the mobile ticket; never submits. */
  onOpenTrade?: (side: "BUY" | "SELL") => void;
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
const STOCHASTIC_STORAGE_KEY = "blckforest:chart-stochastic";
const ATR_STORAGE_KEY = "blckforest:chart-atr";
const VWAP_STORAGE_KEY = "blckforest:chart-vwap";

function isInterval(value: string | null): value is CandleInterval {
  return value != null && (TIMEFRAMES as readonly string[]).includes(value);
}

/** Chart-library colors stay in RGB/hex formats; Trade's dim CSS tokens use
 *  OKLCH, which lightweight-charts cannot parse. These RGB values preserve the
 *  same neutral ramp without changing the app-wide theme tokens. */
function chartThemeOptions(dim: boolean) {
  const colors = dim
    ? {
        canvas: "#181818",
        text: "#8c8c8c",
        panel: "#262626",
        border: "#2a2a2a",
        grid: "#262626",
      }
    : {
        canvas: "#ffffff",
        text: "#66707e",
        panel: "#eef1f4",
        border: "#d5dbe3",
        grid: "#e7ebef",
      };
  return {
    layout: {
      background: { type: ColorType.Solid, color: colors.canvas },
      textColor: colors.text,
      panes: { separatorColor: colors.border },
    },
    grid: {
      vertLines: { color: colors.grid },
      horzLines: { color: colors.grid },
    },
    crosshair: {
      vertLine: { color: colors.text, labelBackgroundColor: colors.panel },
      horzLine: { color: colors.text, labelBackgroundColor: colors.panel },
    },
    rightPriceScale: { borderColor: colors.border },
    timeScale: { borderColor: colors.border },
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
export function ChartPanel({ instrument, marketDataConnected, onSwitchInstrument, onOpenTrade }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const isDim = theme === "dim";
  const isDimRef = useRef(isDim);
  isDimRef.current = isDim;
  const panelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const historyMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
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
  const stochasticKRef = useRef<ISeriesApi<"Line"> | null>(null);
  const stochasticDRef = useRef<ISeriesApi<"Line"> | null>(null);
  const atrSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const watermarkRef = useRef<ITextWatermarkPluginApi<Time> | null>(null);
  const prevCandleCount = useRef(0);
  const appliedDataKeyRef = useRef("");
  const lastAppliedCandleTimeRef = useRef<number | null>(null);
  const chartCandlesRef = useRef<Candle[]>([]);
  const historyCandlesRef = useRef<Candle[]>([]);
  const historyRequestRef = useRef<string | null>(null);
  const barSpacingRef = useRef(8);
  const userZoomedRef = useRef(false);

  const interval = useForexStore((state) => state.interval);
  const setInterval = useForexStore((state) => state.setInterval);
  const candles = useForexStore((state) => state.candles);
  const quote = useForexStore((state) => state.quote);
  const snapshotVersion = useForexStore((state) => state.snapshotVersion);
  const [marketNow, setMarketNow] = useState(0);

  const [chartType, setChartType] = useState<ChartType>("candles");
  const chartTypeRef = useRef(chartType);
  chartTypeRef.current = chartType;
  const [showMA, setShowMA] = useState(false);
  const [showEMA, setShowEMA] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);
  const [showStochastic, setShowStochastic] = useState(false);
  const [showATR, setShowATR] = useState(false);
  const [showVWAP, setShowVWAP] = useState(false);
  const [maPeriod] = useState(20);
  const [emaPeriod] = useState(20);
  const [bollingerPeriod] = useState(20);
  const [bollingerStdDev] = useState(2);
  const [rsiPeriod] = useState(14);
  const [hoveredOhlc, setHoveredOhlc] = useState<DisplayOhlc | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyExhausted, setHistoryExhausted] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("");
  const quoteReady = marketDataConnected &&
    isExecutableQuote(quote, instrument.symbol, marketNow || Date.now());
  const liveQuote = quoteReady && quote?.symbol === instrument.symbol ? quote : null;

  useEffect(() => {
    setMarketNow(Date.now());
    const timer = window.setInterval(() => setMarketNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

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
    setShowStochastic(storedFlag(STOCHASTIC_STORAGE_KEY, false));
    setShowATR(storedFlag(ATR_STORAGE_KEY, false));
    setShowVWAP(storedFlag(VWAP_STORAGE_KEY, false));
  }, [searchParams, setInterval]);
  const historyKey = useMemo(
    () => `${instrument.symbol}-${interval}`,
    [instrument.symbol, interval],
  );
  const historyKeyRef = useRef(historyKey);
  historyKeyRef.current = historyKey;

  const replaceChartData = useCallback((data: Candle[]) => {
    const colors = volumeColors(isDimRef.current);
    seriesRef.current?.setData(data.map((candle) => ({
      time: candle.time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    })));
    lineSeriesRef.current?.setData(data.map((candle) => ({
      time: candle.time as UTCTimestamp,
      value: candle.close,
    })));
    volumeSeriesRef.current?.setData(data.map((candle) => ({
      time: candle.time as UTCTimestamp,
      value: candle.volume,
      color: candle.close >= candle.open ? colors.up : colors.down,
    })));
    if (maSeriesRef.current) {
      const points = data.length >= maPeriod ? computeSMASeries(data, maPeriod) : [];
      maSeriesRef.current.setData(points.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })));
    }
    if (emaSeriesRef.current) {
      const points = data.length >= emaPeriod ? computeEMASeries(data, emaPeriod) : [];
      emaSeriesRef.current.setData(points.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })));
    }
    if (bbUpperRef.current && bbMiddleRef.current && bbLowerRef.current) {
      const points = data.length >= bollingerPeriod
        ? computeBollinger(data, bollingerPeriod, bollingerStdDev)
        : [];
      bbUpperRef.current.setData(points.map((point) => ({ time: point.time as UTCTimestamp, value: point.upper })));
      bbMiddleRef.current.setData(points.map((point) => ({ time: point.time as UTCTimestamp, value: point.middle })));
      bbLowerRef.current.setData(points.map((point) => ({ time: point.time as UTCTimestamp, value: point.lower })));
    }
    if (rsiSeriesRef.current) {
      const points = data.length > rsiPeriod ? computeRSISeries(data, rsiPeriod) : [];
      rsiSeriesRef.current.setData(points.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })));
    }
    if (macdHistRef.current && macdLineRef.current && macdSignalRef.current) {
      const points = data.length >= 35 ? computeMACD(data) : [];
      macdHistRef.current.setData(points.map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.histogram,
        color: point.histogram >= 0 ? colors.up : colors.down,
      })));
      macdLineRef.current.setData(points.map((point) => ({ time: point.time as UTCTimestamp, value: point.macd })));
      macdSignalRef.current.setData(points.map((point) => ({ time: point.time as UTCTimestamp, value: point.signal })));
    }
    if (stochasticKRef.current && stochasticDRef.current) {
      const points = computeStochasticSeries(data);
      stochasticKRef.current.setData(points.map((point) => ({ time: point.time as UTCTimestamp, value: point.k })));
      stochasticDRef.current.setData(points.flatMap((point) => point.d == null
        ? []
        : [{ time: point.time as UTCTimestamp, value: point.d }]));
    }
    if (atrSeriesRef.current) {
      atrSeriesRef.current.setData(computeATRSeries(data).map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.value,
      })));
    }
    if (vwapSeriesRef.current) {
      vwapSeriesRef.current.setData(computeVWAPSeries(data).map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.value,
      })));
    }
  }, [bollingerPeriod, bollingerStdDev, emaPeriod, maPeriod, rsiPeriod]);

  useEffect(() => {
    prevCandleCount.current = 0;
    appliedDataKeyRef.current = "";
    lastAppliedCandleTimeRef.current = null;
    userZoomedRef.current = false;
    barSpacingRef.current = 8;
    setHoveredOhlc(null);
  }, [syncKey]);

  useEffect(() => {
    chartCandlesRef.current = [];
    historyCandlesRef.current = [];
    historyRequestRef.current = null;
    setHistoryLoading(false);
    setHistoryExhausted(false);
    setHistoryMessage("");
  }, [historyKey]);

  useEffect(() => {
    const markers = historyMarkersRef.current;
    const oldest = chartCandlesRef.current[0];
    if (!markers || !historyExhausted || !oldest) {
      markers?.setMarkers([]);
      return;
    }
    markers.setMarkers([{
      time: oldest.time as UTCTimestamp,
      position: "belowBar",
      shape: "arrowUp",
      color: "#64748b",
      text: "End of history",
    }]);
  }, [historyExhausted, historyKey]);

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

    // Instrument-correct precision: without an explicit priceFormat the chart
    // defaults to 2 decimals, which collapses the right-hand price scale of
    // high-precision instruments (5-digit FX pairs) into identical labels.
    const priceFormat = {
      type: "price" as const,
      precision: instrument.digits,
      minMove: Math.pow(10, -instrument.digits),
    };
    const candleSeries = chart.addSeries(CandlestickSeries, {
      ...candleColors(dim),
      priceLineVisible: true,
      lastValueVisible: true,
      priceFormat,
      visible: chartTypeRef.current === "candles",
    });
    seriesRef.current = candleSeries;
    historyMarkersRef.current = createSeriesMarkers(candleSeries);
    const lineSeries = chart.addSeries(LineSeries, {
      color: "#f97316",
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
      priceFormat,
      visible: chartTypeRef.current === "line",
    });
    lineSeriesRef.current = lineSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      priceLineVisible: false,
      lastValueVisible: false,
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    const crosshairHandler = (param: MouseEventParams) => {
      const activeSeries = chartTypeRef.current === "candles" ? candleSeries : lineSeries;
      const point = param.seriesData.get(activeSeries);
      if (!point) {
        setHoveredOhlc(null);
        return;
      }
      const time = Number(param.time ?? 0);
      const candle = findCandleByTime(chartCandlesRef.current, time);
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
      historyMarkersRef.current?.detach();
      historyMarkersRef.current = null;
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
      stochasticKRef.current = null;
      stochasticDRef.current = null;
      atrSeriesRef.current = null;
      vwapSeriesRef.current = null;
    };
    // Chart type and theme changes restyle the existing chart; disposal is
    // reserved for unmount so canvas rendering is not raced by chart teardown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    seriesRef.current?.applyOptions({ visible: chartType === "candles" });
    lineSeriesRef.current?.applyOptions({ visible: chartType === "line" });
  }, [chartType]);

  // ── Live theme restyle: applyOptions keeps the chart (and the user's zoom
  //     position) intact — no dispose/recreate, no paint race. ─────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const theme = chartThemeOptions(isDim);
    chart.applyOptions({ ...theme, crosshair: { ...theme.crosshair, mode: CrosshairMode.Normal } });
    seriesRef.current?.applyOptions(candleColors(isDim));
    const colors = volumeColors(isDimRef.current);
    volumeSeriesRef.current?.setData(
      chartCandlesRef.current.map((candle) => ({
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
  }, [instrument.symbol, instrument.name, interval, isDim]);

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
    const currentCandles = chartCandlesRef.current;
    if (currentCandles.length >= maPeriod) movingAverage.setData(computeSMA(currentCandles, maPeriod));

    return () => {
      if (maSeriesRef.current === movingAverage && chartRef.current === chart) {
        chart.removeSeries(movingAverage);
        maSeriesRef.current = null;
      }
    };
  }, [showMA, maPeriod]);

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
    const c = chartCandlesRef.current;
    if (c.length >= emaPeriod) s.setData(computeEMASeries(c, emaPeriod).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    return () => { if (emaSeriesRef.current === s && chartRef.current === chart) { chart.removeSeries(s); emaSeriesRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEMA, emaPeriod]);

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
    const c = chartCandlesRef.current;
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
  }, [showBollinger, bollingerPeriod, bollingerStdDev]);

  // ── Session VWAP overlay (pane 0) ────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (!showVWAP) {
      if (vwapSeriesRef.current) chart.removeSeries(vwapSeriesRef.current);
      vwapSeriesRef.current = null;
      return;
    }
    const series = chart.addSeries(LineSeries, {
      color: "#0ea5e9",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    vwapSeriesRef.current = series;
    series.setData(computeVWAPSeries(chartCandlesRef.current).map((point) => ({
      time: point.time as UTCTimestamp,
      value: point.value,
    })));
    return () => {
      if (vwapSeriesRef.current === series && chartRef.current === chart) {
        chart.removeSeries(series);
        vwapSeriesRef.current = null;
      }
    };
  }, [showVWAP]);

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
    const c = chartCandlesRef.current;
    if (c.length > rsiPeriod) s.setData(computeRSISeries(c, rsiPeriod).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    return () => { if (rsiSeriesRef.current === s && chartRef.current === chart) { chart.removeSeries(s); rsiSeriesRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRSI, rsiPeriod]);

  // ── Stochastic oscillator (after RSI when both are enabled) ──────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (!showStochastic) {
      [stochasticKRef, stochasticDRef].forEach((ref) => {
        if (ref.current) chart.removeSeries(ref.current);
        ref.current = null;
      });
      return;
    }
    const paneIndex = showRSI ? 2 : 1;
    const kSeries = chart.addSeries(LineSeries, {
      color: "#7c3aed",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    }, paneIndex);
    const dSeries = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    }, paneIndex);
    stochasticKRef.current = kSeries;
    stochasticDRef.current = dSeries;
    kSeries.createPriceLine({ price: 80, color: "rgba(220,38,38,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "80" });
    kSeries.createPriceLine({ price: 20, color: "rgba(22,128,59,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "20" });
    const points = computeStochasticSeries(chartCandlesRef.current);
    kSeries.setData(points.map((point) => ({ time: point.time as UTCTimestamp, value: point.k })));
    dSeries.setData(points.flatMap((point) => point.d == null
      ? []
      : [{ time: point.time as UTCTimestamp, value: point.d }]));
    return () => {
      [kSeries, dSeries].forEach((series) => { try { chart.removeSeries(series); } catch { /* already removed */ } });
      if (stochasticKRef.current === kSeries) stochasticKRef.current = null;
      if (stochasticDRef.current === dSeries) stochasticDRef.current = null;
    };
  }, [showStochastic, showRSI]);

  // ── MACD oscillator ──────────────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (!showMACD) {
      [macdHistRef, macdLineRef, macdSignalRef].forEach((r) => { if (r.current) chart.removeSeries(r.current); r.current = null; });
      return;
    }
    const paneIndex = 1 + Number(showRSI) + Number(showStochastic);
    const hist = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, paneIndex);
    const line = chart.addSeries(LineSeries, { color: "#2563eb", lineWidth: 2, priceLineVisible: false, lastValueVisible: true }, paneIndex);
    const signal = chart.addSeries(LineSeries, { color: "#dc2626", lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, paneIndex);
    macdHistRef.current = hist; macdLineRef.current = line; macdSignalRef.current = signal;
    const c = chartCandlesRef.current;
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
  }, [showMACD, showRSI, showStochastic]);

  // ── ATR volatility pane ──────────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (!showATR) {
      if (atrSeriesRef.current) chart.removeSeries(atrSeriesRef.current);
      atrSeriesRef.current = null;
      return;
    }
    const paneIndex = 1 + Number(showRSI) + Number(showStochastic) + Number(showMACD);
    const series = chart.addSeries(LineSeries, {
      color: "#d97706",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    }, paneIndex);
    atrSeriesRef.current = series;
    series.setData(computeATRSeries(chartCandlesRef.current).map((point) => ({
      time: point.time as UTCTimestamp,
      value: point.value,
    })));
    return () => {
      if (atrSeriesRef.current === series && chartRef.current === chart) {
        chart.removeSeries(series);
        atrSeriesRef.current = null;
      }
    };
  }, [showATR, showRSI, showStochastic, showMACD]);

  const candleCount = candles.length;
  useEffect(() => {
    const last = candles[candleCount - 1];
    if (!seriesRef.current || !lineSeriesRef.current || !last) return;

    const dataKey = `${syncKey}:${snapshotVersion}`;
    const previousCount = prevCandleCount.current;
    const previousTime = lastAppliedCandleTimeRef.current;
    const sameCandle = candleCount === previousCount && last.time === previousTime;
    const newCandle =
      previousTime != null &&
      last.time > previousTime &&
      (candleCount === previousCount || candleCount === previousCount + 1);
    const incremental =
      appliedDataKeyRef.current === dataKey &&
      previousCount > 0 &&
      (sameCandle || newCandle) &&
      chartCandlesRef.current.length > 0;

    if (incremental) {
      const chartCandles = chartCandlesRef.current;
      const chartLast = chartCandles[chartCandles.length - 1];
      if (chartLast.time === last.time) chartCandles[chartCandles.length - 1] = last;
      else if (last.time > chartLast.time) chartCandles.push(last);
      else return;

      if (chartCandles.length > MAX_CHART_HISTORY_CANDLES) {
        chartCandles.splice(0, chartCandles.length - MAX_CHART_HISTORY_CANDLES);
        replaceChartData(chartCandles);
      } else {
        seriesRef.current.update({
          time: last.time as UTCTimestamp,
          open: last.open,
          high: last.high,
          low: last.low,
          close: last.close,
        });
        lineSeriesRef.current.update({ time: last.time as UTCTimestamp, value: last.close });
        const colors = volumeColors(isDimRef.current);
        volumeSeriesRef.current?.update({
          time: last.time as UTCTimestamp,
          value: last.volume,
          color: last.close >= last.open ? colors.up : colors.down,
        });
      }
      if (newCandle && !userZoomedRef.current) {
        chartRef.current?.timeScale().scrollToRealTime();
      }
    } else {
      // Full data replacement is reserved for a new subscription or a server
      // snapshot. Ordinary live ticks update only the last chart bar.
      const savedRange: LogicalRange | null = userZoomedRef.current
        ? chartRef.current?.timeScale().getVisibleLogicalRange() ?? null
        : null;
      const latestStart = candles[0]?.time ?? 0;
      const windowStart = Math.floor(Date.now() / 1000) - CHART_HISTORY_WINDOW_SECONDS;
      const older = historyCandlesRef.current.filter(
        (candle) => candle.time < latestStart && candle.time >= windowStart,
      );
      const currentWindow = candles.filter((candle) => candle.time >= windowStart);
      chartCandlesRef.current = mergeCandles(older, currentWindow);
      replaceChartData(chartCandlesRef.current);
      if (!userZoomedRef.current) {
        chartRef.current?.timeScale().fitContent();
      } else if (savedRange) {
        chartRef.current?.timeScale().setVisibleLogicalRange(savedRange);
      }
    }

    appliedDataKeyRef.current = dataKey;
    prevCandleCount.current = candleCount;
    lastAppliedCandleTimeRef.current = last.time;
  }, [syncKey, snapshotVersion, candleCount, candles, chartType, replaceChartData]);

  useEffect(() => {
    if (candles.length === 0) return;
    const last = candles[candles.length - 1];
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
    if (stochasticKRef.current && stochasticDRef.current) {
      const points = computeStochasticSeries(candles);
      const lastStochastic = points[points.length - 1];
      if (lastStochastic) {
        stochasticKRef.current.update({ time: lastStochastic.time as UTCTimestamp, value: lastStochastic.k });
        if (lastStochastic.d != null) {
          stochasticDRef.current.update({ time: lastStochastic.time as UTCTimestamp, value: lastStochastic.d });
        }
      }
    }
    if (atrSeriesRef.current) {
      const points = computeATRSeries(candles);
      const lastATR = points[points.length - 1];
      if (lastATR) atrSeriesRef.current.update({ time: lastATR.time as UTCTimestamp, value: lastATR.value });
    }
    if (vwapSeriesRef.current) {
      const points = computeVWAPSeries(candles);
      const lastVWAP = points[points.length - 1];
      if (lastVWAP) vwapSeriesRef.current.update({ time: lastVWAP.time as UTCTimestamp, value: lastVWAP.value });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, chartType, maPeriod]);

  const latestOhlc = useMemo<DisplayOhlc | null>(() => {
    const last = candles[candles.length - 1];
    if (!last) return null;
    const live = liveQuote?.mid ?? last.close;
    return { ...last, close: live, up: live >= last.open };
  }, [candles, liveQuote]);
  const ohlc = hoveredOhlc ?? latestOhlc;

  const loadEarlierCandles = useCallback(async () => {
    if (historyRequestRef.current) return;
    const requestKey = historyKey;
    const before = chartCandlesRef.current[0]?.time;
    if (before == null) {
      setHistoryMessage("Chart history is not ready yet.");
      return;
    }
    const windowStart = Math.floor(Date.now() / 1000) - CHART_HISTORY_WINDOW_SECONDS;
    if (before <= windowStart) {
      setHistoryExhausted(true);
      setHistoryMessage(`The ${CHART_HISTORY_DAYS}-day history window has been reached.`);
      return;
    }

    historyRequestRef.current = requestKey;
    setHistoryLoading(true);
    setHistoryMessage("");
    try {
      const params = new URLSearchParams({
        symbol: instrument.symbol,
        interval,
        before: String(before),
        limit: "2000",
      });
      const response = await fetch(`/api/market/history?${params.toString()}`, { cache: "no-store" });
      if (historyKeyRef.current !== requestKey) return;
      const payload = (await response.json().catch(() => null)) as
        | { candles?: Candle[]; historyAvailable?: boolean; hasMore?: boolean; message?: string; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? payload?.message ?? "Historical candles could not be loaded.");
      }
      if (!payload?.historyAvailable) {
        setHistoryExhausted(true);
        setHistoryMessage(payload?.message ?? "Older candles are unavailable from the configured market-data feed.");
        return;
      }

      const existing = chartCandlesRef.current;
      const older = (payload.candles ?? []).filter((candle) => candle.time < before && candle.time >= windowStart);
      const merged = mergeCandles(older, existing);
      const added = merged.length - existing.length;
      if (added <= 0) {
        setHistoryExhausted(!payload.hasMore);
        setHistoryMessage(payload.hasMore
          ? "The feed returned no new candles for this range."
          : "The configured provider has no earlier candles.");
        return;
      }

      const visibleRange = chartRef.current?.timeScale().getVisibleLogicalRange() ?? null;
      const liveStart = useForexStore.getState().candles[0]?.time ?? before;
      historyCandlesRef.current = merged.filter((candle) => candle.time < liveStart);
      chartCandlesRef.current = merged;
      replaceChartData(merged);
      userZoomedRef.current = true;
      if (visibleRange) {
        chartRef.current?.timeScale().setVisibleLogicalRange({
          from: visibleRange.from + added,
          to: visibleRange.to + added,
        });
      }
      const reachedWindow = merged[0]!.time <= windowStart;
      const reachedProviderEnd = !payload.hasMore;
      setHistoryExhausted(reachedWindow || reachedProviderEnd);
      setHistoryMessage(reachedWindow
        ? `The ${CHART_HISTORY_DAYS}-day history window has been reached.`
        : reachedProviderEnd
          ? "The configured provider has no earlier candles."
          : `Loaded ${added.toLocaleString()} earlier candles.`);
    } catch (error) {
      if (historyKeyRef.current === requestKey) {
        setHistoryMessage(error instanceof Error ? error.message : "Historical candles could not be loaded.");
      }
    } finally {
      if (historyRequestRef.current === requestKey) {
        historyRequestRef.current = null;
        setHistoryLoading(false);
      }
    }
  }, [historyKey, instrument.symbol, interval, replaceChartData]);

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

  const toggleMA = () => { setShowMA((v) => { const n = !v; window.localStorage.setItem(MA_STORAGE_KEY, String(n)); return n; }); };
  const toggleEMA = () => { setShowEMA((v) => { const n = !v; window.localStorage.setItem(EMA_STORAGE_KEY, String(n)); return n; }); };
  const toggleBollinger = () => { setShowBollinger((v) => { const n = !v; window.localStorage.setItem(BB_STORAGE_KEY, String(n)); return n; }); };
  const toggleRSI = () => { setShowRSI((v) => { const n = !v; window.localStorage.setItem(RSI_STORAGE_KEY, String(n)); return n; }); };
  const toggleMACD = () => { setShowMACD((v) => { const n = !v; window.localStorage.setItem(MACD_STORAGE_KEY, String(n)); return n; }); };
  const toggleStochastic = () => { setShowStochastic((v) => { const n = !v; window.localStorage.setItem(STOCHASTIC_STORAGE_KEY, String(n)); return n; }); };
  const toggleATR = () => { setShowATR((v) => { const n = !v; window.localStorage.setItem(ATR_STORAGE_KEY, String(n)); return n; }); };
  const toggleVWAP = () => { setShowVWAP((v) => { const n = !v; window.localStorage.setItem(VWAP_STORAGE_KEY, String(n)); return n; }); };

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
  if (showVWAP) {
    const points = computeVWAPSeries(candles);
    const last = points[points.length - 1];
    legendChips.push({ color: "#0ea5e9", label: "VWAP (UTC session)", value: last ? fmtPrice(last.value, instrument.digits) : null, onRemove: toggleVWAP });
  }
  if (showStochastic) {
    const points = computeStochasticSeries(candles);
    const last = points[points.length - 1];
    legendChips.push({ color: "#7c3aed", label: "Stochastic (14, 3)", value: last ? `${last.k.toFixed(1)} / ${last.d?.toFixed(1) ?? "—"}` : null, onRemove: toggleStochastic });
  }
  if (showATR) {
    const points = computeATRSeries(candles);
    const last = points[points.length - 1];
    legendChips.push({ color: "#d97706", label: "ATR (14)", value: last ? fmtPrice(last.value, instrument.digits) : null, onRemove: toggleATR });
  }

  const indicatorGroups: IndicatorGroup[] = [
    {
      group: "Overlays",
      entries: [
        { key: "sma", label: `SMA (${maPeriod})`, checked: showMA, toggle: toggleMA },
        { key: "ema", label: `EMA (${emaPeriod})`, checked: showEMA, toggle: toggleEMA },
        { key: "bb", label: `Bollinger (${bollingerPeriod}, ${bollingerStdDev}σ)`, checked: showBollinger, toggle: toggleBollinger },
        { key: "vwap", label: "VWAP (UTC session)", checked: showVWAP, toggle: toggleVWAP },
      ],
    },
    {
      group: "Oscillators",
      entries: [
        { key: "rsi", label: `RSI (${rsiPeriod})`, checked: showRSI, toggle: toggleRSI },
        { key: "macd", label: "MACD (12, 26, 9)", checked: showMACD, toggle: toggleMACD },
        { key: "stochastic", label: "Stochastic (14, 3)", checked: showStochastic, toggle: toggleStochastic },
      ],
    },
    {
      group: "Volatility",
      entries: [
        { key: "atr", label: "ATR (14)", checked: showATR, toggle: toggleATR },
      ],
    },
  ];

  return (
    <div
      ref={panelRef}
      data-testid="professional-chart-panel"
      className={`flex h-full min-h-112 flex-col overflow-hidden bg-canvas shadow-panel lg:min-h-0 ${fullscreen ? "rounded-none" : "rounded-xl"}`}
    >
      <div className="flex shrink-0 flex-col bg-panel-2 sm:items-stretch 2xl:flex-row 2xl:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-2 px-3 py-2 sm:py-0">
          {/* Instrument identity IS the asset selector — tap to slide out the
              switcher. */}
          {onSwitchInstrument ? (
            <button
              type="button"
              onClick={onSwitchInstrument}
              aria-haspopup="dialog"
              title="Switch instrument"
              className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-panel-2 focus-visible:outline-2 focus-visible:outline-brand"
            >
              <InstrumentIcon symbol={instrument.symbol} size={20} />
              <span className="text-sm font-bold tracking-tight">{instrument.symbol}</span>
              <span className="hidden min-w-0 truncate text-(length:--term-text-2xs) font-medium text-text-faint sm:inline">{instrument.name}</span>
              <span className="rounded bg-brand-soft px-1.5 py-0.5 text-(length:--term-text-2xs) font-medium uppercase text-brand">
                {instrument.category}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className="shrink-0 text-text-faint">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <>
              <InstrumentIcon symbol={instrument.symbol} size={20} />
              <span className="text-sm font-bold tracking-tight">{instrument.symbol}</span>
              <span className="text-(length:--term-text-2xs) font-medium text-text-faint">{instrument.name}</span>
              <span className="rounded bg-brand-soft px-1.5 py-0.5 text-(length:--term-text-2xs) font-medium uppercase text-brand">
                {instrument.category}
              </span>
            </>
          )}
          {/* Live price + session change — the TradingView-style anchor the eye
              goes to first. Color follows the live tick direction. */}
          {latestOhlc && (
            <span className="flex items-baseline gap-1.5">
              <span className={`text-base font-bold tnum leading-none ${latestOhlc.up ? "text-up" : "text-down"}`}>
                {fmtPrice(latestOhlc.close, instrument.digits)}
              </span>
              {instrument.changePct !== 0 && (
                <span className={`text-(length:--term-text-2xs) font-semibold tnum leading-none ${instrument.changePct > 0 ? "text-up" : "text-down"}`}>
                  {instrument.changePct > 0 ? "▲" : "▼"} {Math.abs(instrument.changePct).toFixed(2)}%
                </span>
              )}
            </span>
          )}
          {ohlc ? (
            <div className="hidden min-w-0 items-center gap-2 text-(length:--term-text-2xs) tnum md:flex">
              <OhlcField label="O" value={ohlc.open} up={ohlc.up} digits={instrument.digits} />
              <OhlcField label="H" value={ohlc.high} up={ohlc.up} digits={instrument.digits} />
              <OhlcField label="L" value={ohlc.low} up={ohlc.up} digits={instrument.digits} />
              <OhlcField label="C" value={ohlc.close} up={ohlc.up} digits={instrument.digits} />
              <span className="text-text-faint">Vol {Math.round(ohlc.volume).toLocaleString("en-US")}</span>
            </div>
          ) : null}
        </div>

        {/* Mobile: timeframes get priority row; desktop: all controls inline */}
        <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5 sm:hidden [scrollbar:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <ChipGroup
            ariaLabel="Chart timeframe"
            size="sm"
            value={interval}
            onChange={selectTimeframe}
            options={TIMEFRAMES.map((timeframe) => ({ value: timeframe, label: timeframe }))}
          />
          <div className="mx-1 h-4 w-px shrink-0 bg-panel-3" />
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
          <IndicatorsMenu groups={indicatorGroups} />
          <ViewControlsMenu
            fullscreen={fullscreen}
            onZoomIn={() => zoom("in")}
            onZoomOut={() => zoom("out")}
            onFit={fitChart}
            onToggleFullscreen={() => void toggleFullscreen()}
            onLoadEarlier={loadEarlierCandles}
            historyLoading={historyLoading}
            historyExhausted={historyExhausted}
          />
        </div>

        {/* Desktop: all controls inline (chart-type, indicators, zoom, fit, fullscreen, timeframes) */}
        <div className="hidden min-w-0 items-center gap-1 overflow-x-auto px-2 py-1.5 sm:ml-0 sm:flex sm:w-full 2xl:ml-auto 2xl:w-auto">
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
          <IndicatorsMenu groups={indicatorGroups} />
          <ViewControlsMenu
            fullscreen={fullscreen}
            onZoomIn={() => zoom("in")}
            onZoomOut={() => zoom("out")}
            onFit={fitChart}
            onToggleFullscreen={() => void toggleFullscreen()}
            onLoadEarlier={loadEarlierCandles}
            historyLoading={historyLoading}
            historyExhausted={historyExhausted}
          />
          <div className="mx-1 h-4 w-px shrink-0 bg-panel-3" />
          <ChipGroup
            ariaLabel="Chart timeframe"
            size="sm"
            value={interval}
            onChange={selectTimeframe}
            options={TIMEFRAMES.map((timeframe) => ({ value: timeframe, label: timeframe }))}
          />
        </div>
      </div>

      {historyMessage && (
        <div role="status" className="flex shrink-0 items-center gap-1.5 bg-panel px-3 py-1 text-(length:--term-text-2xs) text-text-faint">
          {historyExhausted ? <History size={12} aria-hidden /> : null}
          {historyExhausted ? <span className="font-semibold text-text-muted">End of available history</span> : null}
          {historyExhausted ? <span aria-hidden>·</span> : null}
          <span>{historyMessage}</span>
        </div>
      )}

      {ohlc ? (
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto bg-panel px-3 py-1 text-(length:--term-text-2xs) tnum md:hidden">
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
            <div className="flex items-center gap-2 rounded bg-canvas/90 px-3 py-2 text-xs text-text-muted shadow-card">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
              Loading price history…
            </div>
          </div>
        )}
        {legendChips.length > 0 && (
          <div className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-col gap-1">
            {legendChips.map((chip) => (
              <LegendChip key={chip.label} color={chip.color} label={chip.label} value={chip.value} onRemove={chip.onRemove} />
            ))}
          </div>
        )}
        {onOpenTrade && (
          <FloatingTradeControls
            instrument={instrument}
            liveQuote={liveQuote}
            onOpenTrade={onOpenTrade}
          />
        )}
      </div>
    </div>
  );
}

function FloatingTradeControls({
  instrument,
  liveQuote,
  onOpenTrade,
}: {
  instrument: InstrumentView;
  liveQuote: { bid: number; ask: number } | null;
  onOpenTrade: (side: "BUY" | "SELL") => void;
}) {
  const controlsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number; left: number; top: number } | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const clampPosition = (left: number, top: number) => {
    const controls = controlsRef.current;
    const bounds = controls?.parentElement?.getBoundingClientRect();
    if (!controls || !bounds) return { left, top };
    const maxLeft = Math.max(8, bounds.width - controls.offsetWidth - 8);
    const maxTop = Math.max(8, bounds.height - controls.offsetHeight - 8);
    return {
      left: Math.min(maxLeft, Math.max(8, left)),
      top: Math.min(maxTop, Math.max(8, top)),
    };
  };

  useEffect(() => {
    const parent = controlsRef.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(() => {
      setPosition((current) => current ? clampPosition(current.left, current.top) : current);
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const beginDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const controls = controlsRef.current;
    const bounds = controls?.parentElement?.getBoundingClientRect();
    const rect = controls?.getBoundingClientRect();
    if (!controls || !bounds || !rect) return;

    event.preventDefault();
    setPosition(clampPosition(rect.left - bounds.left, rect.top - bounds.top));
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      left: rect.left - bounds.left,
      top: rect.top - bounds.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveControls = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPosition(clampPosition(
      drag.left + event.clientX - drag.clientX,
      drag.top + event.clientY - drag.clientY,
    ));
  };

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const nudgeControls = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const offsets: Record<string, [number, number]> = {
      ArrowLeft: [-12, 0],
      ArrowRight: [12, 0],
      ArrowUp: [0, -12],
      ArrowDown: [0, 12],
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const controls = controlsRef.current;
    const bounds = controls?.parentElement?.getBoundingClientRect();
    const rect = controls?.getBoundingClientRect();
    if (!controls || !bounds || !rect) return;
    setPosition(clampPosition(
      (position?.left ?? rect.left - bounds.left) + offset[0],
      (position?.top ?? rect.top - bounds.top) + offset[1],
    ));
  };

  return (
    <div
      ref={controlsRef}
      data-testid="floating-trade-controls"
      className="pointer-events-auto absolute right-3 top-3 z-20 w-52 select-none overflow-hidden rounded-xl border border-border-soft bg-canvas/95 shadow-xl backdrop-blur-md"
      style={position ? { left: position.left, top: position.top, right: "auto" } : undefined}
    >
      <div className="flex h-7 items-center justify-between bg-panel/80 px-2.5">
        <span className="flex items-center gap-1.5 text-(length:--term-text-2xs) font-semibold uppercase tracking-wide text-text-faint">
          <span className={`h-1.5 w-1.5 rounded-full ${liveQuote ? "bg-up" : "bg-down"}`} aria-hidden />
          Spread
          <span className="tnum text-text-muted">
            {liveQuote ? fmtPrice(liveQuote.ask - liveQuote.bid, instrument.digits) : "—"}
          </span>
        </span>
        <button
          type="button"
          aria-label="Move trade shortcuts; use arrow keys to reposition"
          title="Drag to reposition, or use arrow keys"
          onPointerDown={beginDrag}
          onPointerMove={moveControls}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={nudgeControls}
          className="touch-none cursor-grab rounded p-1 text-text-faint transition-colors hover:bg-panel-3 hover:text-text active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-brand"
        >
          <GripVertical size={13} strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 p-1.5">
        <Button
          type="button"
          variant="sell"
          size="sm"
          aria-label={liveQuote ? `Open sell ticket at ${fmtPrice(liveQuote.bid, instrument.digits)}` : "Open sell ticket — live quote unavailable"}
          onClick={() => onOpenTrade("SELL")}
          className="h-11 min-w-0 flex-col gap-0 px-1 py-1 leading-tight"
        >
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
            <TrendingDown size={12} strokeWidth={2} aria-hidden />
            Sell
          </span>
          <span className="max-w-full truncate text-xs tnum">
            {liveQuote ? fmtPrice(liveQuote.bid, instrument.digits) : "—"}
          </span>
        </Button>
        <Button
          type="button"
          variant="buy"
          size="sm"
          aria-label={liveQuote ? `Open buy ticket at ${fmtPrice(liveQuote.ask, instrument.digits)}` : "Open buy ticket — live quote unavailable"}
          onClick={() => onOpenTrade("BUY")}
          className="h-11 min-w-0 flex-col gap-0 px-1 py-1 leading-tight"
        >
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
            <TrendingUp size={12} strokeWidth={2} aria-hidden />
            Buy
          </span>
          <span className="max-w-full truncate text-xs tnum">
            {liveQuote ? fmtPrice(liveQuote.ask, instrument.digits) : "—"}
          </span>
        </Button>
      </div>
    </div>
  );
}

interface IndicatorEntry {
  key: string;
  label: string;
  checked: boolean;
  toggle: () => void;
}

interface IndicatorGroup {
  group: string;
  entries: IndicatorEntry[];
}

/** Indicator toggles as a Radix dropdown menu (keyboard nav, Escape,
 *  collision-aware placement) replacing the hand-rolled positioned portal. */
function IndicatorsMenu({ groups }: { groups: IndicatorGroup[] }) {
  const anyActive = groups.some((group) => group.entries.some((entry) => entry.checked));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ChartButton label="Chart indicators" active={anyActive}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 16c3 0 4-8 7-8s4 8 7 8 2-4 2-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </ChartButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-48 rounded-md border border-border bg-canvas text-xs shadow-xl">
        {groups.map((group, groupIndex) => (
          <div key={group.group}>
            {groupIndex > 0 && <DropdownMenuSeparator className="bg-border-soft" />}
            <DropdownMenuLabel className="px-2 py-1.5 text-(length:--term-text-2xs) font-semibold uppercase tracking-wide text-text-faint">
              {group.group}
            </DropdownMenuLabel>
            {group.entries.map((entry) => (
              <DropdownMenuCheckboxItem
                key={entry.key}
                checked={entry.checked}
                onCheckedChange={() => entry.toggle()}
                className="gap-2 rounded-sm px-2 py-1.5 text-(length:--term-text-xs) text-text"
              >
                {entry.label}
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ViewControlsMenu({
  fullscreen,
  onZoomIn,
  onZoomOut,
  onFit,
  onToggleFullscreen,
  onLoadEarlier,
  historyLoading,
  historyExhausted,
}: {
  fullscreen: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onToggleFullscreen: () => void;
  onLoadEarlier: () => void;
  historyLoading: boolean;
  historyExhausted: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ChartButton label="Chart view controls">
          <MoreHorizontal size={15} strokeWidth={2} aria-hidden />
        </ChartButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Chart view</DropdownMenuLabel>
          <DropdownMenuItem onSelect={onZoomIn}><ZoomIn />Zoom in</DropdownMenuItem>
          <DropdownMenuItem onSelect={onZoomOut}><ZoomOut />Zoom out</DropdownMenuItem>
          <DropdownMenuItem onSelect={onFit}>Fit all candles</DropdownMenuItem>
          <DropdownMenuItem onSelect={onToggleFullscreen}>
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
            {fullscreen ? "Exit full screen" : "Full screen"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>History</DropdownMenuLabel>
          <DropdownMenuItem
            disabled={historyLoading || historyExhausted}
            onSelect={onLoadEarlier}
          >
            <History />
            {historyLoading ? "Loading earlier candles…" : "Load earlier candles"}
          </DropdownMenuItem>
          <DropdownMenuLabel className="px-2 py-1 text-(length:--term-text-2xs) font-normal normal-case tracking-normal text-text-faint">
            History window: up to {CHART_HISTORY_DAYS} days; availability depends on the provider.
          </DropdownMenuLabel>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChartButton({
  label,
  active = false,
  onClick,
  children,
  ...rest
}: {
  label: string;
  active?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      onClick={onClick}
      className={`shrink-0 rounded px-2 py-1 text-(length:--term-text-2xs) font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand ${
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
    <span className="pointer-events-auto flex items-center gap-1.5 rounded bg-canvas/85 px-1.5 py-0.5 text-(length:--term-text-2xs) tnum shadow-sm backdrop-blur-sm">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-medium text-text-muted">{label}</span>
      {value != null && <span className="text-text">{value}</span>}
      <button
        type="button"
        aria-label={`Remove ${label} indicator`}
        onClick={onRemove}
        className="rounded p-1 text-(length:--term-text-2xs) leading-none text-text-faint transition-colors hover:bg-down/10 hover:text-down"
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

function findCandleByTime(candles: Candle[], time: number): Candle | null {
  let low = 0;
  let high = candles.length - 1;
  while (low <= high) {
    const middle = low + Math.floor((high - low) / 2);
    const candle = candles[middle];
    if (candle.time === time) return candle;
    if (candle.time < time) low = middle + 1;
    else high = middle - 1;
  }
  return null;
}

function mergeCandles(...groups: Candle[][]): Candle[] {
  const candlesByTime = new Map<number, Candle>();
  for (const group of groups) {
    for (const candle of group) candlesByTime.set(candle.time, candle);
  }
  return Array.from(candlesByTime.values()).sort((a, b) => a.time - b.time);
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