import { FC } from "react"
import { TextStyle, TouchableOpacity, ViewStyle } from "react-native"

import { Box } from "@/components/Box"
import { Icon } from "@/components/Icon"
import { Row } from "@/components/Row"
import { Text } from "@/components/Text"
import { ModelInfo } from "@/screens/ai/hooks/models"
import { useAppTheme } from "@/theme/context"
import { spacing } from "@/theme/spacing"
import type { ThemedStyle } from "@/theme/types"

interface ModelItemProps {
  model: ModelInfo
  isDownloaded: boolean
  onSelect: (model: ModelInfo) => void
  onRemove: (modelId: string, e: any) => void
}

export const ModelItem: FC<ModelItemProps> = ({ model, isDownloaded, onSelect, onRemove }) => {
  const { themed, theme } = useAppTheme()

  return (
    <TouchableOpacity
      onPress={() => onSelect(model)}
      style={themed($modelItem)}
      activeOpacity={0.7}
    >
      <Box style={[themed($modelItemContainer), isDownloaded && themed($downloadedContainer)]}>
        <Row alignItems="center" justifyContent="space-between" style={themed($modelContentRow)}>
          <Box style={themed($modelInfo)}>
            <Text
              text={model.name}
              preset="default"
              size="md"
              weight="medium"
              numberOfLines={1}
              style={[themed($modelNameText), isDownloaded && themed($downloadedName)]}
            />
            <Text text={model.size} preset="default" size="xs" style={themed($modelSize)} />
          </Box>
          {isDownloaded && (
            <TouchableOpacity
              onPress={(e) => onRemove(model.id, e)}
              style={themed($deleteButton)}
              activeOpacity={0.7}
            >
              <Icon size={18} icon="x" color={theme.colors.palette.neutral100} />
            </TouchableOpacity>
          )}
        </Row>
      </Box>
    </TouchableOpacity>
  )
}

const $modelItem: ThemedStyle<ViewStyle> = () => ({
  marginBottom: spacing.xs,
})

const $modelItemContainer: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  paddingVertical: spacing.md,
  paddingHorizontal: spacing.md,
  borderRadius: 12,
  backgroundColor: colors.palette.neutral100,
  borderWidth: 1,
  borderColor: colors.separator,
})

const $downloadedContainer: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.neutral100,
  borderWidth: 2,
  borderColor: colors.tint,
  shadowColor: colors.tint,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
})

const $modelContentRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $modelInfo: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxs,
})

const $modelNameText: ThemedStyle<TextStyle> = () => ({
  flex: 1,
  flexShrink: 1,
})

const $downloadedName: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
})

const $deleteButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: colors.error,
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
})

const $modelSize: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})
