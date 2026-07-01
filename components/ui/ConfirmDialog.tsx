import { GameColors } from "@/constants/game";
import { moderateScale } from "@/utils/scale";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <Pressable
            onPress={onConfirm}
            style={[
              styles.button,
              destructive ? styles.destructiveButton : styles.confirmButton,
            ]}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.buttonText,
                destructive ? styles.destructiveButtonText : styles.confirmButtonText,
              ]}
            >
              {confirmLabel}
            </Text>
          </Pressable>

          <Pressable
            onPress={onCancel}
            style={[styles.button, styles.cancelButton]}
            accessibilityRole="button"
          >
            <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(45, 52, 54, 0.45)",
    justifyContent: "center",
    paddingHorizontal: moderateScale(24),
  },
  card: {
    backgroundColor: GameColors.card,
    borderRadius: moderateScale(18),
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
    padding: moderateScale(20),
    gap: moderateScale(14),
  },
  title: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: GameColors.text,
    textAlign: "center",
  },
  message: {
    fontSize: moderateScale(15),
    fontWeight: "500",
    color: GameColors.textMuted,
    lineHeight: moderateScale(22),
    textAlign: "center",
  },
  button: {
    minHeight: moderateScale(50),
    borderRadius: moderateScale(14),
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(14),
  },
  confirmButton: {
    backgroundColor: GameColors.primary,
  },
  destructiveButton: {
    backgroundColor: "#C0392B",
  },
  cancelButton: {
    backgroundColor: GameColors.background,
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
  },
  buttonText: {
    fontSize: moderateScale(16),
    fontWeight: "800",
  },
  confirmButtonText: {
    color: "#FFFFFF",
  },
  destructiveButtonText: {
    color: "#FFFFFF",
  },
  cancelButtonText: {
    fontSize: moderateScale(16),
    fontWeight: "700",
    color: GameColors.text,
  },
});
