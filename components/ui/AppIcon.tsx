import { APP_ICON_SOURCES, type AppIconName } from "@/constants/app-icons";
import { Image, type ImageStyle, type StyleProp } from "react-native";

type Props = {
  name: AppIconName;
  size: number;
  style?: StyleProp<ImageStyle>;
};

/** Decorative art: the surrounding control supplies the accessible text. */
export function AppIcon({ name, size, style }: Props) {
  return <Image source={APP_ICON_SOURCES[name]} resizeMode="contain"
    style={[{ width: size, height: size }, style]} accessible={false}
    accessibilityIgnoresInvertColors />;
}
