import { areaPath, smoothPath } from "./smoothPath";

/** Signal-card + terminal-mock chart series → smoothed Catmull-Rom paths.
 *  Shared by the Intelligence and Showcase landing sections. */
export const SIGNAL_SERIES: Array<[number, number]> = [[0, 96], [24, 88], [48, 92], [72, 70], [96, 77], [120, 54], [144, 61], [168, 40], [192, 47], [216, 30], [240, 37], [264, 22], [288, 29], [320, 16]];
export const SIGNAL_LINE = smoothPath(SIGNAL_SERIES);
export const SIGNAL_AREA = areaPath(SIGNAL_SERIES, 132);
export const DESK_SERIES: Array<[number, number]> = [[0, 96], [20, 88], [40, 92], [60, 72], [80, 78], [100, 56], [120, 63], [140, 42], [160, 49], [180, 30], [200, 38], [220, 22], [240, 29], [260, 16], [280, 24], [300, 12]];
export const DESK_LINE = smoothPath(DESK_SERIES);
export const DESK_AREA = areaPath(DESK_SERIES, 120);
export const PHONE_SERIES: Array<[number, number]> = [[0, 116], [12, 106], [24, 110], [36, 88], [48, 96], [60, 72], [72, 80], [84, 56], [96, 64], [108, 44], [120, 52]];
export const PHONE_LINE = smoothPath(PHONE_SERIES);
export const PHONE_AREA = areaPath(PHONE_SERIES, 130);
