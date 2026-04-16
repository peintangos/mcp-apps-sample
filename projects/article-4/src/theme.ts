import { createContext, useContext } from "react";

export type ColorPalette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  codeBg: string;
  errorBg: string;
  errorBorder: string;
  errorText: string;
  badgeConnectingColor: string;
  badgeConnectingBg: string;
  badgeConnectedColor: string;
  badgeConnectedBg: string;
  badgeErrorColor: string;
  badgeErrorBg: string;
  claudeSoftBg: string;
};

export const LIGHT_PALETTE: ColorPalette = {
  bg: "#fffaf5",
  surface: "#ffffff",
  surfaceAlt: "#fef7f0",
  border: "#fce3d1",
  text: "#1f1208",
  textMuted: "#8a5a3c",
  codeBg: "#fff3e9",
  errorBg: "#fef2f2",
  errorBorder: "#fecaca",
  errorText: "#7f1d1d",
  badgeConnectingColor: "#b38a6a",
  badgeConnectingBg: "#fef7f0",
  badgeConnectedColor: "#15803d",
  badgeConnectedBg: "#dcfce7",
  badgeErrorColor: "#b91c1c",
  badgeErrorBg: "#fee2e2",
  claudeSoftBg: "#fef1ea",
};

export const DARK_PALETTE: ColorPalette = {
  bg: "#1a0f07",
  surface: "#261811",
  surfaceAlt: "#1f130a",
  border: "#523022",
  text: "#fef1ea",
  textMuted: "#c9a48c",
  codeBg: "#0f0803",
  errorBg: "#450a0a",
  errorBorder: "#7f1d1d",
  errorText: "#fecaca",
  badgeConnectingColor: "#c9a48c",
  badgeConnectingBg: "#261811",
  badgeConnectedColor: "#4ade80",
  badgeConnectedBg: "#14532d",
  badgeErrorColor: "#fca5a5",
  badgeErrorBg: "#7f1d1d",
  claudeSoftBg: "#3a1e12",
};

export const ThemeContext = createContext<ColorPalette>(LIGHT_PALETTE);

export function useColors(): ColorPalette {
  return useContext(ThemeContext);
}
