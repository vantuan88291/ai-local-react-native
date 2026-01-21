import { FC, useCallback } from "react"
import { ActivityIndicator, FlatList, ListRenderItem, RefreshControl, ViewStyle } from "react-native"
import { useFocusEffect, useNavigation } from "@react-navigation/native"

import { Box } from "@/components/Box"
import { Header } from "@/components/Header"
import { Screen } from "@/components/Screen"
import { AppStackScreenProps } from "@/navigators/navigationTypes"
import { ModelInfo } from "@/screens/ai/hooks/models"
import { useAppTheme } from "@/theme/context"
import { $styles } from "@/theme/styles"
import type { ThemedStyle } from "@/theme/types"

import { ModelItem } from "./components"
import { useModels } from "./hooks/useModels"

export const WelcomeScreen: FC<AppStackScreenProps<"Welcome">> = function WelcomeScreen() {
  const { themed, theme } = useAppTheme()
  const navigation = useNavigation<AppStackScreenProps<"Welcome">["navigation"]>()
  const {
    models,
    isLoading,
    isRefreshing,
    sortOrder,
    toggleSortOrder,
    refresh,
    isModelDownloaded,
    refreshDownloadStatus,
    removeModel,
  } = useModels()

  // Refresh download status when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshDownloadStatus()
    }, [refreshDownloadStatus]),
  )

  const handleSelectModel = useCallback(
    (model: ModelInfo) => {
      navigation.navigate("ai", { model })
    },
    [navigation],
  )

  const handleRemoveModel = useCallback(
    async (modelId: string, e: any) => {
      e.stopPropagation()
      try {
        await removeModel(modelId)
      } catch (error) {
        console.error("[WelcomeScreen] Error removing model:", error)
      }
    },
    [removeModel],
  )

  const renderItem: ListRenderItem<ModelInfo> = useCallback(
    ({ item }) => (
      <ModelItem
        model={item}
        isDownloaded={isModelDownloaded(item.id)}
        onSelect={handleSelectModel}
        onRemove={handleRemoveModel}
      />
    ),
    [handleSelectModel, handleRemoveModel, isModelDownloaded],
  )

  const keyExtractor = useCallback((item: ModelInfo) => item.id, [])

  return (
    <Screen preset="fixed" contentContainerStyle={$styles.flex1}>
      <Header
        title="AI Models"
        rightIcon={sortOrder === "asc" ? "sortUp" : "sortDown"}
        onRightPress={toggleSortOrder}
      />
      {isLoading ? (
        <Box style={themed($loadingContainer)}>
          <ActivityIndicator size="large" color={theme.colors.tint} />
        </Box>
      ) : (
        <FlatList
          data={models}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={themed($listContent)}
          showsVerticalScrollIndicator={true}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={theme.colors.tint}
            />
          }
        />
      )}
    </Screen>
  )
}

const $listContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  paddingTop: spacing.md,
  paddingBottom: spacing.md,
})

const $loadingContainer: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
})
