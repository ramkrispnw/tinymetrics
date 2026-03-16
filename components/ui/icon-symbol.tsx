import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "list.bullet": "format-list-bulleted",
  "chart.bar.fill": "bar-chart",
  "sparkles": "auto-awesome",
  "plus": "add",
  "drop.fill": "water-drop",
  "moon.fill": "nightlight-round",
  "fork.knife": "restaurant",
  "eye.fill": "visibility",
  "camera.fill": "camera-alt",
  "xmark": "close",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "gearshape.fill": "settings",
  "clock.fill": "access-time",
  "pencil": "edit",
  "trash.fill": "delete",
  "photo.fill": "photo",
  "paperplane.fill": "send",
  "heart.fill": "favorite",
  "exclamationmark.triangle.fill": "warning",
  "checkmark.circle.fill": "check-circle",
  "arrow.up.circle.fill": "upload",
  "lock.fill": "lock",
  "crown.fill": "workspace-premium",
  "info.circle.fill": "info",
  "thermometer": "thermostat",
  "lungs.fill": "air",
  "face.smiling": "sentiment-satisfied",
  "staroflife.fill": "emergency",
  "play.fill": "play-arrow",
  "stop.fill": "stop",
  "bolt.fill": "bolt",
  "person.fill": "person",
  "person.2.fill": "people",
  "doc.on.doc.fill": "content-copy",
  "star.fill": "star",
  "flag.fill": "flag",
  "calendar": "calendar-today",
  "chart.line.uptrend.xyaxis": "trending-up",
  "envelope.fill": "email",
  "arrow.clockwise": "sync",
  "drop.triangle.fill": "water-drop",
  "checkmark.square.fill": "check-box",
  "square": "check-box-outline-blank",
  "flask.fill": "science",
  "pills.fill": "medication",
  "bell.fill": "notifications",
  "bell.slash.fill": "notifications-off",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
